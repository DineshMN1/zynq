package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/smtp"

	"github.com/zynqcloud/api/internal/config"
)

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]interface{}{
		"statusCode": status,
		"message":    message,
	})
}

func readJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// sendEmail sends a plain-text email via the configured SMTP server.
// Intended to be called from a goroutine — logs errors instead of returning them.
func sendEmail(cfg *config.Config, to, subject, body string) {
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", cfg.SMTPFrom, to, subject, body)
	addr := fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)
	var auth smtp.Auth
	if cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
	}
	if err := smtp.SendMail(addr, auth, cfg.SMTPFrom, []string{to}, []byte(msg)); err != nil {
		slog.Error("failed to send email", "error", err, "to", to, "subject", subject)
	}
}
