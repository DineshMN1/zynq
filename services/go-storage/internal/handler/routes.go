package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/zynqcloud/go-storage/internal/config"
	"github.com/zynqcloud/go-storage/internal/middleware"
	"github.com/zynqcloud/go-storage/internal/store"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	cfg         *config.Config
	store       store.Backend
	logger      *slog.Logger
	metrics     *Metrics
	cas         *store.CAS    // Content-Addressable Storage for dedup; nil when init failed
	assemblySem chan struct{} // bounded slot pool for CompleteUpload disk I/O
}

// New registers all routes and returns the root http.Handler.
// Uses Go 1.22 method+path pattern syntax — no external router needed.
//
// Middleware stack (outer → inner):
//
//	RequestLog → ServeMux → ServiceToken auth → UploadLimiter → handler
func New(cfg *config.Config, backend store.Backend, logger *slog.Logger) http.Handler {
	// Content-Addressable Storage for selective deduplication.
	// NewCAS takes the storage root — it creates a "blobs/" sub-directory
	// internally, so blobs land at {StoragePath}/blobs/{ab}/{cd}/{sha256}.
	// If CAS initialisation fails (e.g. read-only volume in testing) dedup is
	// silently disabled — uploads still work via the normal write path.
	cas, err := store.NewCAS(cfg.StoragePath)
	if err != nil {
		logger.Warn("CAS initialisation failed — dedup disabled", "err", err)
		cas = nil
	}

	// Assembly semaphore: cap concurrent CompleteUpload workers to prevent
	// disk thrashing when many sessions finish simultaneously.
	// Clamp to at least 1 so a misconfigured zero value doesn't deadlock.
	maxWorkers := cfg.MaxAssemblyWorkers
	if maxWorkers < 1 {
		maxWorkers = 1
	}
	assemblySem := make(chan struct{}, maxWorkers)

	h := &Handler{
		cfg:         cfg,
		store:       backend,
		logger:      logger,
		metrics:     &Metrics{},
		cas:         cas,
		assemblySem: assemblySem,
	}

	auth := middleware.ServiceToken(cfg.ServiceToken)
	logMW := middleware.RequestLog(logger)
	limiter := middleware.NewUploadLimiter(cfg.MaxConcurrentUploads)

	mux := http.NewServeMux()

	// ── Single-file streaming upload ─────────────────────────────────────────
	// POST /v1/files
	//   Headers: X-Owner-ID, X-File-ID
	//   Optional: X-Relative-Path (folder upload), X-File-Name (dedup MIME hint),
	//             X-Dedup: 1 (route through CAS when MIME qualifies)
	//   Body:    raw (already-encrypted) bytes
	mux.Handle("POST /v1/files",
		auth(limiter.Limit(http.HandlerFunc(h.Upload))))

	// ── Streaming download / delete ──────────────────────────────────────────
	mux.Handle("GET /v1/files/{owner}/{fileId}",
		auth(http.HandlerFunc(h.Download)))
	mux.Handle("DELETE /v1/files/{owner}/{fileId}",
		auth(http.HandlerFunc(h.Delete)))

	// ── Resumable / chunked upload ───────────────────────────────────────────
	// POST   /v1/uploads                        → initiate session
	// PUT    /v1/uploads/{id}/parts/{n}          → stream part n (rate-limited)
	// POST   /v1/uploads/{id}/complete           → assemble + finalise
	// DELETE /v1/uploads/{id}                    → abort
	mux.Handle("POST /v1/uploads",
		auth(http.HandlerFunc(h.InitUpload)))
	mux.Handle("PUT /v1/uploads/{sessionId}/parts/{partNum}",
		auth(limiter.Limit(http.HandlerFunc(h.UploadPart))))
	mux.Handle("POST /v1/uploads/{sessionId}/complete",
		auth(http.HandlerFunc(h.CompleteUpload)))
	mux.Handle("DELETE /v1/uploads/{sessionId}",
		auth(http.HandlerFunc(h.AbortUpload)))

	// ── Trash / restore ──────────────────────────────────────────────────────
	// POST /v1/files/{owner}/{fileId}/trash    → move to .trash/
	// POST /v1/files/{owner}/{fileId}/restore  → move back from .trash/
	mux.Handle("POST /v1/files/{owner}/{fileId}/trash",
		auth(http.HandlerFunc(h.MoveToTrash)))
	mux.Handle("POST /v1/files/{owner}/{fileId}/restore",
		auth(http.HandlerFunc(h.RestoreFromTrash)))

	// ── Observability ─────────────────────────────────────────────────────────
	//
	// GET /health        — liveness probe: fast 200 while the process is alive.
	//                      K8s restarts the pod if this returns non-2xx.
	//
	// GET /healthz/ready — readiness probe: checks disk space and storage dir.
	//                      K8s stops routing traffic (not restart) on 503.
	//                      Protected by service token so internal state is not
	//                      leaked to the public internet.
	//
	// GET /metrics       — atomic process counters as flat JSON.
	//                      Protected by service token; scrape with NestJS or
	//                      a Prometheus pushgateway sidecar.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.Handle("GET /healthz/ready",
		auth(http.HandlerFunc(h.Readiness)))
	mux.Handle("GET /metrics",
		auth(h.metrics.metricsHandler(limiter.Active)))
	mux.Handle("GET /v1/stats",
		auth(http.HandlerFunc(h.Stats)))

	// Wrap the entire mux with request logging so every route — including
	// auth failures and 503s from the limiter — gets an access log entry.
	return logMW(mux)
}

// Readiness is the Kubernetes readiness probe handler.
// Returns 200 when the service can accept uploads; 503 when it cannot.
// Checks performed:
//  1. Storage directory is accessible (os.Stat)
//  2. Free disk space ≥ cfg.MinFreeBytes (Linux only via syscall.Statfs)
func (h *Handler) Readiness(w http.ResponseWriter, _ *http.Request) {
	type check struct {
		Name string `json:"name"`
		OK   bool   `json:"ok"`
		Msg  string `json:"msg,omitempty"`
	}
	var checks []check
	allOK := true

	// 1. Storage directory accessible.
	if _, err := os.Stat(h.cfg.StoragePath); err != nil {
		checks = append(checks, check{"storage_accessible", false, "stat failed"})
		allOK = false
	} else {
		checks = append(checks, check{"storage_accessible", true, ""})
	}

	// 2. Disk space check (only meaningful for Local backend on Linux;
	//    (0, 0) means "unavailable" — skip the check rather than false-alarm).
	if ls, ok := h.store.(*store.Local); ok {
		avail, total := ls.DiskStats()
		if total > 0 {
			if avail < uint64(h.cfg.MinFreeBytes) {
				checks = append(checks, check{
					"disk_space", false,
					fmt.Sprintf("%d MB free — need %d MB", avail>>20, h.cfg.MinFreeBytes>>20),
				})
				allOK = false
			} else {
				checks = append(checks, check{
					"disk_space", true,
					fmt.Sprintf("%d MB free of %d MB", avail>>20, total>>20),
				})
			}
		}
	}

	status := http.StatusOK
	if !allOK {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{"ready": allOK, "checks": checks})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
