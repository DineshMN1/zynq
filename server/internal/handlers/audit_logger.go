package handlers

import (
	"log/slog"
	"net"
	"net/http"

	"github.com/google/uuid"
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

// LogAudit writes an audit record asynchronously — it never blocks the caller.
func LogAudit(db *gorm.DB, e AuditEntry) {
	go func() {
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
	}()
}

// auditIP extracts the client IP for audit logging.
// Mirrors the logic in middleware/ratelimit.go.
func auditIP(r *http.Request) string {
	if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
		if ip := net.ParseIP(cfIP); ip != nil {
			return ip.String()
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
