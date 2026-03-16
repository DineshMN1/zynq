package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"github.com/zynqcloud/api/internal/storage"
	"gorm.io/gorm"
)

type StorageStatsHandler struct {
	backend *storage.Local
	db      *gorm.DB
}

func NewStorageStatsHandler(backend *storage.Local, db *gorm.DB) *StorageStatsHandler {
	return &StorageStatsHandler{backend: backend, db: db}
}

// GET /api/v1/storage/overview
func (h *StorageStatsHandler) Overview(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	avail, total := h.backend.DiskStats()
	used := total - avail
	var usedPercentage float64
	if total > 0 {
		usedPercentage = float64(used) / float64(total) * 100
	}

	var user models.User
	h.db.First(&user, "id = ?", userID)

	var actualUsed int64
	h.db.Model(&models.File{}).
		Where("owner_id = ? AND deleted_at IS NULL AND is_folder = false", userID).
		Select("COALESCE(SUM(size), 0)").Scan(&actualUsed)
	if actualUsed != user.StorageUsed {
		h.db.Model(&user).UpdateColumn("storage_used", actualUsed)
	}

	// Admin/owner always have unlimited storage — fix stale DB records on the fly
	if (user.Role == "admin" || user.Role == "owner") && user.StorageLimit != 0 {
		h.db.Model(&user).UpdateColumn("storage_limit", 0)
		user.StorageLimit = 0
	}

	isUnlimited := user.StorageLimit == 0
	var userUsedPercentage float64
	var userFree int64
	if !isUnlimited {
		userUsedPercentage = float64(actualUsed) / float64(user.StorageLimit) * 100
		userFree = user.StorageLimit - actualUsed
		if userFree < 0 {
			userFree = 0
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"system": map[string]interface{}{
			"totalBytes":     total,
			"usedBytes":      used,
			"freeBytes":      avail,
			"usedPercentage": usedPercentage,
		},
		"user": map[string]interface{}{
			"usedBytes":      actualUsed,
			"quotaBytes":     user.StorageLimit,
			"freeBytes":      userFree,
			"usedPercentage": userUsedPercentage,
			"isUnlimited":    isUnlimited,
		},
	})
}

// GET /api/v1/storage/users
func (h *StorageStatsHandler) GetAllUsersStorage(w http.ResponseWriter, r *http.Request) {
	var users []models.User
	h.db.Find(&users)

	// Single query: sum file sizes per owner
	type usageRow struct {
		OwnerID string
		Used    int64
	}
	var rows []usageRow
	h.db.Model(&models.File{}).
		Where("deleted_at IS NULL AND is_folder = false").
		Select("owner_id, COALESCE(SUM(size), 0) AS used").
		Group("owner_id").
		Scan(&rows)

	usageByOwner := make(map[string]int64, len(rows))
	for _, row := range rows {
		usageByOwner[row.OwnerID] = row.Used
	}

	result := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		actualUsed := usageByOwner[u.ID.String()]
		if actualUsed != u.StorageUsed {
			h.db.Model(&u).UpdateColumn("storage_used", actualUsed)
		}
		var usedPct float64
		if u.StorageLimit > 0 {
			usedPct = float64(actualUsed) / float64(u.StorageLimit) * 100
		}
		result = append(result, map[string]interface{}{
			"userId":         u.ID,
			"name":           u.Name,
			"email":          u.Email,
			"role":           u.Role,
			"usedBytes":      actualUsed,
			"quotaBytes":     u.StorageLimit,
			"usedPercentage": usedPct,
			"isUnlimited":    u.StorageLimit == 0,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

// GET /api/v1/storage/users/{userId}
func (h *StorageStatsHandler) GetUserStorage(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	var actualUsed int64
	h.db.Model(&models.File{}).
		Where("owner_id = ? AND deleted_at IS NULL AND is_folder = false", userID).
		Select("COALESCE(SUM(size), 0)").Scan(&actualUsed)
	if actualUsed != user.StorageUsed {
		h.db.Model(&user).UpdateColumn("storage_used", actualUsed)
	}

	if (user.Role == "admin" || user.Role == "owner") && user.StorageLimit != 0 {
		h.db.Model(&user).UpdateColumn("storage_limit", 0)
		user.StorageLimit = 0
	}

	isUnlimited := user.StorageLimit == 0
	var usedPct float64
	var freeBytes int64
	if !isUnlimited {
		usedPct = float64(actualUsed) / float64(user.StorageLimit) * 100
		freeBytes = user.StorageLimit - actualUsed
		if freeBytes < 0 {
			freeBytes = 0
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"userId":          user.ID,
		"name":            user.Name,
		"email":           user.Email,
		"role":            user.Role,
		"usedBytes":       actualUsed,
		"quotaBytes":      user.StorageLimit,
		"freeBytes":       freeBytes,
		"actualUsedBytes": actualUsed,
		"usedPercentage":  usedPct,
		"isUnlimited":     isUnlimited,
	})
}

// PATCH /api/v1/storage/users/{userId}/quota
func (h *StorageStatsHandler) UpdateUserQuota(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		StorageQuota int64 `json:"storage_quota"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	h.db.Model(&user).Update("storage_limit", req.StorageQuota)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"userId":     user.ID,
		"name":       user.Name,
		"quotaBytes": req.StorageQuota,
		"usedBytes":  user.StorageUsed,
	})
}
