package handlers

import (
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zynqcloud/api/internal/config"
	"github.com/zynqcloud/api/internal/crypto"
	"github.com/zynqcloud/api/internal/models"
	"github.com/zynqcloud/api/internal/storage"
	"gorm.io/gorm"
)

type ShareHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	crypto  *crypto.Crypto
	backend storage.Backend
}

func NewShareHandler(db *gorm.DB, cfg *config.Config, c *crypto.Crypto, backend storage.Backend) *ShareHandler {
	return &ShareHandler{db: db, cfg: cfg, crypto: c, backend: backend}
}

// GET /api/v1/shares/{token}
func (h *ShareHandler) GetByToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	var share models.Share
	if err := h.db.Preload("File").Where("share_token = ? AND is_public = true", token).First(&share).Error; err != nil {
		writeError(w, http.StatusNotFound, "Share not found")
		return
	}

	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		writeError(w, http.StatusGone, "Share has expired")
		return
	}

	share.HasPassword = share.Password != nil
	// Never expose the password
	resp := map[string]interface{}{
		"id":          share.ID,
		"file_id":     share.FileID,
		"file":        share.File,
		"is_public":   share.IsPublic,
		"permission":  share.Permission,
		"expires_at":  share.ExpiresAt,
		"hasPassword": share.HasPassword,
		"share_token": share.ShareToken,
		"created_at":  share.CreatedAt,
	}

	writeJSON(w, http.StatusOK, resp)
}

// POST /api/v1/shares/{token}/download
func (h *ShareHandler) Download(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	var share models.Share
	if err := h.db.Preload("File").Where("share_token = ? AND is_public = true", token).First(&share).Error; err != nil {
		writeError(w, http.StatusNotFound, "Share not found")
		return
	}

	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		writeError(w, http.StatusGone, "Share has expired")
		return
	}

	// Check password if required
	if share.Password != nil {
		var req struct {
			Password string `json:"password"`
		}
		if err := readJSON(r, &req); err != nil ||
			subtle.ConstantTimeCompare([]byte(req.Password), []byte(*share.Password)) != 1 {
			writeError(w, http.StatusUnauthorized, "Incorrect password")
			return
		}
	}

	if share.File == nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	file := share.File
	if file.IsFolder {
		writeError(w, http.StatusBadRequest, "Cannot download a folder")
		return
	}

	if file.StoragePath == nil {
		writeError(w, http.StatusNotFound, "File data not found")
		return
	}

	fh := &FilesHandler{
		db:      h.db,
		cfg:     h.cfg,
		crypto:  h.crypto,
		backend: h.backend,
	}
	fh.streamDecryptedFile(w, r, file)
}

// GET /api/v1/public/share/{token}
func (h *ShareHandler) GetPublicShare(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	password := r.Header.Get("x-share-password")

	var share models.Share
	if err := h.db.Preload("File").Preload("Creator").
		Where("share_token = ? AND is_public = true", token).
		First(&share).Error; err != nil {
		writeError(w, http.StatusNotFound, "Share not found")
		return
	}

	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		writeError(w, http.StatusGone, "Share has expired")
		return
	}

	if share.Password != nil && *share.Password != "" {
		if password == "" || subtle.ConstantTimeCompare([]byte(password), []byte(*share.Password)) != 1 {
			writeError(w, http.StatusUnauthorized, "Password required")
			return
		}
	}

	if share.File == nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	ownerName := ""
	if share.Creator != nil {
		ownerName = share.Creator.Name
	}

	mimeType := ""
	if share.File.MimeType != nil {
		mimeType = *share.File.MimeType
	}

	// Compute folder size if shared item is a folder
	var folderSize int64
	if share.File.IsFolder {
		h.db.Raw(`
			WITH RECURSIVE descendants AS (
				SELECT id, is_folder, size FROM files
				WHERE parent_id = ? AND deleted_at IS NULL
				UNION ALL
				SELECT f.id, f.is_folder, f.size FROM files f
				INNER JOIN descendants d ON f.parent_id = d.id
				WHERE f.deleted_at IS NULL
			)
			SELECT COALESCE(SUM(size), 0) FROM descendants WHERE is_folder = false
		`, share.File.ID).Scan(&folderSize)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          share.ID,
		"name":        share.File.Name,
		"size":        share.File.Size,
		"folderSize":  folderSize,
		"mimeType":    mimeType,
		"owner":       ownerName,
		"ownerId":     share.File.OwnerID,
		"createdAt":   share.CreatedAt,
		"isFolder":    share.File.IsFolder,
		"hasContent":  share.File.StoragePath != nil || share.File.IsFolder,
		"hasPassword": share.Password != nil && *share.Password != "",
		"expiresAt":   share.ExpiresAt,
	})
}

// GET /api/v1/public/share/{token}/download
func (h *ShareHandler) DownloadPublicShare(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	password := r.Header.Get("x-share-password")

	var share models.Share
	if err := h.db.Preload("File").Where("share_token = ? AND is_public = true", token).First(&share).Error; err != nil {
		writeError(w, http.StatusNotFound, "Share not found")
		return
	}

	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		writeError(w, http.StatusGone, "Share has expired")
		return
	}

	if share.Password != nil && *share.Password != "" {
		if password == "" || subtle.ConstantTimeCompare([]byte(password), []byte(*share.Password)) != 1 {
			writeError(w, http.StatusUnauthorized, "Password required")
			return
		}
	}

	if share.File == nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	fh := &FilesHandler{
		db:      h.db,
		cfg:     h.cfg,
		crypto:  h.crypto,
		backend: h.backend,
	}

	if share.File.IsFolder {
		fh.streamFolderAsZip(w, r, share.File)
		return
	}

	if share.File.StoragePath == nil {
		writeError(w, http.StatusNotFound, "File data not found")
		return
	}
	fh.streamDecryptedFile(w, r, share.File)
}
