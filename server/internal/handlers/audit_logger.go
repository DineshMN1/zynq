package handlers

import (
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"gorm.io/gorm"
)

// AuditEntry is a convenience struct for building audit log records.
type AuditEntry struct {
	UserID       *uuid.UUID
	UserName     string
	UserEmail    string
	Action       string
	ResourceType string
	ResourceName string
	ResourceID   string
	IPAddress    string
	Metadata     models.JSONB
}

// LogAudit writes an audit record synchronously so no events are lost on DB hiccups.
func LogAudit(db *gorm.DB, e AuditEntry) {
	record := models.AuditLog{
		ID:           uuid.New(),
		UserID:       e.UserID,
		UserName:     e.UserName,
		UserEmail:    e.UserEmail,
		Action:       e.Action,
		ResourceType: e.ResourceType,
		ResourceName: e.ResourceName,
		ResourceID:   e.ResourceID,
		IPAddress:    e.IPAddress,
		Metadata:     e.Metadata,
	}
	if err := db.Create(&record).Error; err != nil {
		slog.Error("audit log write failed", "action", e.Action, "error", err)
	}
}

// auditIP extracts the real client IP for audit logging.
// Uses the same logic as the rate-limit middleware (CF-Connecting-IP →
// X-Real-IP/X-Forwarded-For when behind a trusted proxy → RemoteAddr).
func auditIP(r *http.Request) string {
	return mw.RealIP(r)
}
