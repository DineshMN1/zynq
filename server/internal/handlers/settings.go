package handlers

import (
	"fmt"
	"net/http"
	"net/smtp"

	"github.com/google/uuid"
	"github.com/zynqcloud/api/internal/config"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"gorm.io/gorm"
)

type SettingsHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewSettingsHandler(db *gorm.DB, cfg *config.Config) *SettingsHandler {
	return &SettingsHandler{db: db, cfg: cfg}
}

// GET /api/v1/settings
func (h *SettingsHandler) GetUserSettings(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var settings []models.Setting
	h.db.Where("user_id = ?", userID).Find(&settings)

	// Convert to map
	result := map[string]interface{}{}
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	writeJSON(w, http.StatusOK, result)
}

// PATCH /api/v1/settings
func (h *SettingsHandler) UpdateUserSettings(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	userID, _ := uuid.Parse(claims.Sub)

	var req map[string]interface{}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	uid := userID
	for key, value := range req {
		var setting models.Setting
		if err := h.db.Where("user_id = ? AND key = ?", userID, key).First(&setting).Error; err != nil {
			// Create
			setting = models.Setting{
				ID:     uuid.New(),
				UserID: &uid,
				Key:    key,
				Value:  models.JSONB{"value": value},
			}
			h.db.Create(&setting)
		} else {
			h.db.Model(&setting).Update("value", models.JSONB{"value": value})
		}
	}

	writeJSON(w, http.StatusOK, req)
}

// GET /api/v1/settings/global
func (h *SettingsHandler) GetGlobalSettings(w http.ResponseWriter, r *http.Request) {
	var settings []models.Setting
	h.db.Where("user_id IS NULL").Find(&settings)

	result := map[string]interface{}{}
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	writeJSON(w, http.StatusOK, result)
}

// PATCH /api/v1/settings/global
func (h *SettingsHandler) UpdateGlobalSettings(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	for key, value := range req {
		var setting models.Setting
		if err := h.db.Where("user_id IS NULL AND key = ?", key).First(&setting).Error; err != nil {
			setting = models.Setting{
				ID:    uuid.New(),
				Key:   key,
				Value: models.JSONB{"value": value},
			}
			h.db.Create(&setting)
		} else {
			h.db.Model(&setting).Update("value", models.JSONB{"value": value})
		}
	}

	writeJSON(w, http.StatusOK, req)
}

// GET /api/v1/settings/smtp
func (h *SettingsHandler) GetSMTPSettings(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"smtp_enabled": h.cfg.EmailEnabled,
		"smtp_host":    h.cfg.SMTPHost,
		"smtp_port":    h.cfg.SMTPPort,
		"smtp_secure":  h.cfg.SMTPSecure,
		"smtp_user":    h.cfg.SMTPUser,
		"smtp_pass":    "",
		"smtp_from":    h.cfg.SMTPFrom,
		"has_password": h.cfg.SMTPPass != "",
	})
}

// PUT /api/v1/settings/smtp
func (h *SettingsHandler) UpdateSMTPSettings(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	// Store in global settings table
	for key, value := range req {
		var setting models.Setting
		if err := h.db.Where("user_id IS NULL AND key = ?", "smtp_"+fmt.Sprint(key)).First(&setting).Error; err != nil {
			setting = models.Setting{
				ID:    uuid.New(),
				Key:   "smtp_" + fmt.Sprint(key),
				Value: models.JSONB{"value": value},
			}
			h.db.Create(&setting)
		} else {
			h.db.Model(&setting).Update("value", models.JSONB{"value": value})
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// POST /api/v1/settings/smtp/test
func (h *SettingsHandler) TestSMTPConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	readJSON(r, &req)

	if h.cfg.SMTPHost == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": "SMTP not configured",
		})
		return
	}

	to := req.Email
	if to == "" {
		to = h.cfg.SMTPFrom
	}
	if to == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": "No recipient email address",
		})
		return
	}

	addr := fmt.Sprintf("%s:%d", h.cfg.SMTPHost, h.cfg.SMTPPort)
	var auth smtp.Auth
	if h.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPass, h.cfg.SMTPHost)
	}

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: ZynqCloud SMTP Test\r\n\r\nSMTP test successful.", h.cfg.SMTPFrom, to)
	if err := smtp.SendMail(addr, auth, h.cfg.SMTPFrom, []string{to}, []byte(msg)); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "SMTP connection successful",
	})
}
