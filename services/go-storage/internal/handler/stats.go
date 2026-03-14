package handler

import (
	"net/http"

	"github.com/zynqcloud/go-storage/internal/store"
)

// storageStatsResponse is the response shape for GET /v1/stats.
type storageStatsResponse struct {
	TotalBytes int64 `json:"total_bytes"`
	FreeBytes  int64 `json:"free_bytes"`
	UsedBytes  int64 `json:"used_bytes"`
}

// Stats returns disk-space statistics for the storage volume.
//
// GET /v1/stats
//
// Uses the Local backend's DiskStats() (syscall.Statfs on Linux).
// Returns zeros on non-local backends or when stats are unavailable —
// callers must treat zero TotalBytes as "stats unavailable".
func (h *Handler) Stats(w http.ResponseWriter, _ *http.Request) {
	ls, ok := h.store.(*store.Local)
	if !ok {
		writeJSON(w, http.StatusOK, storageStatsResponse{})
		return
	}

	avail, total := ls.DiskStats()

	// uint64 → int64 casts overflow above math.MaxInt64 (≈9.2 EB).
	// Clamp to avoid returning negative numbers on absurdly large volumes.
	const maxInt64 = uint64(1<<63 - 1)
	clamp := func(v uint64) int64 {
		if v > maxInt64 {
			return int64(maxInt64)
		}
		return int64(v)
	}

	usedU := uint64(0)
	if total > avail {
		usedU = total - avail
	}

	writeJSON(w, http.StatusOK, storageStatsResponse{
		TotalBytes: clamp(total),
		FreeBytes:  clamp(avail),
		UsedBytes:  clamp(usedU),
	})
}
