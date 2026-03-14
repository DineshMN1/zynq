package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/zynqcloud/go-storage/internal/store"
)

// UploadResponse is returned after a successful single-file or chunked upload.
type UploadResponse struct {
	StoragePath string `json:"storage_path"`
	Size        int64  `json:"size"`
	SHA256      string `json:"sha256"`
}

// Upload handles a streaming single-file write.
//
// The request body is piped directly through a SHA-256 hasher into the storage
// backend — the full file is never held in memory.
//
// Required headers:
//
//	X-Owner-ID      owner UUID
//	X-File-ID       file UUID
//
// Optional headers:
//
//	X-Relative-Path  sub-path within owner dir for folder uploads
//	                 e.g. "photos/2024/IMG_001.enc"
//	                 Must not escape the owner root (path traversal guard).
//
//	X-File-Name      original client filename; used only as a MIME sniff fallback
//	                 for OOXML formats (.docx, .xlsx, …) that are byte-identical
//	                 to generic ZIP archives.
//
//	X-Dedup: 1       route this upload through the Content-Addressable Store.
//	                 The service sniffs the MIME type; if the format qualifies
//	                 (PDF, images, Office docs) the blob is deduplicated by
//	                 SHA-256. Duplicate uploads return the existing blob path
//	                 with no disk write.
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	h.metrics.UploadsTotal.Add(1)

	ownerID := strings.TrimSpace(r.Header.Get("X-Owner-ID"))
	fileID := strings.TrimSpace(r.Header.Get("X-File-ID"))

	if ownerID == "" || fileID == "" {
		h.metrics.UploadsFailed.Add(1)
		writeError(w, http.StatusBadRequest, "X-Owner-ID and X-File-ID headers are required")
		return
	}
	if !isValidID(ownerID) || !isValidID(fileID) {
		h.metrics.UploadsFailed.Add(1)
		writeError(w, http.StatusBadRequest, "invalid id format")
		return
	}

	// ── Storage path resolution (folder upload support) ───────────────────────
	//
	// X-Relative-Path allows callers to preserve directory structure when
	// uploading an entire folder. Example:
	//   X-Relative-Path: docs/reports/Q1.pdf.enc
	//   → stored at {ownerID}/docs/reports/Q1.pdf.enc
	//
	// Security: resolveStoragePath validates that the final path cannot escape
	// the owner's root via ".." or absolute-path injection.
	var storagePath string
	if relPath := strings.TrimSpace(r.Header.Get("X-Relative-Path")); relPath != "" {
		p, ok := resolveStoragePath(ownerID, relPath)
		if !ok {
			h.metrics.UploadsFailed.Add(1)
			writeError(w, http.StatusBadRequest, "invalid relative path")
			return
		}
		storagePath = p
	} else {
		storagePath = filepath.Join(ownerID, fileID+".enc")
	}

	// ── Selective deduplication via CAS ──────────────────────────────────────
	//
	// When X-Dedup: 1, the service sniffs the first 512 bytes to detect MIME
	// type. Qualifying formats (text, PDF, images, Office docs) are routed
	// through the Content-Addressable Store: identical content → identical
	// SHA-256 → no second disk write. Non-qualifying formats (video, ZIP,
	// executables) fall through to the normal write path.
	if r.Header.Get("X-Dedup") == "1" && h.cas != nil {
		fileName := strings.TrimSpace(r.Header.Get("X-File-Name"))
		dedupable, full := store.ShouldDedup(r.Body, fileName)
		if dedupable {
			result, err := h.cas.Put(full)
			if err != nil {
				h.metrics.UploadsFailed.Add(1)
				h.logger.Error("cas put failed", "err", err)
				writeError(w, http.StatusInternalServerError, "storage write failed")
				return
			}
			if result.IsNew {
				h.metrics.DedupMisses.Add(1)
			} else {
				h.metrics.DedupHits.Add(1)
			}
			h.metrics.BytesWritten.Add(result.Size)

			// Create a hardlink from the CAS blob to the per-file storage path
			// so that the standard download path ({ownerID}/{fileID}.enc) works
			// without modification. os.Link is a single inode reference — no
			// extra disk space is consumed. Falls back to no-op on failure (e.g.
			// cross-device mount): the blob is accessible via CAS directly.
			blobAbs := filepath.Join(h.cfg.StoragePath, result.BlobPath)
			destAbs := filepath.Join(h.cfg.StoragePath, storagePath)
			if mkErr := os.MkdirAll(filepath.Dir(destAbs), 0o750); mkErr == nil {
				os.Link(blobAbs, destAbs) //nolint:errcheck — best-effort
			}

			h.logger.Info("upload complete (dedup)",
				"path", storagePath, "blob", result.BlobPath,
				"bytes", result.Size, "sha256", result.SHA256, "is_new", result.IsNew)
			writeJSON(w, http.StatusCreated, UploadResponse{
				StoragePath: storagePath,
				Size:        result.Size,
				SHA256:      result.SHA256,
			})
			return
		}
		// MIME not dedup-eligible — continue with normal write path.
		// 'full' replays the sniffed bytes, so no data is lost.
		r.Body = io.NopCloser(full)
	}

	// ── Normal (non-dedup) write path ─────────────────────────────────────────
	//
	// Stream r.Body directly to disk — no hashing, no buffering.
	n, err := h.store.Write(storagePath, r.Body)
	if err != nil {
		h.metrics.UploadsFailed.Add(1)
		h.logger.Error("upload: write failed", "path", storagePath, "err", err)
		writeError(w, http.StatusInternalServerError, "storage write failed")
		return
	}

	h.metrics.BytesWritten.Add(n)
	h.logger.Info("upload complete", "path", storagePath, "bytes", n, "sha256", "skipped")

	writeJSON(w, http.StatusCreated, UploadResponse{
		StoragePath: storagePath,
		Size:        n,
		SHA256:      "skipped",
	})
}

// Download streams a stored file back to the caller without loading it into memory.
func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	ownerID := r.PathValue("owner")
	fileID := r.PathValue("fileId")

	if !isValidID(ownerID) || !isValidID(fileID) {
		writeError(w, http.StatusBadRequest, "invalid id format")
		return
	}

	rc, size, err := h.store.Read(filepath.Join(ownerID, fileID+".enc"))
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", size))
	io.Copy(w, rc) //nolint:errcheck
}

// Delete permanently removes a file from storage.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	ownerID := r.PathValue("owner")
	fileID := r.PathValue("fileId")

	if !isValidID(ownerID) || !isValidID(fileID) {
		writeError(w, http.StatusBadRequest, "invalid id format")
		return
	}

	if err := h.store.Delete(filepath.Join(ownerID, fileID+".enc")); err != nil {
		h.logger.Error("delete failed", "owner", ownerID, "file", fileID, "err", err)
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// isValidID rejects empty values and obvious path-traversal attempts.
// The store.Local backend applies a second, filesystem-level defence via filepath.Clean.
func isValidID(id string) bool {
	return id != "" &&
		!strings.Contains(id, "/") &&
		!strings.Contains(id, "\\") &&
		!strings.Contains(id, "..")
}

// resolveStoragePath validates a client-supplied relative path for folder uploads
// and returns the canonical storage path rooted at ownerID.
//
// Security model:
//   - filepath.Clean normalises the path, collapsing ".." sequences.
//   - An absolute path after cleaning is always rejected.
//   - filepath.Rel(ownerID, full) is recomputed to confirm the result
//     is strictly contained within the owner root even after cleaning.
//
// Returns ("", false) on any validation failure.
func resolveStoragePath(ownerID, relPath string) (string, bool) {
	if ownerID == "" || relPath == "" {
		return "", false
	}

	// Convert any Windows-style separators and normalise dots.
	clean := filepath.Clean(filepath.FromSlash(relPath))

	// Reject absolute paths and explicit top-level traversals.
	if filepath.IsAbs(clean) {
		return "", false
	}
	sep := string(filepath.Separator)
	if clean == ".." || strings.HasPrefix(clean, ".."+sep) {
		return "", false
	}

	full := filepath.Join(ownerID, clean)

	// Containment check: the relative distance from ownerID to full must
	// never start with ".." — that would mean we escaped the owner root.
	rel, err := filepath.Rel(ownerID, full)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+sep) {
		return "", false
	}

	return full, true
}
