package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"path/filepath"
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

type SpacesHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	crypto  *crypto.Crypto
	backend storage.Backend
}

func NewSpacesHandler(db *gorm.DB, cfg *config.Config, c *crypto.Crypto, backend storage.Backend) *SpacesHandler {
	return &SpacesHandler{db: db, cfg: cfg, crypto: c, backend: backend}
}

// spaceRole returns the caller's role in the space, or "" if not a member.
func spaceRole(db *gorm.DB, spaceID, userID uuid.UUID) string {
	var m models.SpaceMember
	if err := db.Where("space_id = ? AND user_id = ?", spaceID, userID).First(&m).Error; err != nil {
		return ""
	}
	return m.Role
}

// canWrite returns true if role allows uploads/creates/renames.
func canWrite(role string) bool {
	return role == models.SpaceRoleContributor || role == models.SpaceRoleAdmin
}

// isSpaceAdminOrGlobal returns true if space-admin, global admin, or owner.
func isSpaceAdminOrGlobal(spaceRole, userRole string) bool {
	return spaceRole == models.SpaceRoleAdmin || userRole == "admin" || userRole == "owner"
}

func (h *SpacesHandler) logActivity(spaceID, userID uuid.UUID, action string, fileID *uuid.UUID, fileName *string, details models.JSONB) {
	act := &models.SpaceActivity{
		SpaceID:  spaceID,
		UserID:   &userID,
		Action:   action,
		FileID:   fileID,
		FileName: fileName,
		Details:  details,
	}
	if err := h.db.Create(act).Error; err != nil {
		slog.Warn("failed to log space activity", "error", err)
	}
}

// GET /api/v1/spaces
func (h *SpacesHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var members []models.SpaceMember
	h.db.Where("user_id = ?", userID).Find(&members)

	if len(members) == 0 {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	spaceIDs := make([]uuid.UUID, len(members))
	roleBySpace := make(map[uuid.UUID]string, len(members))
	for i, m := range members {
		spaceIDs[i] = m.SpaceID
		roleBySpace[m.SpaceID] = m.Role
	}

	var spaces []models.Space
	h.db.Where("id IN ?", spaceIDs).Find(&spaces)

	type spaceResp struct {
		models.Space
		MyRole      string `json:"my_role"`
		MemberCount int    `json:"member_count"`
	}

	result := make([]spaceResp, len(spaces))
	for i, s := range spaces {
		var count int64
		h.db.Model(&models.SpaceMember{}).Where("space_id = ?", s.ID).Count(&count)
		result[i] = spaceResp{
			Space:       s,
			MyRole:      roleBySpace[s.ID],
			MemberCount: int(count),
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// POST /api/v1/spaces — admin/owner only; creates space and enrolls all existing users
func (h *SpacesHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	if claims.Role != "admin" && claims.Role != "owner" {
		writeError(w, http.StatusForbidden, "Only admins can create spaces")
		return
	}

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
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

	space := &models.Space{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		CreatedBy:   &userID,
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(space).Error; err != nil {
			return err
		}

		// Enroll all existing users as contributors
		var users []models.User
		tx.Find(&users)

		members := make([]models.SpaceMember, 0, len(users))
		for _, u := range users {
			role := models.SpaceRoleContributor
			if u.Role == "admin" || u.Role == "owner" {
				role = models.SpaceRoleAdmin
			}
			members = append(members, models.SpaceMember{
				SpaceID: space.ID,
				UserID:  u.ID,
				Role:    role,
				AddedBy: &userID,
			})
		}
		if len(members) > 0 {
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&members).Error
		}
		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create space")
		return
	}

	writeJSON(w, http.StatusCreated, space)
}

// GET /api/v1/spaces/:id/files
func (h *SpacesHandler) GetFiles(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	if spaceRole(h.db, spaceID, userID) == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}

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
	category := q.Get("category") // photos|docs|videos|audio|code|others|""

	offset := (page - 1) * limit

	parentIDStr := q.Get("parentId")

	query := h.db.Model(&models.File{}).
		Where("space_id = ? AND deleted_at IS NULL", spaceID)

	// Category views are always flat (files only, no folder hierarchy)
	if category != "" {
		query = query.Where("is_folder = false")
	}

	// For "All Files" (no category), filter by parent folder
	if category == "" {
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
	}

	if search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	switch category {
	case "photos":
		query = query.Where("mime_type ILIKE 'image/%'")
	case "videos":
		query = query.Where("mime_type ILIKE 'video/%'")
	case "audio":
		query = query.Where("mime_type ILIKE 'audio/%'")
	case "docs":
		query = query.Where(
			"mime_type ILIKE 'application/pdf' OR " +
				"mime_type ILIKE 'application/msword' OR " +
				"mime_type ILIKE 'application/vnd.openxmlformats%' OR " +
				"mime_type ILIKE 'application/vnd.ms-%' OR " +
				"mime_type ILIKE 'text/plain' OR " +
				"mime_type ILIKE 'text/csv'",
		)
	case "code":
		query = query.Where(
			"mime_type ILIKE 'text/%' AND mime_type NOT ILIKE 'text/plain' AND mime_type NOT ILIKE 'text/csv' OR " +
				"mime_type ILIKE 'application/json' OR " +
				"mime_type ILIKE 'application/xml' OR " +
				"mime_type ILIKE 'application/javascript' OR " +
				"mime_type ILIKE 'application/typescript'",
		)
	case "others":
		query = query.Where(
			"mime_type NOT ILIKE 'image/%' AND " +
				"mime_type NOT ILIKE 'video/%' AND " +
				"mime_type NOT ILIKE 'audio/%' AND " +
				"mime_type NOT ILIKE 'application/pdf' AND " +
				"mime_type NOT ILIKE 'application/msword' AND " +
				"mime_type NOT ILIKE 'application/vnd.%' AND " +
				"mime_type NOT ILIKE 'text/%' AND " +
				"mime_type NOT ILIKE 'application/json' AND " +
				"mime_type NOT ILIKE 'application/xml' AND " +
				"mime_type NOT ILIKE 'application/javascript'",
		)
	}

	var total int64
	query.Count(&total)

	var files []models.File
	query.Preload("Owner").
		Order("is_folder DESC, name ASC").
		Offset(offset).Limit(limit).
		Find(&files)

	// Compute folder sizes
	for i := range files {
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

// POST /api/v1/spaces/:id/files — create file record (before upload)
func (h *SpacesHandler) CreateFile(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	role := spaceRole(h.db, spaceID, userID)
	if role == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}
	if !canWrite(role) {
		writeError(w, http.StatusForbidden, "Viewer role cannot upload files")
		return
	}

	var req struct {
		Name     string     `json:"name"`
		IsFolder bool       `json:"isFolder"`
		ParentID *uuid.UUID `json:"parentId"`
		MimeType *string    `json:"mimeType"`
		Size     int64      `json:"size"`
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

	// Verify parent folder belongs to this space
	if req.ParentID != nil {
		var parent models.File
		if err := h.db.Where("id = ? AND space_id = ? AND is_folder = true AND deleted_at IS NULL", req.ParentID, spaceID).First(&parent).Error; err != nil {
			writeError(w, http.StatusNotFound, "Parent folder not found in this space")
			return
		}
	}

	file := &models.File{
		ID:       uuid.New(),
		OwnerID:  userID,
		SpaceID:  &spaceID,
		Name:     req.Name,
		IsFolder: req.IsFolder,
		ParentID: req.ParentID,
		MimeType: req.MimeType,
		Size:     req.Size,
	}

	if err := h.db.Create(file).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create file")
		return
	}

	resp := map[string]interface{}{
		"id":         file.ID,
		"owner_id":   file.OwnerID,
		"space_id":   file.SpaceID,
		"name":       file.Name,
		"is_folder":  file.IsFolder,
		"parent_id":  file.ParentID,
		"mime_type":  file.MimeType,
		"size":       file.Size,
		"created_at": file.CreatedAt,
		"updated_at": file.UpdatedAt,
	}
	if !file.IsFolder {
		resp["uploadUrl"] = fmt.Sprintf("/api/v1/spaces/%s/files/%s/upload", spaceID, file.ID)
	}
	if req.IsFolder {
		h.logActivity(spaceID, userID, "create_folder", &file.ID, &file.Name, nil)
	}
	writeJSON(w, http.StatusCreated, resp)
}

// PUT /api/v1/spaces/:id/files/:fid/upload
func (h *SpacesHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}
	fileID, err := uuid.Parse(chi.URLParam(r, "fid"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	role := spaceRole(h.db, spaceID, userID)
	if role == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}
	if !canWrite(role) {
		writeError(w, http.StatusForbidden, "Viewer role cannot upload files")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND space_id = ? AND deleted_at IS NULL", fileID, spaceID).First(&file).Error; err != nil {
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

	const maxUploadSize = 15 * 1024 * 1024 * 1024
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if h.crypto == nil {
		writeError(w, http.StatusInternalServerError, "Encryption not configured")
		return
	}

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

	// Detect MIME type
	mimeType := "application/octet-stream"
	if ext := filepath.Ext(file.Name); ext != "" {
		if extMime := mime.TypeByExtension(ext); extMime != "" {
			mimeType = extMime
		}
	}
	if mimeType == "application/octet-stream" {
		if tf, err := os.Open(tmpPath); err == nil {
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

	// Deduplication check (within the space)
	var computedHash string
	if storage.ShouldDedup(file.Name) {
		computedHash = hex.EncodeToString(hasher.Sum(nil))

		var dedupDone bool
		dedupErr := h.db.Transaction(func(tx *gorm.DB) error {
			var existing models.File
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where(
					"space_id = ? AND file_hash = ? AND is_folder = false AND deleted_at IS NULL AND storage_path IS NOT NULL",
					spaceID, computedHash,
				).First(&existing).Error

			if err != nil || existing.StoragePath == nil {
				return nil
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
			h.logActivity(spaceID, userID, models.SpaceActionUpload, &file.ID, &file.Name, nil)
			writeJSON(w, http.StatusOK, file)
			return
		}
	}

	// Generate encryption keys
	dek, iv, storedEncryptedDEK, algo, err := h.crypto.CreateEncryptionKeys()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate encryption keys")
		return
	}

	// Space files use a distinct storage path to avoid collisions with personal files
	storagePath := fmt.Sprintf("spaces/%s/%s.enc", spaceID.String(), fileID.String())

	plainReader, err := os.Open(tmpPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to open temp file")
		return
	}
	defer plainReader.Close()

	pr, pw := io.Pipe()
	var encErr error
	go func() {
		_, encErr = crypto.EncryptStream(plainReader, pw, dek, iv)
		if encErr != nil {
			pw.CloseWithError(encErr)
		} else {
			pw.Close()
		}
	}()

	if _, err := h.backend.Write(storagePath, pr); err != nil {
		slog.Error("failed to write encrypted space file", "error", err, "path", storagePath)
		writeError(w, http.StatusInternalServerError, "Failed to store file")
		return
	}

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

	// NOTE: space uploads intentionally do NOT increment the uploader's storage_used
	file.Size = plainSize
	mimeStr := mimeType
	file.MimeType = &mimeStr
	file.StoragePath = &storagePath
	if computedHash != "" {
		file.FileHash = &computedHash
	}

	h.logActivity(spaceID, userID, models.SpaceActionUpload, &file.ID, &file.Name, nil)
	writeJSON(w, http.StatusOK, file)
}

// GET /api/v1/spaces/:id/files/:fid/download
func (h *SpacesHandler) Download(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}
	fileID, err := uuid.Parse(chi.URLParam(r, "fid"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	if spaceRole(h.db, spaceID, userID) == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND space_id = ? AND deleted_at IS NULL", fileID, spaceID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}
	if file.IsFolder {
		writeError(w, http.StatusBadRequest, "Cannot download a folder")
		return
	}
	if file.StoragePath == nil {
		writeError(w, http.StatusNotFound, "File data not found")
		return
	}

	h.streamDecryptedFile(w, r, &file)
}

func (h *SpacesHandler) streamDecryptedFile(w http.ResponseWriter, r *http.Request, file *models.File) {
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
		w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))
		w.WriteHeader(http.StatusOK)
		if err := crypto.DecryptStream(rc, w, dek, file.EncryptionIV); err != nil {
			slog.Error("stream decrypt failed", "file_id", file.ID, "err", err)
		}
		return
	}

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

// PATCH /api/v1/spaces/:id/files/:fid
func (h *SpacesHandler) RenameFile(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}
	fileID, err := uuid.Parse(chi.URLParam(r, "fid"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	role := spaceRole(h.db, spaceID, userID)
	if role == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
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
	if err := h.db.Where("id = ? AND space_id = ? AND deleted_at IS NULL", fileID, spaceID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	// Contributors can only rename/move their own files
	if file.OwnerID != userID && !isSpaceAdminOrGlobal(role, claims.Role) {
		writeError(w, http.StatusForbidden, "Cannot modify another member's file")
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
		if err := h.db.Where("id = ? AND space_id = ? AND is_folder = true AND deleted_at IS NULL", *req.ParentID, spaceID).First(&parent).Error; err != nil {
			writeError(w, http.StatusNotFound, "Target folder not found in this space")
			return
		}
		updates["parent_id"] = *req.ParentID
	}

	if len(updates) == 0 {
		writeJSON(w, http.StatusOK, file)
		return
	}

	oldName := file.Name
	if err := h.db.Model(&file).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update file")
		return
	}

	if req.Name != nil {
		h.logActivity(spaceID, userID, models.SpaceActionRename, &file.ID, req.Name,
			models.JSONB{"old_name": oldName, "new_name": *req.Name})
	}
	if req.ParentID != nil || req.MoveToRoot {
		h.logActivity(spaceID, userID, models.SpaceActionMove, &file.ID, &file.Name, nil)
	}

	h.db.Where("id = ?", fileID).First(&file)
	writeJSON(w, http.StatusOK, file)
}

// DELETE /api/v1/spaces/:id/files/:fid
func (h *SpacesHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}
	fileID, err := uuid.Parse(chi.URLParam(r, "fid"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	role := spaceRole(h.db, spaceID, userID)
	if role == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND space_id = ? AND deleted_at IS NULL", fileID, spaceID).First(&file).Error; err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	// Contributors can only delete their own files
	if file.OwnerID != userID && !isSpaceAdminOrGlobal(role, claims.Role) {
		writeError(w, http.StatusForbidden, "Cannot delete another member's file")
		return
	}

	fileName := file.Name

	// Permanently delete space files (no trash for team space)
	if !file.IsFolder && file.StoragePath != nil {
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

	h.db.Delete(&file)

	h.logActivity(spaceID, userID, models.SpaceActionDelete, &fileID, &fileName, nil)
	writeJSON(w, http.StatusOK, map[string]string{"message": "File deleted"})
}

// GET /api/v1/spaces/:id/members
func (h *SpacesHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	if spaceRole(h.db, spaceID, userID) == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}

	var members []models.SpaceMember
	h.db.Where("space_id = ?", spaceID).Preload("User").Order("added_at ASC").Find(&members)

	writeJSON(w, http.StatusOK, members)
}

// PATCH /api/v1/spaces/:id/members/:uid
func (h *SpacesHandler) UpdateMember(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}
	targetUID, err := uuid.Parse(chi.URLParam(r, "uid"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	role := spaceRole(h.db, spaceID, userID)
	if !isSpaceAdminOrGlobal(role, claims.Role) {
		writeError(w, http.StatusForbidden, "Only space admins can update member roles")
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Role != models.SpaceRoleViewer && req.Role != models.SpaceRoleContributor && req.Role != models.SpaceRoleAdmin {
		writeError(w, http.StatusBadRequest, "role must be viewer, contributor, or admin")
		return
	}

	result := h.db.Model(&models.SpaceMember{}).
		Where("space_id = ? AND user_id = ?", spaceID, targetUID).
		Update("role", req.Role)
	if result.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "Member not found")
		return
	}

	h.logActivity(spaceID, userID, models.SpaceActionMemberRoleChanged, nil, nil,
		models.JSONB{"target_user_id": targetUID.String(), "new_role": req.Role})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Member role updated"})
}

// DELETE /api/v1/spaces/:id/members/:uid
func (h *SpacesHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}
	targetUID, err := uuid.Parse(chi.URLParam(r, "uid"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	role := spaceRole(h.db, spaceID, userID)
	if !isSpaceAdminOrGlobal(role, claims.Role) {
		writeError(w, http.StatusForbidden, "Only space admins can remove members")
		return
	}

	result := h.db.Where("space_id = ? AND user_id = ?", spaceID, targetUID).Delete(&models.SpaceMember{})
	if result.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "Member not found")
		return
	}

	h.logActivity(spaceID, userID, models.SpaceActionMemberRemoved, nil, nil,
		models.JSONB{"target_user_id": targetUID.String()})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Member removed"})
}

// GET /api/v1/spaces/:id/activity
func (h *SpacesHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	spaceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid space ID")
		return
	}

	if spaceRole(h.db, spaceID, userID) == "" {
		writeError(w, http.StatusForbidden, "Not a member of this space")
		return
	}

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 30
	}
	offset := (page - 1) * limit

	var total int64
	h.db.Model(&models.SpaceActivity{}).Where("space_id = ?", spaceID).Count(&total)

	var activities []models.SpaceActivity
	h.db.Where("space_id = ?", spaceID).
		Preload("User").
		Order("created_at DESC").
		Offset(offset).Limit(limit).
		Find(&activities)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": activities,
		"meta": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// AutoEnrollUserInSpaces adds a newly registered user to all existing spaces as contributor.
// Called from auth.Register after user creation.
func AutoEnrollUserInSpaces(db *gorm.DB, userID uuid.UUID, userRole string) {
	var spaces []models.Space
	if err := db.Find(&spaces).Error; err != nil || len(spaces) == 0 {
		return
	}

	role := models.SpaceRoleContributor
	if userRole == "admin" || userRole == "owner" {
		role = models.SpaceRoleAdmin
	}

	members := make([]models.SpaceMember, len(spaces))
	for i, s := range spaces {
		members[i] = models.SpaceMember{
			SpaceID: s.ID,
			UserID:  userID,
			Role:    role,
		}
	}
	db.Clauses(clause.OnConflict{DoNothing: true}).Create(&members)
}

// SpaceBootstrap ensures a default "Team" space exists and all users are enrolled.
// Called once at startup after the DB schema is verified.
func SpaceBootstrap(db *gorm.DB) {
	var count int64
	db.Model(&models.Space{}).Count(&count)
	if count > 0 {
		return // spaces already exist
	}

	var userCount int64
	db.Model(&models.User{}).Count(&userCount)
	if userCount == 0 {
		return // no users yet; space will be created when admin first registers
	}

	// Find the first owner to credit as creator
	var owner models.User
	if err := db.Where("role = 'owner'").First(&owner).Error; err != nil {
		db.First(&owner) // fall back to any user
	}

	space := &models.Space{
		ID:        uuid.New(),
		Name:      "Team",
		CreatedBy: &owner.ID,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(space).Error; err != nil {
			return err
		}
		var users []models.User
		tx.Find(&users)
		members := make([]models.SpaceMember, len(users))
		for i, u := range users {
			role := models.SpaceRoleContributor
			if u.Role == "admin" || u.Role == "owner" {
				role = models.SpaceRoleAdmin
			}
			members[i] = models.SpaceMember{
				SpaceID: space.ID,
				UserID:  u.ID,
				Role:    role,
				AddedBy: &owner.ID,
			}
		}
		if len(members) > 0 {
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&members).Error
		}
		return nil
	})

	if err != nil {
		slog.Error("failed to bootstrap Team space", "error", err)
	} else {
		slog.Info("bootstrapped Team space", "space_id", space.ID, "enrolled_users", userCount)
	}
}

// timeAgo formats a time.Time as a human-readable relative string.
// Unused by the handler but exported for potential template use.
func timeAgo(t time.Time) string {
	diff := time.Since(t)
	switch {
	case diff < time.Minute:
		return "just now"
	case diff < time.Hour:
		return fmt.Sprintf("%dm ago", int(diff.Minutes()))
	case diff < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(diff.Hours()))
	default:
		return fmt.Sprintf("%dd ago", int(diff.Hours()/24))
	}
}
