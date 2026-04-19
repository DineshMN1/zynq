package handlers

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"hash"
	"io"
	"log/slog"
	"math"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zynqcloud/api/internal/crypto"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"github.com/zynqcloud/api/internal/storage"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	uploadChunkSizeBytes = int64(25 * 1024 * 1024)
	uploadSessionTTL     = 24 * time.Hour
)

type uploadSessionManifest struct {
	FileID         string           `json:"fileId"`
	OwnerID        string           `json:"ownerId"`
	FileName       string           `json:"fileName"`
	MimeType       string           `json:"mimeType"`
	Size           int64            `json:"size"`
	ChunkSize      int64            `json:"chunkSize"`
	TotalChunks    int              `json:"totalChunks"`
	UploadedChunks []int            `json:"uploadedChunks"`
	ChunkSizes     map[string]int64 `json:"chunkSizes"`
	CreatedAt      time.Time        `json:"createdAt"`
	UpdatedAt      time.Time        `json:"updatedAt"`
	ExpiresAt      time.Time        `json:"expiresAt"`
}

type uploadSessionInfo struct {
	SessionID      string `json:"sessionId"`
	FileID         string `json:"fileId"`
	ChunkSize      int64  `json:"chunkSize"`
	TotalChunks    int    `json:"totalChunks"`
	UploadedChunks []int  `json:"uploadedChunks"`
	UploadedBytes  int64  `json:"uploadedBytes"`
	NextChunk      int    `json:"nextChunk"`
	ExpiresAt      string `json:"expiresAt"`
	UploadURL      string `json:"uploadUrl"`
	CompleteURL    string `json:"completeUrl"`
}

func (h *FilesHandler) uploadRootDir() (string, error) {
	local, ok := h.backend.(*storage.Local)
	if !ok {
		return "", fmt.Errorf("chunked uploads require local storage backend")
	}
	root := filepath.Join(local.Root(), ".uploads")
	if err := os.MkdirAll(root, 0o750); err != nil {
		return "", err
	}
	return root, nil
}

func uploadSessionDir(root, fileID, sessionID string) string {
	return filepath.Join(root, fileID, sessionID)
}

func uploadSessionManifestPath(root, fileID, sessionID string) string {
	return filepath.Join(uploadSessionDir(root, fileID, sessionID), "manifest.json")
}

func uploadChunkPath(root, fileID, sessionID string, index int) string {
	return filepath.Join(uploadSessionDir(root, fileID, sessionID), fmt.Sprintf("chunk-%06d.part", index))
}

func writeUploadSessionManifest(path string, manifest uploadSessionManifest) error {
	manifest.UpdatedAt = time.Now().UTC()
	payload, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, payload, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func readUploadSessionManifest(path string) (uploadSessionManifest, error) {
	var manifest uploadSessionManifest
	data, err := os.ReadFile(path)
	if err != nil {
		return manifest, err
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return manifest, err
	}
	return manifest, nil
}

func containsChunkIndex(indices []int, idx int) bool {
	for _, v := range indices {
		if v == idx {
			return true
		}
	}
	return false
}

func uploadedBytes(manifest uploadSessionManifest) int64 {
	var total int64
	for _, idx := range manifest.UploadedChunks {
		if size, ok := manifest.ChunkSizes[strconv.Itoa(idx)]; ok {
			total += size
		}
	}
	return total
}

func nextMissingChunk(manifest uploadSessionManifest) int {
	for i := 0; i < manifest.TotalChunks; i++ {
		if !containsChunkIndex(manifest.UploadedChunks, i) {
			return i
		}
	}
	return manifest.TotalChunks
}

func (h *FilesHandler) loadOwnedUploadFile(r *http.Request) (*models.File, *models.User, error) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	fileIDStr := chi.URLParam(r, "id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid file ID")
	}

	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND deleted_at IS NULL AND space_id IS NULL", fileID, userID).First(&file).Error; err != nil {
		return nil, nil, gorm.ErrRecordNotFound
	}
	if file.IsFolder {
		return nil, nil, fmt.Errorf("cannot upload to a folder")
	}
	if blockedExtensionsRe.MatchString(file.Name) {
		return nil, nil, fmt.Errorf("file type not allowed")
	}

	var user models.User
	h.db.First(&user, "id = ?", userID)
	return &file, &user, nil
}

func (h *FilesHandler) commitUploadedTempFile(
	w http.ResponseWriter,
	r *http.Request,
	file *models.File,
	user *models.User,
	tmpPath string,
	plainSize int64,
	hasher hash.Hash,
) bool {
	if plainSize == 0 {
		writeError(w, http.StatusBadRequest, "Empty file body")
		return false
	}

	if user.StorageLimit > 0 && user.StorageUsed+plainSize > user.StorageLimit {
		writeError(w, http.StatusForbidden, "Storage limit exceeded")
		return false
	}

	if localBackend, ok := h.backend.(*storage.Local); ok {
		if avail, _ := localBackend.DiskStats(); avail > 0 {
			minFree := uint64(h.cfg.MinFreeBytes)
			if avail < uint64(plainSize)+minFree {
				writeError(w, http.StatusInsufficientStorage, "Insufficient disk space")
				return false
			}
		}
	}

	mimeType := "application/octet-stream"
	if ext := filepath.Ext(file.Name); ext != "" {
		if extMime := mime.TypeByExtension(ext); extMime != "" {
			mimeType = extMime
		}
	}
	if mimeType == "application/octet-stream" {
		if tf, err := os.Open(tmpPath); err == nil { // #nosec G304 -- tmpPath from CreateTemp
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

	var computedHash string
	if storage.ShouldDedup(file.Name) {
		computedHash = fmt.Sprintf("%x", hasher.Sum(nil))

		var dedupDone bool
		dedupErr := h.db.Transaction(func(tx *gorm.DB) error {
			var existing models.File
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where(
					"owner_id = ? AND file_hash = ? AND is_folder = false AND deleted_at IS NULL AND storage_path IS NOT NULL AND space_id IS NULL",
					user.ID, computedHash,
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
			if err := tx.Model(file).Updates(updates).Error; err != nil {
				return err
			}
			tx.Model(&models.User{}).Where("id = ?", user.ID).
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
			return false
		}
		if dedupDone {
			LogAudit(h.db, AuditEntry{
				UserID:       &user.ID,
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
			return true
		}
	}

	dek, iv, storedEncryptedDEK, algo, err := h.crypto.CreateEncryptionKeys()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate encryption keys")
		return false
	}

	storagePath := fmt.Sprintf("%s/%s.enc", user.ID.String(), file.ID.String())

	plainReader, err := os.Open(tmpPath) // #nosec G304 -- tmpPath from CreateTemp
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to open temp file")
		return false
	}
	defer plainReader.Close()

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
	encErr := <-encErrCh
	if encErr != nil {
		slog.Error("failed to encrypt file", "error", encErr, "path", storagePath)
		_ = h.backend.Delete(storagePath)
		writeError(w, http.StatusInternalServerError, "Failed to encrypt file")
		return false
	}
	if writeErr != nil {
		slog.Error("failed to write encrypted file", "error", writeErr, "path", storagePath)
		writeError(w, http.StatusInternalServerError, "Failed to store file")
		return false
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

	if err := h.db.Model(file).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update file record")
		return false
	}

	h.db.Model(&models.User{}).Where("id = ?", user.ID).
		UpdateColumn("storage_used", gorm.Expr("storage_used + ?", plainSize))

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
		UserID:       &user.ID,
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
	return true
}

// POST /api/v1/files/{id}/upload-session
func (h *FilesHandler) StartUploadSession(w http.ResponseWriter, r *http.Request) {
	file, user, err := h.loadOwnedUploadFile(r)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeError(w, http.StatusNotFound, "File not found")
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	if file.StoragePath != nil {
		writeError(w, http.StatusConflict, "File already uploaded")
		return
	}

	root, err := h.uploadRootDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create upload session storage")
		return
	}

	sessionID := uuid.NewString()
	dir := uploadSessionDir(root, file.ID.String(), sessionID)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create upload session")
		return
	}

	totalChunks := int(math.Ceil(float64(file.Size) / float64(uploadChunkSizeBytes)))
	if file.Size == 0 {
		totalChunks = 0
	}
	now := time.Now().UTC()
	manifest := uploadSessionManifest{
		FileID:   file.ID.String(),
		OwnerID:  user.ID.String(),
		FileName: file.Name,
		Size:     file.Size,
		MimeType: func() string {
			if file.MimeType != nil {
				return *file.MimeType
			}
			return ""
		}(),
		ChunkSize:      uploadChunkSizeBytes,
		TotalChunks:    totalChunks,
		UploadedChunks: []int{},
		ChunkSizes:     map[string]int64{},
		CreatedAt:      now,
		UpdatedAt:      now,
		ExpiresAt:      now.Add(uploadSessionTTL),
	}
	if err := writeUploadSessionManifest(uploadSessionManifestPath(root, file.ID.String(), sessionID), manifest); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create upload session manifest")
		return
	}

	info := uploadSessionInfo{
		SessionID:      sessionID,
		FileID:         file.ID.String(),
		ChunkSize:      uploadChunkSizeBytes,
		TotalChunks:    totalChunks,
		UploadedChunks: []int{},
		UploadedBytes:  0,
		NextChunk:      0,
		ExpiresAt:      manifest.ExpiresAt.Format(time.RFC3339),
		UploadURL:      fmt.Sprintf("/api/v1/files/%s/upload-session/%s/chunks", file.ID, sessionID),
		CompleteURL:    fmt.Sprintf("/api/v1/files/%s/upload-session/%s/complete", file.ID, sessionID),
	}

	writeJSON(w, http.StatusCreated, info)
}

// GET /api/v1/files/{id}/upload-session/{sessionId}
func (h *FilesHandler) GetUploadSession(w http.ResponseWriter, r *http.Request) {
	_, _, err := h.loadOwnedUploadFile(r)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeError(w, http.StatusNotFound, "File not found")
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	root, err := h.uploadRootDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read upload session")
		return
	}
	fileID := chi.URLParam(r, "id")
	sessionID := chi.URLParam(r, "sessionId")
	manifest, err := readUploadSessionManifest(uploadSessionManifestPath(root, fileID, sessionID))
	if err != nil {
		writeError(w, http.StatusNotFound, "Upload session not found")
		return
	}

	info := uploadSessionInfo{
		SessionID:      sessionID,
		FileID:         fileID,
		ChunkSize:      manifest.ChunkSize,
		TotalChunks:    manifest.TotalChunks,
		UploadedChunks: append([]int(nil), manifest.UploadedChunks...),
		UploadedBytes:  uploadedBytes(manifest),
		NextChunk:      nextMissingChunk(manifest),
		ExpiresAt:      manifest.ExpiresAt.Format(time.RFC3339),
		UploadURL:      fmt.Sprintf("/api/v1/files/%s/upload-session/%s/chunks", fileID, sessionID),
		CompleteURL:    fmt.Sprintf("/api/v1/files/%s/upload-session/%s/complete", fileID, sessionID),
	}
	writeJSON(w, http.StatusOK, info)
}

// PUT /api/v1/files/{id}/upload-session/{sessionId}/chunks/{index}
func (h *FilesHandler) UploadChunk(w http.ResponseWriter, r *http.Request) {
	file, user, err := h.loadOwnedUploadFile(r)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeError(w, http.StatusNotFound, "File not found")
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	root, err := h.uploadRootDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read upload session")
		return
	}
	fileID := chi.URLParam(r, "id")
	sessionID := chi.URLParam(r, "sessionId")
	indexStr := chi.URLParam(r, "index")
	index, err := strconv.Atoi(indexStr)
	if err != nil || index < 0 {
		writeError(w, http.StatusBadRequest, "Invalid chunk index")
		return
	}

	manifestPath := uploadSessionManifestPath(root, fileID, sessionID)
	manifest, err := readUploadSessionManifest(manifestPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "Upload session not found")
		return
	}
	if manifest.FileID != file.ID.String() || manifest.OwnerID != user.ID.String() {
		writeError(w, http.StatusForbidden, "Upload session not found")
		return
	}
	if time.Now().UTC().After(manifest.ExpiresAt) {
		writeError(w, http.StatusGone, "Upload session expired")
		return
	}
	if manifest.TotalChunks > 0 && index >= manifest.TotalChunks {
		writeError(w, http.StatusBadRequest, "Chunk index out of range")
		return
	}

	dir := uploadSessionDir(root, fileID, sessionID)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to prepare upload session")
		return
	}

	tmpChunk, err := os.CreateTemp(dir, fmt.Sprintf(".chunk-%06d-*", index))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create chunk")
		return
	}
	tmpPath := tmpChunk.Name()

	r.Body = http.MaxBytesReader(w, r.Body, uploadChunkSizeBytes+1)
	written, copyErr := io.Copy(tmpChunk, r.Body)
	closeErr := tmpChunk.Close()
	if copyErr != nil || closeErr != nil {
		os.Remove(tmpPath)
		if copyErr != nil {
			writeError(w, http.StatusInternalServerError, "Upload interrupted — please try again")
		} else {
			writeError(w, http.StatusInternalServerError, "Failed to finish chunk upload")
		}
		return
	}

	chunkPath := uploadChunkPath(root, fileID, sessionID, index)
	if err := os.Rename(tmpPath, chunkPath); err != nil {
		os.Remove(tmpPath)
		writeError(w, http.StatusInternalServerError, "Failed to store chunk")
		return
	}

	if containsChunkIndex(manifest.UploadedChunks, index) {
		// no-op
	} else {
		manifest.UploadedChunks = append(manifest.UploadedChunks, index)
		sort.Ints(manifest.UploadedChunks)
	}
	if manifest.ChunkSizes == nil {
		manifest.ChunkSizes = map[string]int64{}
	}
	manifest.ChunkSizes[strconv.Itoa(index)] = written
	manifest.UpdatedAt = time.Now().UTC()
	manifest.ExpiresAt = manifest.UpdatedAt.Add(uploadSessionTTL)
	if err := writeUploadSessionManifest(manifestPath, manifest); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update upload session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"sessionId":      sessionID,
		"chunkIndex":     index,
		"chunkBytes":     written,
		"uploadedBytes":  uploadedBytes(manifest),
		"nextChunk":      nextMissingChunk(manifest),
		"uploadedChunks": manifest.UploadedChunks,
		"totalChunks":    manifest.TotalChunks,
		"expiresAt":      manifest.ExpiresAt.Format(time.RFC3339),
	})
}

// POST /api/v1/files/{id}/upload-session/{sessionId}/complete
func (h *FilesHandler) CompleteUploadSession(w http.ResponseWriter, r *http.Request) {
	file, user, err := h.loadOwnedUploadFile(r)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeError(w, http.StatusNotFound, "File not found")
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	root, err := h.uploadRootDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read upload session")
		return
	}
	fileID := chi.URLParam(r, "id")
	sessionID := chi.URLParam(r, "sessionId")
	manifestPath := uploadSessionManifestPath(root, fileID, sessionID)
	manifest, err := readUploadSessionManifest(manifestPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "Upload session not found")
		return
	}
	if manifest.FileID != file.ID.String() || manifest.OwnerID != user.ID.String() {
		writeError(w, http.StatusForbidden, "Upload session not found")
		return
	}
	if time.Now().UTC().After(manifest.ExpiresAt) {
		writeError(w, http.StatusGone, "Upload session expired")
		return
	}
	if manifest.TotalChunks == 0 {
		writeError(w, http.StatusBadRequest, "Upload session is empty")
		return
	}

	chunkSet := make(map[int]struct{}, len(manifest.UploadedChunks))
	for _, idx := range manifest.UploadedChunks {
		chunkSet[idx] = struct{}{}
	}
	for i := 0; i < manifest.TotalChunks; i++ {
		if _, ok := chunkSet[i]; !ok {
			writeError(w, http.StatusConflict, fmt.Sprintf("Missing chunk %d", i))
			return
		}
	}

	assembled, err := os.CreateTemp(filepath.Dir(manifestPath), ".assembled-*")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to assemble upload")
		return
	}
	assembledPath := assembled.Name()
	hasher := sha256.New()
	var plainSize int64
	for i := 0; i < manifest.TotalChunks; i++ {
		chunkFile, err := os.Open(uploadChunkPath(root, fileID, sessionID, i))
		if err != nil {
			assembled.Close()
			os.Remove(assembledPath)
			writeError(w, http.StatusInternalServerError, "Missing upload chunk")
			return
		}
		n, copyErr := io.Copy(io.MultiWriter(assembled, hasher), chunkFile)
		chunkFile.Close()
		if copyErr != nil {
			assembled.Close()
			os.Remove(assembledPath)
			writeError(w, http.StatusInternalServerError, "Failed to read upload chunk")
			return
		}
		plainSize += n
	}
	if err := assembled.Close(); err != nil {
		os.Remove(assembledPath)
		writeError(w, http.StatusInternalServerError, "Failed to finalize upload assembly")
		return
	}

	if !h.commitUploadedTempFile(w, r, file, user, assembledPath, plainSize, hasher) {
		os.Remove(assembledPath)
		return
	}
	os.Remove(assembledPath)
	_ = os.RemoveAll(uploadSessionDir(root, fileID, sessionID))
}

// DELETE /api/v1/files/{id}/upload-session/{sessionId}
func (h *FilesHandler) AbortUploadSession(w http.ResponseWriter, r *http.Request) {
	file, _, err := h.loadOwnedUploadFile(r)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeError(w, http.StatusNotFound, "File not found")
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	root, err := h.uploadRootDir()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to abort upload session")
		return
	}
	sessionID := chi.URLParam(r, "sessionId")
	_ = os.RemoveAll(uploadSessionDir(root, file.ID.String(), sessionID))
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
