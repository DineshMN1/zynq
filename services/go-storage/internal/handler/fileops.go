package handler

import (
	"net/http"
	"path/filepath"
)

// MoveToTrash moves a file to the owner's .trash directory.
//
// POST /v1/files/{owner}/{fileId}/trash
//
// Idempotent: returns 204 even if the source file does not exist (already
// trashed or never uploaded).
func (h *Handler) MoveToTrash(w http.ResponseWriter, r *http.Request) {
	ownerID := r.PathValue("owner")
	fileID := r.PathValue("fileId")

	if !isValidID(ownerID) || !isValidID(fileID) {
		writeError(w, http.StatusBadRequest, "invalid id format")
		return
	}

	src := filepath.Join(ownerID, fileID+".enc")
	dst := filepath.Join(ownerID, ".trash", fileID+".enc")

	if err := h.store.MkdirAll(filepath.Join(ownerID, ".trash")); err != nil {
		h.logger.Error("trash: mkdir failed", "owner", ownerID, "err", err)
		writeError(w, http.StatusInternalServerError, "failed to create trash directory")
		return
	}

	if err := h.store.Rename(src, dst); err != nil {
		// File already gone — treat as success so callers are idempotent.
		exists, _ := h.store.Exists(src)
		if !exists {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.logger.Error("trash: rename failed", "src", src, "dst", dst, "err", err)
		writeError(w, http.StatusInternalServerError, "failed to move file to trash")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RestoreFromTrash moves a file from the .trash directory back to the owner root.
//
// POST /v1/files/{owner}/{fileId}/restore
//
// Returns 404 if the file is not in trash.
func (h *Handler) RestoreFromTrash(w http.ResponseWriter, r *http.Request) {
	ownerID := r.PathValue("owner")
	fileID := r.PathValue("fileId")

	if !isValidID(ownerID) || !isValidID(fileID) {
		writeError(w, http.StatusBadRequest, "invalid id format")
		return
	}

	src := filepath.Join(ownerID, ".trash", fileID+".enc")
	dst := filepath.Join(ownerID, fileID+".enc")

	// Confirm the trashed file exists before attempting rename.
	exists, err := h.store.Exists(src)
	if err != nil {
		h.logger.Error("restore: exists check failed", "src", src, "err", err)
		writeError(w, http.StatusInternalServerError, "failed to check trash")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "file not found in trash")
		return
	}

	if err := h.store.Rename(src, dst); err != nil {
		h.logger.Error("restore: rename failed", "src", src, "dst", dst, "err", err)
		writeError(w, http.StatusInternalServerError, "failed to restore file")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
