package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"gorm.io/gorm"
)

type UsersHandler struct {
	db *gorm.DB
}

func NewUsersHandler(db *gorm.DB) *UsersHandler {
	return &UsersHandler{db: db}
}

// GET /api/v1/users
func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
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
	offset := (page - 1) * limit

	query := h.db.Model(&models.User{})
	if search != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var users []models.User
	query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&users)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": users,
		"meta": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GET /api/v1/users/{id}
func (h *UsersHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	callerID, _ := uuid.Parse(claims.Sub)

	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Admin/owner or self
	if claims.Role != "admin" && claims.Role != "owner" && callerID != userID {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// PATCH /api/v1/users/{id}
func (h *UsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		Role         *string `json:"role"`
		StorageLimit *int64  `json:"storage_limit"`
		Name         *string `json:"name"`
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

	updates := map[string]interface{}{}
	oldRole := user.Role
	if req.Role != nil {
		updates["role"] = *req.Role
		// Promoting to admin/owner grants unlimited storage unless caller explicitly sets a limit
		if (*req.Role == "admin" || *req.Role == "owner") && req.StorageLimit == nil {
			updates["storage_limit"] = int64(0)
		}
	}
	if req.StorageLimit != nil {
		updates["storage_limit"] = *req.StorageLimit
	}
	if req.Name != nil {
		updates["name"] = *req.Name
	}

	if len(updates) > 0 {
		h.db.Model(&user).Updates(updates)
	}

	claims := mw.GetClaims(r)
	callerID, _ := uuid.Parse(claims.Sub)
	if req.Role != nil && *req.Role != oldRole {
		var caller models.User
		h.db.Select("name, email").First(&caller, "id = ?", callerID)
		LogAudit(h.db, AuditEntry{
			UserID:       &callerID,
			UserName:     caller.Name,
			UserEmail:    caller.Email,
			Action:       "user.role_change",
			ResourceType: "user",
			ResourceName: user.Name,
			ResourceID:   user.ID.String(),
			IPAddress:    auditIP(r),
			Metadata:     models.JSONB{"old_role": oldRole, "new_role": *req.Role},
		})
	}

	writeJSON(w, http.StatusOK, user)
}

// DELETE /api/v1/users/{id}
func (h *UsersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	callerID, _ := uuid.Parse(claims.Sub)

	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Admin/owner or self
	if claims.Role != "admin" && claims.Role != "owner" && callerID != userID {
		writeError(w, http.StatusForbidden, "Forbidden")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	// Delete user's files and shares
	h.db.Where("created_by = ?", userID).Delete(&models.Share{})
	h.db.Where("grantee_user_id = ?", userID).Delete(&models.Share{})
	h.db.Where("owner_id = ?", userID).Delete(&models.File{})
	h.db.Delete(&user)

	var caller models.User
	h.db.Select("name, email").First(&caller, "id = ?", callerID)
	LogAudit(h.db, AuditEntry{
		UserID:       &callerID,
		UserName:     caller.Name,
		UserEmail:    caller.Email,
		Action:       "user.delete",
		ResourceType: "user",
		ResourceName: user.Name,
		ResourceID:   userID.String(),
		IPAddress:    auditIP(r),
		Metadata:     models.JSONB{"deleted_email": user.Email},
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "User deleted"})
}

// GET /api/v1/users/shareable
func (h *UsersHandler) ListShareable(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	callerID, _ := uuid.Parse(claims.Sub)

	q := r.URL.Query().Get("q")

	query := h.db.Model(&models.User{}).Where("id != ?", callerID)
	if q != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ?", "%"+q+"%", "%"+q+"%")
	}

	var users []models.User
	query.Select("id, name, email, role").Order("name ASC").Limit(50).Find(&users)

	writeJSON(w, http.StatusOK, users)
}
