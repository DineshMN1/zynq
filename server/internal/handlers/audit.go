package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/zynqcloud/api/internal/models"
	"gorm.io/gorm"
)

type AuditHandler struct {
	db *gorm.DB
}

func NewAuditHandler(db *gorm.DB) *AuditHandler {
	return &AuditHandler{db: db}
}

// GET /api/v1/admin/audit
func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	db := h.db.Model(&models.AuditLog{})

	// Filters
	if action := q.Get("action"); action != "" {
		db = db.Where("action = ?", action)
	}
	if userID := q.Get("user_id"); userID != "" {
		db = db.Where("user_id = ?", userID)
	}
	if from := q.Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			db = db.Where("created_at >= ?", t)
		}
	}
	if to := q.Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			db = db.Where("created_at <= ?", t)
		}
	}
	if search := q.Get("search"); search != "" {
		like := "%" + search + "%"
		db = db.Where("user_name ILIKE ? OR user_email ILIKE ? OR resource_name ILIKE ?", like, like, like)
	}

	var total int64
	db.Count(&total)

	var logs []models.AuditLog
	db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": logs,
		"meta": map[string]interface{}{
			"total":  total,
			"page":   page,
			"limit":  limit,
			"pages":  (total + int64(limit) - 1) / int64(limit),
		},
	})
}
