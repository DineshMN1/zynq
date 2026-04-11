package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zynqcloud/api/internal/config"
	"github.com/zynqcloud/api/internal/models"
	"gorm.io/gorm"
)

type NotificationChannelsHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewNotificationChannelsHandler(db *gorm.DB, cfg *config.Config) *NotificationChannelsHandler {
	return &NotificationChannelsHandler{db: db, cfg: cfg}
}

// GET /api/v1/notifications/email-source
// Returns which email source will be used for system emails (invitations, etc.)
func (h *NotificationChannelsHandler) EmailSource(w http.ResponseWriter, r *http.Request) {
	// Check global SMTP
	h.cfg.Mu.RLock()
	globalEnabled := h.cfg.EmailEnabled && h.cfg.SMTPHost != ""
	globalHost := h.cfg.SMTPHost
	globalFrom := h.cfg.SMTPFrom
	h.cfg.Mu.RUnlock()

	if globalEnabled {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"source":      "global_smtp",
			"label":       "Global SMTP (" + globalHost + ")",
			"from":        globalFrom,
			"channel_id":  nil,
			"channel_name": nil,
		})
		return
	}

	// Find notification channel with user_invited action
	var channels []models.NotificationChannel
	h.db.Where("enabled = true AND type = 'email'").Order("created_at ASC").Find(&channels)
	for _, ch := range channels {
		for _, a := range ch.Actions {
			if a == "user_invited" {
				from, _ := ch.Config["from"].(string)
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"source":       "notification_channel",
					"label":        ch.Name,
					"from":         from,
					"channel_id":   ch.ID,
					"channel_name": ch.Name,
				})
				return
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"source":       "none",
		"label":        "Not configured",
		"from":         nil,
		"channel_id":   nil,
		"channel_name": nil,
	})
}

// GET /api/v1/notifications
func (h *NotificationChannelsHandler) List(w http.ResponseWriter, r *http.Request) {
	var channels []models.NotificationChannel
	h.db.Order("created_at DESC").Find(&channels)
	// never expose secrets in config
	for i := range channels {
		channels[i] = redactConfig(channels[i])
	}
	writeJSON(w, http.StatusOK, channels)
}

// POST /api/v1/notifications
func (h *NotificationChannelsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name    string                 `json:"name"`
		Type    string                 `json:"type"`
		Config  map[string]interface{} `json:"config"`
		Actions []string               `json:"actions"`
		Enabled *bool                  `json:"enabled"`
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
	if req.Type != "email" && req.Type != "teams" && req.Type != "resend" {
		writeError(w, http.StatusBadRequest, "type must be email, teams, or resend")
		return
	}
	if err := validateConfig(req.Type, req.Config); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	if req.Actions == nil {
		req.Actions = []string{}
	}

	ch := models.NotificationChannel{
		ID:      uuid.New(),
		Name:    req.Name,
		Type:    req.Type,
		Config:  models.JSONB(req.Config),
		Actions: models.StringArray(req.Actions),
		Enabled: enabled,
	}
	if err := h.db.Create(&ch).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create notification channel")
		return
	}
	writeJSON(w, http.StatusCreated, redactConfig(ch))
}

// GET /api/v1/notifications/{id}
func (h *NotificationChannelsHandler) Get(w http.ResponseWriter, r *http.Request) {
	ch, ok := h.findByID(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, redactConfig(ch))
}

// PUT /api/v1/notifications/{id}
func (h *NotificationChannelsHandler) Update(w http.ResponseWriter, r *http.Request) {
	ch, ok := h.findByID(w, r)
	if !ok {
		return
	}

	var req struct {
		Name    *string                `json:"name"`
		Config  map[string]interface{} `json:"config"`
		Actions []string               `json:"actions"`
		Enabled *bool                  `json:"enabled"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		ch.Name = name
	}
	if req.Config != nil {
		if err := validateConfig(ch.Type, req.Config); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		// Preserve existing secrets if placeholder sent
		mergeConfig(ch.Config, req.Config)
		ch.Config = models.JSONB(req.Config)
	}
	if req.Actions != nil {
		ch.Actions = models.StringArray(req.Actions)
	}
	if req.Enabled != nil {
		ch.Enabled = *req.Enabled
	}

	if err := h.db.Save(&ch).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update notification channel")
		return
	}
	writeJSON(w, http.StatusOK, redactConfig(ch))
}

// DELETE /api/v1/notifications/{id}
func (h *NotificationChannelsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ch, ok := h.findByID(w, r)
	if !ok {
		return
	}
	h.db.Delete(&ch)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// POST /api/v1/notifications/{id}/test
func (h *NotificationChannelsHandler) Test(w http.ResponseWriter, r *http.Request) {
	ch, ok := h.findByID(w, r)
	if !ok {
		return
	}

	var err error
	switch ch.Type {
	case "email":
		err = h.testEmail(ch)
	case "teams":
		err = testTeams(ch)
	case "resend":
		err = testResend(ch)
	default:
		writeError(w, http.StatusBadRequest, "Unknown channel type")
		return
	}

	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "Test notification sent successfully"})
}

// ── helpers ──────────────────────────────────────────────────────────────────

func (h *NotificationChannelsHandler) findByID(w http.ResponseWriter, r *http.Request) (models.NotificationChannel, bool) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return models.NotificationChannel{}, false
	}
	var ch models.NotificationChannel
	if err := h.db.First(&ch, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusNotFound, "Notification channel not found")
		return models.NotificationChannel{}, false
	}
	return ch, true
}

func validateConfig(channelType string, cfg map[string]interface{}) error {
	switch channelType {
	case "email":
		if v, ok := cfg["smtp_host"].(string); !ok || strings.TrimSpace(v) == "" {
			return fmt.Errorf("email config requires 'smtp_host'")
		}
		if addrs := toStringSlice(cfg["to_addresses"]); len(addrs) == 0 {
			return fmt.Errorf("email config requires at least one 'to_addresses' entry")
		}
	case "teams":
		if v, ok := cfg["webhook_url"].(string); !ok || strings.TrimSpace(v) == "" {
			return fmt.Errorf("teams config requires 'webhook_url'")
		}
	case "resend":
		if v, ok := cfg["api_key"].(string); !ok || strings.TrimSpace(v) == "" {
			return fmt.Errorf("resend config requires 'api_key'")
		}
		if addrs := toStringSlice(cfg["to_addresses"]); len(addrs) == 0 {
			return fmt.Errorf("resend config requires at least one 'to_addresses' entry")
		}
		if v, ok := cfg["from"].(string); !ok || strings.TrimSpace(v) == "" {
			return fmt.Errorf("resend config requires 'from' address")
		}
	}
	return nil
}

// toStringSlice converts a []interface{} (from JSONB unmarshalling) to []string.
func toStringSlice(v interface{}) []string {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
			out = append(out, strings.TrimSpace(s))
		}
	}
	return out
}

// redactConfig hides secrets from API responses.
func redactConfig(ch models.NotificationChannel) models.NotificationChannel {
	out := ch
	cfg := make(models.JSONB)
	for k, v := range ch.Config {
		cfg[k] = v
	}
	switch ch.Type {
	case "resend":
		if _, ok := cfg["api_key"]; ok {
			cfg["api_key"] = "••••••••"
		}
	case "email":
		if _, ok := cfg["smtp_pass"]; ok {
			cfg["smtp_pass"] = "••••••••"
		}
	}
	out.Config = cfg
	return out
}

// mergeConfig keeps existing secret values when the client sends placeholder "••••••••".
func mergeConfig(existing models.JSONB, incoming map[string]interface{}) {
	secrets := []string{"api_key", "smtp_pass"}
	for _, key := range secrets {
		if v, ok := incoming[key].(string); ok && v == "••••••••" {
			if orig, ok := existing[key]; ok {
				incoming[key] = orig
			}
		}
	}
}

// ── send helpers ──────────────────────────────────────────────────────────────

// SmtpSendToAddress sends an email using a channel's SMTP credentials but to an
// arbitrary recipient (overrides to_addresses). Used for transactional emails
// like invitation links where the recipient is dynamic.
func SmtpSendToAddress(chCfg models.JSONB, to, subject, body string) error {
	host, _ := chCfg["smtp_host"].(string)
	if host == "" {
		return fmt.Errorf("smtp_host not configured")
	}
	port := 587
	switch v := chCfg["smtp_port"].(type) {
	case float64:
		port = int(v)
	case string:
		if p, err := strconv.Atoi(v); err == nil && p > 0 {
			port = p
		}
	}
	user, _ := chCfg["smtp_user"].(string)
	pass, _ := chCfg["smtp_pass"].(string)
	from, _ := chCfg["from"].(string)
	if from == "" {
		from = to
	}
	cfg := &config.Config{
		SMTPHost:   host,
		SMTPPort:   port,
		SMTPUser:   user,
		SMTPPass:   pass,
		SMTPFrom:   from,
		SMTPSecure: port == 465,
	}
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		from, to, subject, body,
	)
	return smtpSend(cfg, from, []string{to}, []byte(msg))
}

// smtpSendFromChannelConfig sends an email using SMTP credentials stored in a
// channel's config (smtp_host, smtp_port, smtp_user, smtp_pass, from, to_addresses).
func smtpSendFromChannelConfig(chCfg models.JSONB, subject, body string) error {
	host, _ := chCfg["smtp_host"].(string)
	if host == "" {
		return fmt.Errorf("smtp_host not configured")
	}
	port := 587
	switch v := chCfg["smtp_port"].(type) {
	case float64:
		port = int(v)
	case string:
		if p, err := strconv.Atoi(v); err == nil && p > 0 {
			port = p
		}
	}
	user, _ := chCfg["smtp_user"].(string)
	pass, _ := chCfg["smtp_pass"].(string)
	from, _ := chCfg["from"].(string)
	toAddrs := toStringSlice(chCfg["to_addresses"])
	if len(toAddrs) == 0 {
		return fmt.Errorf("no recipient addresses configured")
	}
	if from == "" {
		from = toAddrs[0]
	}
	cfg := &config.Config{
		SMTPHost:   host,
		SMTPPort:   port,
		SMTPUser:   user,
		SMTPPass:   pass,
		SMTPFrom:   from,
		SMTPSecure: port == 465,
	}
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		from, strings.Join(toAddrs, ", "), subject, body,
	)
	return smtpSend(cfg, from, toAddrs, []byte(msg))
}

func (h *NotificationChannelsHandler) testEmail(ch models.NotificationChannel) error {
	return smtpSendFromChannelConfig(ch.Config, "ZynqCloud Notification Test",
		"This is a test notification from ZynqCloud.")
}

func testTeams(ch models.NotificationChannel) error {
	webhookURL, _ := ch.Config["webhook_url"].(string)
	if webhookURL == "" {
		return fmt.Errorf("no webhook URL configured")
	}

	payload := map[string]interface{}{
		"@type":      "MessageCard",
		"@context":   "http://schema.org/extensions",
		"themeColor": "0076D7",
		"summary":    "ZynqCloud Notification Test",
		"sections": []map[string]interface{}{{
			"activityTitle": "ZynqCloud Notification Test",
			"activityText":  "This is a test notification from ZynqCloud.",
		}},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("webhook request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}

func testResend(ch models.NotificationChannel) error {
	apiKey, _ := ch.Config["api_key"].(string)
	from, _ := ch.Config["from"].(string)
	toAddrs := toStringSlice(ch.Config["to_addresses"])
	if apiKey == "" || from == "" || len(toAddrs) == 0 {
		return fmt.Errorf("resend config incomplete (api_key, from, to_addresses required)")
	}

	payload := map[string]interface{}{
		"from":    from,
		"to":      toAddrs,
		"subject": "ZynqCloud Notification Test",
		"text":    "This is a test notification from ZynqCloud.",
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("resend request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		var errBody map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		if msg, ok := errBody["message"].(string); ok {
			return fmt.Errorf("resend error: %s", msg)
		}
		return fmt.Errorf("resend returned status %d", resp.StatusCode)
	}
	return nil
}

// SendNotification dispatches a notification to all enabled channels that have the given action.
func SendNotification(db *gorm.DB, cfg *config.Config, action, subject, body string) {
	var channels []models.NotificationChannel
	db.Where("enabled = true").Find(&channels)

	h := &NotificationChannelsHandler{db: db, cfg: cfg}
	for _, ch := range channels {
		hasAction := false
		for _, a := range ch.Actions {
			if a == action {
				hasAction = true
				break
			}
		}
		if !hasAction {
			continue
		}

		var err error
		switch ch.Type {
		case "email":
			err = h.sendEmailNotification(ch, subject, body)
		case "teams":
			err = sendTeamsNotification(ch, subject, body)
		case "resend":
			err = sendResendNotification(ch, subject, body)
		}
		if err != nil {
			// log but don't block
			_ = err
		}
	}
}

func (h *NotificationChannelsHandler) sendEmailNotification(ch models.NotificationChannel, subject, body string) error {
	return smtpSendFromChannelConfig(ch.Config, subject, body)
}

func sendTeamsNotification(ch models.NotificationChannel, subject, body string) error {
	webhookURL, _ := ch.Config["webhook_url"].(string)
	if webhookURL == "" {
		return fmt.Errorf("no webhook URL")
	}
	payload := map[string]interface{}{
		"@type":      "MessageCard",
		"@context":   "http://schema.org/extensions",
		"themeColor": "0076D7",
		"summary":    subject,
		"sections": []map[string]interface{}{{
			"activityTitle": subject,
			"activityText":  body,
		}},
	}
	b, _ := json.Marshal(payload)
	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func sendResendNotification(ch models.NotificationChannel, subject, body string) error {
	apiKey, _ := ch.Config["api_key"].(string)
	from, _ := ch.Config["from"].(string)
	toAddrs := toStringSlice(ch.Config["to_addresses"])
	if len(toAddrs) == 0 {
		return fmt.Errorf("no recipient addresses configured")
	}
	payload := map[string]interface{}{
		"from": from, "to": toAddrs, "subject": subject, "text": body,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
