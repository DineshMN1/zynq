package handlers

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zynqcloud/api/internal/config"
	"github.com/zynqcloud/api/internal/crypto"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"github.com/zynqcloud/api/internal/storage"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var blockedExtensionsRe = regexp.MustCompile(`(?i)\.(exe|bat|cmd|com|ps1|psd1|psm1|vbs|vbe|jse|wsf|wsh|msc|dll|msi|scr|hta|cpl|inf|reg|sys|drv|bin|run|jar|dex|apk|ipa|dmg|pkg|deb|rpm|sh|bash|zsh|fish|ksh|csh|tcsh|command)$`)

type FilesHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	crypto  *crypto.Crypto
	backend storage.Backend
}

func NewFilesHandler(db *gorm.DB, cfg *config.Config, c *crypto.Crypto, backend storage.Backend) *FilesHandler {
	return &FilesHandler{db: db, cfg: cfg, crypto: c, backend: backend}
}

// GET /api/v1/files
func (h *FilesHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	search := q.Get("search")
	parentIDStr := q.Get("parentId")

	offset := (page - 1) * limit

	query := h.db.Model(&models.File{}).
		Where("owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", userID)

	if parentIDStr == "" || parentIDStr == "null" || parentIDStr == "root" {
		query = query.Where("parent_id IS NULL")
	} else {
		parentID, err := uuid.Parse(parentIDStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Invalid parentId")
			return
		}
		query = query.Where("parent_id = ?", parentID)
	}

	if search != "" {
		query = query.Where("name ILIKE ? ESCAPE '\\'", likeSafe(search))
	}

	var total int64
	query.Count(&total)

	var files []models.File
	query.Order("is_folder DESC, name ASC").Offset(offset).Limit(limit).Find(&files)

	// Compute share counts and folder sizes
	for i := range files {
		var shareCount, publicCount, privateCount int64
		h.db.Model(&models.Share{}).Where("file_id = ?", files[i].ID).Count(&shareCount)
		h.db.Model(&models.Share{}).Where("file_id = ? AND is_public = true", files[i].ID).Count(&publicCount)
		h.db.Model(&models.Share{}).Where("file_id = ? AND is_public = false", files[i].ID).Count(&privateCount)
		files[i].ShareCount = int(shareCount)
		files[i].PublicShareCount = int(publicCount)
		files[i].PrivateShareCount = int(privateCount)

		if files[i].IsFolder {
			var folderSize int64
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
			`, files[i].ID).Scan(&folderSize)
			files[i].FolderSize = folderSize
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": files,
		"meta": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// POST /api/v1/files
func (h *FilesHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var req struct {
		Name               string     `json:"name"`
		IsFolder           bool       `json:"isFolder"`
		ParentID           *uuid.UUID `json:"parentId"`
		MimeType           *string    `json:"mimeType"`
		Size               int64      `json:"size"`
		FileHash           *string    `json:"fileHash"`
		SkipDuplicateCheck bool       `json:"skipDuplicateCheck"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	if !req.IsFolder && blockedExtensionsRe.MatchString(req.Name) {
		writeError(w, http.StatusBadRequest, "File type not allowed")
		return
	}

	// Verify parent exists and is owned by user
	if req.ParentID != nil {
		var parent models.File
		if err := h.db.Where("id = ? AND owner_id = ? AND is_folder = true AND deleted_at IS NULL AND space_id IS NULL", req.ParentID, userID).First(&parent).Error; err != nil {
			writeError(w, http.StatusNotFound, "Parent folder not found")
			return
		}
	}

	file := &models.File{
		ID:       uuid.New(),
		OwnerID:  userID,
		Name:     req.Name,
		IsFolder: req.IsFolder,
		ParentID: req.ParentID,
		MimeType: req.MimeType,
		Size:     req.Size,
		FileHash: req.FileHash,
	}

	if err := h.db.Create(file).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create file")
		return
	}

	if file.IsFolder {
		var auditUser models.User
		h.db.Select("name, email").First(&auditUser, "id = ?", userID)
		LogAudit(h.db, AuditEntry{
			UserID:       &userID,
			UserName:     auditUser.Name,
			UserEmail:    auditUser.Email,
			Action:       "folder.create",
			ResourceType: "folder",
			ResourceName: file.Name,
			ResourceID:   file.ID.String(),
			IPAddress:    auditIP(r),
		})
	}

	// Return uploadUrl so the frontend knows to PUT the file content.
	// Folders have no content — uploadUrl is omitted for them.
	resp := map[string]interface{}{
		"id":         file.ID,
		"owner_id":   file.OwnerID,
		"name":       file.Name,
		"is_folder":  file.IsFolder,
		"parent_id":  file.ParentID,
		"mime_type":  file.MimeType,
		"size":       file.Size,
		"file_hash":  file.FileHash,
		"created_at": file.CreatedAt,
		"updated_at": file.UpdatedAt,
	}
	if !file.IsFolder {
		resp["uploadUrl"] = fmt.Sprintf("/api/v1/files/%s/upload", file.ID)
	}
	writeJSON(w, http.StatusCreated, resp)
}

// GET /api/v1/files/trash
func (h *FilesHandler) Trash(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	offset := (page - 1) * limit

	var total int64
	h.db.Model(&models.File{}).Where("owner_id = ? AND deleted_at IS NOT NULL AND space_id IS NULL", userID).Count(&total)

	var files []models.File
	h.db.Where("owner_id = ? AND deleted_at IS NOT NULL AND space_id IS NULL", userID).
		Order("deleted_at DESC").
		Offset(offset).Limit(limit).
		Find(&files)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": files,
		"meta": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// DELETE /api/v1/files/trash/empty
func (h *FilesHandler) EmptyTrash(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var files []models.File
	h.db.Where("owner_id = ? AND deleted_at IS NOT NULL AND space_id IS NULL", userID).Find(&files)

	// Collect IDs and unique storage paths for batch processing.
	deleteIDs := make([]uuid.UUID, 0, len(files))
	uniquePaths := make(map[string]struct{})
	for _, f := range files {
		deleteIDs = append(deleteIDs, f.ID)
		if !f.IsFolder && f.StoragePath != nil {
			uniquePaths[*f.StoragePath] = struct{}{}
		}
	}

	// For each unique storage path, atomically check references and delete blob.
	for storagePath := range uniquePaths {
		if err := h.db.Transaction(func(tx *gorm.DB) error {
			// Lock all file rows that reference this storage path so no concurrent
			// dedup upload can insert a new reference between the count and the delete.
			var locked []models.File
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("storage_path = ?", storagePath).
				Find(&locked).Error; err != nil {
				return err
			}
			// Count references outside the trash batch.
			var refCount int64
			for _, lf := range locked {
				isBeingDeleted := false
				for _, did := range deleteIDs {
					if lf.ID == did {
						isBeingDeleted = true
						break
					}
				}
				if !isBeingDeleted {
					refCount++
				}
			}
			if refCount == 0 {
				h.backend.Delete(storagePath)
			}
			return nil
		}); err != nil {
			slog.Error("empty trash: ref-count check failed", "path", storagePath, "error", err)
		}
	}

	// Delete shares and file records.
	for _, f := range files {
		h.db.Where("file_id = ?", f.ID).Delete(&models.Share{})
		h.db.Delete(&f)
	}

	// Update storage used
	var totalSize int64
	h.db.Model(&models.File{}).
		Where("owner_id = ? AND deleted_at IS NULL AND is_folder = false AND space_id IS NULL", userID).
		Select("COALESCE(SUM(size), 0)").Scan(&totalSize)
	h.db.Model(&models.User{}).Where("id = ?", userID).Update("storage_used", totalSize)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Trash emptied"})
}

// GET /api/v1/files/shared
func (h *FilesHandler) SharedWithMe(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	offset := (page - 1) * limit

	var user models.User
	h.db.First(&user, "id = ?", userID)

	baseQ := h.db.Model(&models.Share{}).
		Where("(grantee_user_id = ? OR grantee_email = ?) AND is_public = false", userID, user.Email).
		Where("(expires_at IS NULL OR expires_at > ?)", time.Now())

	var total int64
	baseQ.Count(&total)

	var shares []models.Share
	baseQ.Preload("File").Preload("Creator").
		Offset(offset).Limit(limit).
		Find(&shares)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": shares,
		"meta": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GET /api/v1/files/public-shares
func (h *FilesHandler) MyPublicShares(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var shares []models.Share
	h.db.Preload("File").
		Where("created_by = ? AND is_public = true", userID).
		Find(&shares)

	for i := range shares {
		shares[i].HasPassword = shares[i].Password != nil
	}

	writeJSON(w, http.StatusOK, shares)
}

// GET /api/v1/files/private-shares
func (h *FilesHandler) MyPrivateShares(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	offset := (page - 1) * limit

	baseQ := h.db.Model(&models.Share{}).
		Where("created_by = ? AND is_public = false", userID)

	var total int64
	baseQ.Count(&total)

	var shares []models.Share
	baseQ.Preload("File").Preload("GranteeUser").
		Offset(offset).Limit(limit).
		Find(&shares)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": shares,
		"meta": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// DELETE /api/v1/files/shares/{shareId}
func (h *FilesHandler) RevokeShare(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	shareIDStr := chi.URLParam(r, "shareId")
	shareID, err := uuid.Parse(shareIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid share ID")
		return
	}

	var share models.Share
	if err := h.db.Where("id = ? AND created_by = ?", shareID, userID).First(&share).Error; err != nil {
		writeError(w, http.StatusNotFound, "Share not found")
		return
	}

	// Fetch file name for audit before deleting
	var sharedFile models.File
	h.db.Select("name").First(&sharedFile, "id = ?", share.FileID)

	h.db.Delete(&share)

	var auditUser models.User
	h.db.Select("name, email").First(&auditUser, "id = ?", userID)
	LogAudit(h.db, AuditEntry{
		UserID:       &userID,
		UserName:     auditUser.Name,
		UserEmail:    auditUser.Email,
		Action:       "share.revoke",
		ResourceType: "file",
		ResourceName: sharedFile.Name,
		ResourceID:   share.FileID.String(),
		IPAddress:    auditIP(r),
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Share revoked"})
}

// PATCH /api/v1/files/shares/{shareId}/public-settings
func (h *FilesHandler) UpdatePublicShare(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	shareIDStr := chi.URLParam(r, "shareId")
	shareID, err := uuid.Parse(shareIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid share ID")
		return
	}

	var req struct {
		ExpiresAt *time.Time `json:"expiresAt"`
		Password  *string    `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var share models.Share
	if err := h.db.Where("id = ? AND created_by = ? AND is_public = true", shareID, userID).First(&share).Error; err != nil {
		writeError(w, http.StatusNotFound, "Share not found")
		return
	}

	updates := map[string]interface{}{}
	if req.ExpiresAt != nil {
		updates["expires_at"] = req.ExpiresAt
	}
	if req.Password != nil {
		if *req.Password == "" {
			updates["password"] = nil
		} else {
			updates["password"] = req.Password
		}
	}

	h.db.Model(&share).Updates(updates)
	share.HasPassword = share.Password != nil
	writeJSON(w, http.StatusOK, share)
}

// DELETE /api/v1/files/bulk
func (h *FilesHandler) BulkDelete(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var req struct {
		IDs []uuid.UUID `json:"ids"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "No file IDs provided")
		return
	}

	now := time.Now()

	// Fetch names before soft-deleting for audit
	var filesToDelete []models.File
	h.db.Select("id, name, is_folder").
		Where("id IN ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", req.IDs, userID).
		Find(&filesToDelete)

	h.db.Model(&models.File{}).
		Where("id IN ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", req.IDs, userID).
		Update("deleted_at", now)

	var auditUser models.User
	h.db.Select("name, email").First(&auditUser, "id = ?", userID)
	for _, f := range filesToDelete {
		fID := f.ID
		resourceType := "file"
		if f.IsFolder {
			resourceType = "folder"
		}
		LogAudit(h.db, AuditEntry{
			UserID:       &userID,
			UserName:     auditUser.Name,
			UserEmail:    auditUser.Email,
			Action:       "file.delete",
			ResourceType: resourceType,
			ResourceName: f.Name,
			ResourceID:   fID.String(),
			IPAddress:    auditIP(r),
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Files moved to trash"})
}

// POST /api/v1/files/check-duplicate
func (h *FilesHandler) CheckDuplicate(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var req struct {
		FileHash string `json:"fileHash"`
		FileName string `json:"fileName"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.FileHash == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"isDuplicate": false})
		return
	}

	query := h.db.Model(&models.File{}).
		Where("owner_id = ? AND file_hash = ? AND is_folder = false AND deleted_at IS NULL AND space_id IS NULL", userID, req.FileHash)

	var file models.File
	if err := query.First(&file).Error; err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"isDuplicate": false})
		return
	}

	// Resolve the human-readable location (full ancestor path).
	location := resolveFilePath(h.db, file.ParentID)

	writeJSON(w, http.StatusOK, map[string]interface{}{"isDuplicate": true, "existingFile": file, "location": location})
}

// GET /api/v1/files/{id}
func (h *FilesHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	var shareCount, publicCount, privateCount int64
	h.db.Model(&models.Share{}).Where("file_id = ?", file.ID).Count(&shareCount)
	h.db.Model(&models.Share{}).Where("file_id = ? AND is_public = true", file.ID).Count(&publicCount)
	h.db.Model(&models.Share{}).Where("file_id = ? AND is_public = false", file.ID).Count(&privateCount)
	file.ShareCount = int(shareCount)
	file.PublicShareCount = int(publicCount)
	file.PrivateShareCount = int(privateCount)

	writeJSON(w, http.StatusOK, file)
}

// PATCH /api/v1/files/{id}
func (h *FilesHandler) Rename(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var req struct {
		Name       *string    `json:"name"`
		ParentID   *uuid.UUID `json:"parentId"`
		MoveToRoot bool       `json:"moveToRoot"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	updates := map[string]interface{}{}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		if !file.IsFolder && blockedExtensionsRe.MatchString(name) {
			writeError(w, http.StatusBadRequest, "File type not allowed")
			return
		}
		updates["name"] = name
	}

	if req.MoveToRoot {
		updates["parent_id"] = nil
	} else if req.ParentID != nil {
		if *req.ParentID == fileID {
			writeError(w, http.StatusBadRequest, "Cannot move a file into itself")
			return
		}
		var parent models.File
		if err := h.db.Where("id = ? AND owner_id = ? AND is_folder = true AND deleted_at IS NULL AND space_id IS NULL", *req.ParentID, userID).First(&parent).Error; err != nil {
			writeError(w, http.StatusNotFound, "Target folder not found")
			return
		}
		// Prevent moving a folder into one of its own descendants (cycle).
		if file.IsFolder && isDescendantOf(h.db, *req.ParentID, fileID) {
			writeError(w, http.StatusBadRequest, "Cannot move a folder into its own subfolder")
			return
		}
		updates["parent_id"] = *req.ParentID
	}

	if len(updates) == 0 {
		writeJSON(w, http.StatusOK, file)
		return
	}

	if err := h.db.Model(&file).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update file")
		return
	}

	h.db.Where("id = ?", fileID).First(&file)

	var auditUser models.User
	h.db.Select("name, email").First(&auditUser, "id = ?", userID)
	action := "file.rename"
	resourceType := "file"
	if file.IsFolder {
		resourceType = "folder"
	}
	LogAudit(h.db, AuditEntry{
		UserID:       &userID,
		UserName:     auditUser.Name,
		UserEmail:    auditUser.Email,
		Action:       action,
		ResourceType: resourceType,
		ResourceName: file.Name,
		ResourceID:   file.ID.String(),
		IPAddress:    auditIP(r),
	})

	writeJSON(w, http.StatusOK, file)
}

// PUT /api/v1/files/{id}/upload
func (h *FilesHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	if file.IsFolder {
		writeError(w, http.StatusBadRequest, "Cannot upload to a folder")
		return
	}

	if blockedExtensionsRe.MatchString(file.Name) {
		writeError(w, http.StatusBadRequest, "File type not allowed")
		return
	}

	// Check storage space
	var user models.User
	h.db.First(&user, "id = ?", userID)

	// Limit request body to 15 GiB to prevent runaway reads.
	const maxUploadSize = 15 * 1024 * 1024 * 1024
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if h.crypto == nil {
		writeError(w, http.StatusInternalServerError, "Encryption not configured")
		return
	}

	// ── Stream body to temp file while hashing ────────────────────────────────
	// Avoids loading the entire file into memory for large uploads.
	tmpDir := h.backend.(*storage.Local).Root() + "/.uploads"
	if err := os.MkdirAll(tmpDir, 0o750); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create temp directory")
		return
	}
	tmpFile, err := os.CreateTemp(tmpDir, ".upload-*")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create temp file")
		return
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	// Tee through hash writer while streaming to temp
	hasher := sha256.New()
	plainSize, copyErr := io.Copy(tmpFile, io.TeeReader(r.Body, hasher))
	tmpFile.Close()
	if copyErr != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read upload body")
		return
	}
	if plainSize == 0 {
		writeError(w, http.StatusBadRequest, "Empty file body")
		return
	}

	// Check storage limit (now that we know the real size)
	if user.StorageLimit > 0 && user.StorageUsed+plainSize > user.StorageLimit {
		writeError(w, http.StatusForbidden, "Storage limit exceeded")
		return
	}

	// ── Detect MIME type (peek first 512 bytes from temp file) ────────────────
	mimeType := "application/octet-stream"
	if ext := filepath.Ext(file.Name); ext != "" {
		if extMime := mime.TypeByExtension(ext); extMime != "" {
			mimeType = extMime
		}
	}
	if mimeType == "application/octet-stream" {
		if tf, err := os.Open(tmpPath); err == nil { // #nosec G304 -- tmpPath from os.CreateTemp
			sniff := make([]byte, 512)
			n, _ := tf.Read(sniff)
			tf.Close()
			if n > 0 {
				detected := http.DetectContentType(sniff[:n])
				if i := strings.IndexByte(detected, ';'); i != -1 {
					detected = strings.TrimSpace(detected[:i])
				}
				mimeType = detected
			}
		}
	}

	// ── Deduplication check ───────────────────────────────────────────────────
	var computedHash string
	if storage.ShouldDedup(file.Name) {
		computedHash = hex.EncodeToString(hasher.Sum(nil))

		var dedupDone bool
		dedupErr := h.db.Transaction(func(tx *gorm.DB) error {
			var existing models.File
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where(
					"owner_id = ? AND file_hash = ? AND is_folder = false AND deleted_at IS NULL AND storage_path IS NOT NULL AND space_id IS NULL",
					userID, computedHash,
				).First(&existing).Error

			if err != nil || existing.StoragePath == nil {
				return nil // no dedup match — proceed with normal upload
			}

			mimeStr := mimeType
			hashStr := computedHash
			updates := map[string]interface{}{
				"storage_path":    existing.StoragePath,
				"encrypted_dek":   existing.EncryptedDEK,
				"encryption_iv":   existing.EncryptionIV,
				"encryption_algo": existing.EncryptionAlgo,
				"size":            plainSize,
				"mime_type":       mimeStr,
				"file_hash":       hashStr,
			}
			if err := tx.Model(&file).Updates(updates).Error; err != nil {
				return err
			}
			tx.Model(&models.User{}).Where("id = ?", userID).
				UpdateColumn("storage_used", gorm.Expr("storage_used + ?", plainSize))
			file.Size = plainSize
			file.MimeType = &mimeStr
			file.StoragePath = existing.StoragePath
			file.FileHash = &hashStr
			dedupDone = true
			return nil
		})
		if dedupErr != nil {
			writeError(w, http.StatusInternalServerError, "Failed to update file record")
			return
		}
		if dedupDone {
			LogAudit(h.db, AuditEntry{
				UserID:       &userID,
				UserName:     user.Name,
				UserEmail:    user.Email,
				Action:       "file.upload",
				ResourceType: "file",
				ResourceName: file.Name,
				ResourceID:   file.ID.String(),
				IPAddress:    auditIP(r),
				Metadata:     models.JSONB{"size": plainSize, "mime_type": mimeType, "dedup": true},
			})
			writeJSON(w, http.StatusOK, file)
			return
		}
	}

	// ── Generate encryption keys ──────────────────────────────────────────────
	dek, iv, storedEncryptedDEK, algo, err := h.crypto.CreateEncryptionKeys()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate encryption keys")
		return
	}

	// ── Stream-encrypt temp file to storage ───────────────────────────────────
	storagePath := fmt.Sprintf("%s/%s.enc", userID.String(), fileID.String())

	plainReader, err := os.Open(tmpPath) // #nosec G304 -- tmpPath from os.CreateTemp
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to open temp file")
		return
	}
	defer plainReader.Close()

	// Write encrypted output via a pipe so we don't buffer the whole ciphertext.
	// encErrCh carries the goroutine's result so the main goroutine can inspect it
	// after Write() returns (Write blocks until the pipe is closed).
	pr, pw := io.Pipe()
	encErrCh := make(chan error, 1)
	go func() {
		_, err := crypto.EncryptStream(plainReader, pw, dek, iv)
		if err != nil {
			pw.CloseWithError(err)
		} else {
			pw.Close()
		}
		encErrCh <- err
	}()

	_, writeErr := h.backend.Write(storagePath, pr)
	encErr := <-encErrCh // always wait for the goroutine to finish

	if encErr != nil {
		slog.Error("failed to encrypt file", "error", encErr, "path", storagePath)
		// Clean up the partially-written blob.
		_ = h.backend.Delete(storagePath)
		writeError(w, http.StatusInternalServerError, "Failed to encrypt file")
		return
	}
	if writeErr != nil {
		slog.Error("failed to write encrypted file", "error", writeErr, "path", storagePath)
		writeError(w, http.StatusInternalServerError, "Failed to store file")
		return
	}

	// ── Update DB record ──────────────────────────────────────────────────────
	updates := map[string]interface{}{
		"storage_path":    storagePath,
		"encrypted_dek":   storedEncryptedDEK,
		"encryption_iv":   iv,
		"encryption_algo": algo,
		"size":            plainSize,
		"mime_type":       mimeType,
	}
	if computedHash != "" {
		updates["file_hash"] = computedHash
	}

	if err := h.db.Model(&file).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update file record")
		return
	}

	h.db.Model(&models.User{}).Where("id = ?", userID).
		UpdateColumn("storage_used", gorm.Expr("storage_used + ?", plainSize))

	// Fire storage_warning notification when upload crosses the 75% threshold.
	if user.StorageLimit > 0 {
		prevPct := float64(user.StorageUsed) / float64(user.StorageLimit) * 100
		newPct := float64(user.StorageUsed+plainSize) / float64(user.StorageLimit) * 100
		if prevPct < 75 && newPct >= 75 {
			go SendNotification(h.db, h.cfg, "storage_warning",
				"Storage Warning — 75% Used",
				fmt.Sprintf("User %s has used %.0f%% of their storage quota (%s / %s).",
					user.Email, newPct,
					formatStorageBytes(user.StorageUsed+plainSize),
					formatStorageBytes(user.StorageLimit),
				),
			)
		}
	}

	file.Size = plainSize
	mimeStr := mimeType
	file.MimeType = &mimeStr
	file.StoragePath = &storagePath
	if computedHash != "" {
		file.FileHash = &computedHash
	}

	LogAudit(h.db, AuditEntry{
		UserID:       &userID,
		UserName:     user.Name,
		UserEmail:    user.Email,
		Action:       "file.upload",
		ResourceType: "file",
		ResourceName: file.Name,
		ResourceID:   file.ID.String(),
		IPAddress:    auditIP(r),
		Metadata:     models.JSONB{"size": plainSize, "mime_type": mimeType},
	})

	writeJSON(w, http.StatusOK, file)
}

// GET /api/v1/files/{id}/download
func (h *FilesHandler) Download(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		// Also check if user has a share for this file
		var share models.Share
		var shareUser models.User
		h.db.First(&shareUser, "id = ?", userID)
		if err2 := h.db.Where("file_id = ? AND (grantee_user_id = ? OR grantee_email = ?) AND is_public = false", fileID, userID, shareUser.Email).
			Where("(expires_at IS NULL OR expires_at > ?)", time.Now()).
			First(&share).Error; err2 != nil {
			writeError(w, http.StatusNotFound, "File not found")
			return
		}
		if err3 := h.db.First(&file, "id = ? AND deleted_at IS NULL", fileID).Error; err3 != nil {
			writeError(w, http.StatusNotFound, "File not found")
			return
		}
	}

	if file.IsFolder {
		h.streamFolderAsZip(w, r, &file)
		return
	}

	if file.StoragePath == nil {
		writeError(w, http.StatusNotFound, "File data not found")
		return
	}

	h.streamDecryptedFile(w, r, &file)
}

func (h *FilesHandler) streamDecryptedFile(w http.ResponseWriter, r *http.Request, file *models.File) {
	rc, _, err := h.backend.Read(*file.StoragePath)
	if err != nil {
		writeError(w, http.StatusNotFound, "File data not found")
		return
	}
	defer rc.Close()

	dek, err := h.crypto.DecryptFileKey(file.EncryptedDEK)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to decrypt file key")
		return
	}

	mimeType := "application/octet-stream"
	if file.MimeType != nil {
		mimeType = *file.MimeType
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, file.Name))
	w.Header().Set("Cache-Control", "private, no-cache")

	if file.EncryptionAlgo == "AES-256-GCM-STREAM" {
		// Streaming chunked decryption — no full-file buffering.
		w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))
		w.WriteHeader(http.StatusOK)
		if err := crypto.DecryptStream(rc, w, dek, file.EncryptionIV); err != nil {
			slog.Error("stream decrypt failed", "file_id", file.ID, "err", err)
		}
		return
	}

	// Legacy AES-256-GCM (single-chunk buffer) — kept for files uploaded before streaming.
	ciphertext, err := io.ReadAll(rc)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read file data")
		return
	}

	plaintext, err := crypto.DecryptBuffer(ciphertext, dek, file.EncryptionIV)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to decrypt file")
		return
	}

	w.Header().Set("Content-Length", strconv.FormatInt(int64(len(plaintext)), 10))
	w.WriteHeader(http.StatusOK)
	w.Write(plaintext)
}

// streamFolderAsZip recursively collects all files in a folder, decrypts them,
// and streams the result as a ZIP archive.
func (h *FilesHandler) streamFolderAsZip(w http.ResponseWriter, r *http.Request, folder *models.File) {
	// Recursively collect all non-folder files under this folder.
	type entry struct {
		file models.File
		path string // relative path inside the ZIP
	}
	var entries []entry

	var collect func(parentID uuid.UUID, prefix string)
	collect = func(parentID uuid.UUID, prefix string) {
		var children []models.File
		h.db.Where("parent_id = ? AND deleted_at IS NULL", parentID).
			Order("is_folder DESC, name ASC").Find(&children)
		for _, child := range children {
			childPath := prefix + child.Name
			if child.IsFolder {
				collect(child.ID, childPath+"/")
			} else if child.StoragePath != nil {
				entries = append(entries, entry{file: child, path: childPath})
			}
		}
	}
	collect(folder.ID, "")

	if len(entries) == 0 {
		writeError(w, http.StatusNotFound, "Folder is empty")
		return
	}

	zipName := folder.Name + ".zip"
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, zipName))
	w.Header().Set("Cache-Control", "private, no-cache")
	w.WriteHeader(http.StatusOK)

	zw := zip.NewWriter(w)
	defer zw.Close()

	for _, e := range entries {
		rc, _, err := h.backend.Read(*e.file.StoragePath)
		if err != nil {
			slog.Error("zip: failed to read file", "file_id", e.file.ID, "err", err)
			continue
		}

		dek, err := h.crypto.DecryptFileKey(e.file.EncryptedDEK)
		if err != nil {
			rc.Close()
			slog.Error("zip: failed to decrypt key", "file_id", e.file.ID, "err", err)
			continue
		}

		zf, err := zw.Create(e.path)
		if err != nil {
			rc.Close()
			slog.Error("zip: failed to create entry", "path", e.path, "err", err)
			continue
		}

		if e.file.EncryptionAlgo == "AES-256-GCM-STREAM" {
			if err := crypto.DecryptStream(rc, zf, dek, e.file.EncryptionIV); err != nil {
				slog.Error("zip: stream decrypt failed", "file_id", e.file.ID, "err", err)
			}
		} else {
			ciphertext, err := io.ReadAll(rc)
			if err == nil {
				plaintext, err := crypto.DecryptBuffer(ciphertext, dek, e.file.EncryptionIV)
				if err == nil {
					if _, err := zf.Write(plaintext); err != nil {
						slog.Error("zip: write failed", "file_id", e.file.ID, "err", err)
					}
				} else {
					slog.Error("zip: buffer decrypt failed", "file_id", e.file.ID, "err", err)
				}
			} else {
				slog.Error("zip: read failed", "file_id", e.file.ID, "err", err)
			}
		}
		rc.Close()
	}
}

// DELETE /api/v1/files/{id}
func (h *FilesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	now := time.Now()
	h.db.Model(&file).Update("deleted_at", now)

	var auditUser models.User
	h.db.Select("name, email").First(&auditUser, "id = ?", userID)
	resourceType := "file"
	if file.IsFolder {
		resourceType = "folder"
	}
	LogAudit(h.db, AuditEntry{
		UserID:       &userID,
		UserName:     auditUser.Name,
		UserEmail:    auditUser.Email,
		Action:       "file.delete",
		ResourceType: resourceType,
		ResourceName: file.Name,
		ResourceID:   file.ID.String(),
		IPAddress:    auditIP(r),
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "File moved to trash"})
}

// POST /api/v1/files/{id}/restore
func (h *FilesHandler) Restore(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NOT NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found in trash")
		return
	}

	h.db.Model(&file).Update("deleted_at", nil)

	var auditUser models.User
	h.db.Select("name, email").First(&auditUser, "id = ?", userID)
	LogAudit(h.db, AuditEntry{
		UserID:       &userID,
		UserName:     auditUser.Name,
		UserEmail:    auditUser.Email,
		Action:       "file.restore",
		ResourceType: "file",
		ResourceName: file.Name,
		ResourceID:   file.ID.String(),
		IPAddress:    auditIP(r),
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "File restored"})
}

// DELETE /api/v1/files/{id}/permanent
func (h *FilesHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	fileSize := file.Size

	if !file.IsFolder && file.StoragePath != nil {
		// Atomically lock, check references, and delete blob.
		_ = h.db.Transaction(func(tx *gorm.DB) error {
			var refCount int64
			tx.Model(&models.File{}).
				Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("storage_path = ? AND id != ?", *file.StoragePath, file.ID).
				Count(&refCount)
			if refCount == 0 {
				h.backend.Delete(*file.StoragePath)
			}
			return nil
		})
	}

	h.db.Where("file_id = ?", file.ID).Delete(&models.Share{})
	h.db.Delete(&file)

	// Update storage used
	if fileSize > 0 {
		h.db.Model(&models.User{}).Where("id = ?", userID).
			UpdateColumn("storage_used", gorm.Expr("GREATEST(storage_used - ?, 0)", fileSize))
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "File permanently deleted"})
}

// POST /api/v1/files/{id}/share
func (h *FilesHandler) ShareFile(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	var req struct {
		IsPublic      bool       `json:"isPublic"`
		GranteeEmail  *string    `json:"granteeEmail"`
		GranteeUserID *uuid.UUID `json:"granteeUserId"`
		Permission    string     `json:"permission"`
		ExpiresAt     *time.Time `json:"expiresAt"`
		Password      *string    `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Permission == "" {
		req.Permission = "read"
	}

	share := &models.Share{
		ID:         uuid.New(),
		FileID:     fileID,
		CreatedBy:  userID,
		IsPublic:   req.IsPublic,
		Permission: req.Permission,
		ExpiresAt:  req.ExpiresAt,
	}

	if req.IsPublic {
		token := uuid.New().String()
		share.ShareToken = &token
		share.Password = req.Password
	} else {
		if req.GranteeUserID != nil {
			share.GranteeUserID = req.GranteeUserID
		} else if req.GranteeEmail != nil {
			email := strings.ToLower(strings.TrimSpace(*req.GranteeEmail))
			share.GranteeEmail = &email

			// Try to find user by email
			var granteeUser models.User
			if err := h.db.Where("email = ?", email).First(&granteeUser).Error; err == nil {
				share.GranteeUserID = &granteeUser.ID
			}
		} else {
			writeError(w, http.StatusBadRequest, "granteeEmail or granteeUserId is required for private shares")
			return
		}
	}

	if err := h.db.Create(share).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create share")
		return
	}

	share.HasPassword = share.Password != nil

	type shareResponse struct {
		*models.Share
		PublicLink string `json:"publicLink,omitempty"`
	}
	resp := shareResponse{Share: share}
	if req.IsPublic && share.ShareToken != nil {
		resp.PublicLink = h.cfg.FrontendURL + "/share/" + *share.ShareToken
	}

	var auditUser models.User
	h.db.Select("name, email").First(&auditUser, "id = ?", userID)
	shareType := "private"
	if req.IsPublic {
		shareType = "public"
	}
	LogAudit(h.db, AuditEntry{
		UserID:       &userID,
		UserName:     auditUser.Name,
		UserEmail:    auditUser.Email,
		Action:       "share.create",
		ResourceType: "file",
		ResourceName: file.Name,
		ResourceID:   file.ID.String(),
		IPAddress:    auditIP(r),
		Metadata:     models.JSONB{"share_type": shareType, "permission": req.Permission},
	})

	writeJSON(w, http.StatusCreated, resp)
}

// resolveFilePath walks parentID up the folder tree and returns a slash-joined
// path string (e.g. "Home / Notes / Work"). Returns "Home" when parentID is nil.
// isDescendantOf returns true when candidateID is equal to ancestorID or is
// nested inside it.  It walks up the parent chain so it detects moves that
// would create a cycle (e.g. moving a folder into one of its own sub-folders).
func isDescendantOf(db *gorm.DB, candidateID, ancestorID uuid.UUID) bool {
	id := &candidateID
	for id != nil {
		if *id == ancestorID {
			return true
		}
		var f models.File
		if err := db.Select("id, parent_id").First(&f, "id = ?", id).Error; err != nil {
			break
		}
		id = f.ParentID
	}
	return false
}

func resolveFilePath(db *gorm.DB, parentID *uuid.UUID) string {
	if parentID == nil {
		return "Home"
	}
	var parts []string
	id := parentID
	for id != nil {
		var folder models.File
		if err := db.Select("id, name, parent_id").First(&folder, "id = ?", id).Error; err != nil {
			break
		}
		parts = append([]string{folder.Name}, parts...)
		id = folder.ParentID
	}
	if len(parts) == 0 {
		return "Home"
	}
	return "Home / " + strings.Join(parts, " / ")
}
