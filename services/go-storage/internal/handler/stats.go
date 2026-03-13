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
	used := int64(0)
	if total > uint64(avail) {
		used = int64(total) - int64(avail)
	}

	writeJSON(w, http.StatusOK, storageStatsResponse{
		TotalBytes: int64(total),
		FreeBytes:  int64(avail),
		UsedBytes:  used,
	})
}
