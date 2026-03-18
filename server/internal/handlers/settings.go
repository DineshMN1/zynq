package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

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

// LoadSMTPFromDB loads persisted SMTP settings from the settings table into cfg.
// Call once at startup so SMTP config survives restarts.
func LoadSMTPFromDB(db *gorm.DB, cfg *config.Config) {
	var setting models.Setting
	if err := db.Where("user_id IS NULL AND key = ?", "smtp").First(&setting).Error; err != nil {
		return // no persisted SMTP settings — use env defaults
	}

	raw, err := json.Marshal(setting.Value)
	if err != nil {
		return
	}
	var s struct {
		Enabled bool   `json:"smtp_enabled"`
		Host    string `json:"smtp_host"`
		Port    int    `json:"smtp_port"`
		Secure  bool   `json:"smtp_secure"`
		User    string `json:"smtp_user"`
		Pass    string `json:"smtp_pass"`
		From    string `json:"smtp_from"`
	}
	if err := json.Unmarshal(raw, &s); err != nil {
		return
	}

	cfg.Mu.Lock()
	defer cfg.Mu.Unlock()
	cfg.EmailEnabled = s.Enabled
	if s.Host != "" {
		cfg.SMTPHost = s.Host
	}
	if s.Port != 0 {
		cfg.SMTPPort = s.Port
	}
	cfg.SMTPSecure = s.Secure
	if s.User != "" {
		cfg.SMTPUser = s.User
	}
	if s.Pass != "" {
		cfg.SMTPPass = s.Pass
	}
	if s.From != "" {
		cfg.SMTPFrom = s.From
	}
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
	h.cfg.Mu.RLock()
	defer h.cfg.Mu.RUnlock()

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
	var req struct {
		Enabled *bool   `json:"smtp_enabled"`
		Host    *string `json:"smtp_host"`
		Port    *int    `json:"smtp_port"`
		Secure  *bool   `json:"smtp_secure"`
		User    *string `json:"smtp_user"`
		Pass    *string `json:"smtp_pass"`
		From    *string `json:"smtp_from"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Update in-memory config under lock
	h.cfg.Mu.Lock()
	if req.Enabled != nil {
		h.cfg.EmailEnabled = *req.Enabled
	}
	if req.Host != nil {
		h.cfg.SMTPHost = *req.Host
	}
	if req.Port != nil {
		h.cfg.SMTPPort = *req.Port
	}
	if req.Secure != nil {
		h.cfg.SMTPSecure = *req.Secure
	}
	if req.User != nil {
		h.cfg.SMTPUser = *req.User
	}
	if req.Pass != nil && *req.Pass != "" {
		h.cfg.SMTPPass = *req.Pass
	}
	if req.From != nil {
		h.cfg.SMTPFrom = *req.From
	}

	// Build snapshot for persistence
	persistValue := models.JSONB{
		"smtp_enabled": h.cfg.EmailEnabled,
		"smtp_host":    h.cfg.SMTPHost,
		"smtp_port":    h.cfg.SMTPPort,
		"smtp_secure":  h.cfg.SMTPSecure,
		"smtp_user":    h.cfg.SMTPUser,
		"smtp_pass":    h.cfg.SMTPPass,
		"smtp_from":    h.cfg.SMTPFrom,
	}
	h.cfg.Mu.Unlock()

	// Persist to DB so settings survive restarts
	var setting models.Setting
	if err := h.db.Where("user_id IS NULL AND key = ?", "smtp").First(&setting).Error; err != nil {
		setting = models.Setting{
			ID:    uuid.New(),
			Key:   "smtp",
			Value: persistValue,
		}
		h.db.Create(&setting)
	} else {
		h.db.Model(&setting).Update("value", persistValue)
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// POST /api/v1/settings/smtp/test
func (h *SettingsHandler) TestSMTPConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	h.cfg.Mu.RLock()
	smtpHost := h.cfg.SMTPHost
	smtpFrom := h.cfg.SMTPFrom
	h.cfg.Mu.RUnlock()

	if smtpHost == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": "SMTP not configured",
		})
		return
	}

	to := req.Email
	if to == "" {
		to = smtpFrom
	}
	if to == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": "No recipient email address",
		})
		return
	}

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: ZynqCloud SMTP Test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSMTP test successful.",
		smtpFrom, to,
	)

	h.cfg.Mu.RLock()
	cfgCopy := h.cfg
	h.cfg.Mu.RUnlock()

	if err := smtpSend(cfgCopy, smtpFrom, []string{to}, []byte(msg)); err != nil {
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
