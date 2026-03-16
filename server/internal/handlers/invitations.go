package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zynqcloud/api/internal/config"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type InvitationsHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewInvitationsHandler(db *gorm.DB, cfg *config.Config) *InvitationsHandler {
	return &InvitationsHandler{db: db, cfg: cfg}
}

// POST /api/v1/invites
func (h *InvitationsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	inviterID, _ := uuid.Parse(claims.Sub)

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}

	// Check if user already exists
	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		writeError(w, http.StatusConflict, "User with this email already exists")
		return
	}

	// Check if pending invitation already exists
	var existingInvite models.Invitation
	if err := h.db.Where("email = ? AND status = ? AND expires_at > ?", req.Email, "pending", time.Now()).
		First(&existingInvite).Error; err == nil {
		writeError(w, http.StatusConflict, "Pending invitation already exists for this email")
		return
	}

	invID := inviterID
	invitation := &models.Invitation{
		ID:        uuid.New(),
		Email:     req.Email,
		Token:     uuid.New(),
		Role:      req.Role,
		InviterID: &invID,
		Status:    "pending",
		ExpiresAt: time.Now().Add(time.Duration(h.cfg.InviteTokenTTLHours) * time.Hour),
	}

	if err := h.db.Create(invitation).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create invitation")
		return
	}

	inviteLink := fmt.Sprintf("%s/register?token=%s", h.cfg.FrontendURL, invitation.Token.String())
	emailSent := false

	// Send invitation email if enabled
	if h.cfg.EmailEnabled {
		go h.sendInvitationEmail(req.Email, inviteLink)
		emailSent = true
	} else {
		slog.Info("invitation created (email disabled)", "token", invitation.Token, "email", req.Email)
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         invitation.ID,
		"email":      invitation.Email,
		"token":      invitation.Token,
		"role":       invitation.Role,
		"status":     invitation.Status,
		"created_at": invitation.CreatedAt,
		"expires_at": invitation.ExpiresAt,
		"link":       inviteLink,
		"email_sent": emailSent,
	})
}

// GET /api/v1/invites
func (h *InvitationsHandler) List(w http.ResponseWriter, r *http.Request) {
	var invitations []models.Invitation
	h.db.Where("status = ? AND expires_at > ?", "pending", time.Now()).
		Order("created_at DESC").
		Find(&invitations)

	writeJSON(w, http.StatusOK, invitations)
}

// POST /api/v1/invites/{id}/revoke
func (h *InvitationsHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	invID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid invitation ID")
		return
	}

	var invitation models.Invitation
	if err := h.db.First(&invitation, "id = ?", invID).Error; err != nil {
		writeError(w, http.StatusNotFound, "Invitation not found")
		return
	}

	h.db.Model(&invitation).Update("status", "revoked")
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// GET /api/v1/invites/validate/{token}
func (h *InvitationsHandler) Validate(w http.ResponseWriter, r *http.Request) {
	tokenStr := chi.URLParam(r, "token")
	tokenUUID, err := uuid.Parse(tokenStr)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]bool{"valid": false})
		return
	}

	var invitation models.Invitation
	if err := h.db.Where("token = ? AND status = ? AND expires_at > ?", tokenUUID, "pending", time.Now()).
		First(&invitation).Error; err != nil {
		writeJSON(w, http.StatusOK, map[string]bool{"valid": false})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid":      true,
		"email":      invitation.Email,
		"role":       invitation.Role,
		"expires_at": invitation.ExpiresAt,
	})
}

// POST /api/v1/invites/accept
func (h *InvitationsHandler) Accept(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" || req.Email == "" || req.Password == "" || req.Token == "" {
		writeError(w, http.StatusBadRequest, "token, name, email and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	tokenUUID, err := uuid.Parse(req.Token)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid invitation token")
		return
	}

	var invitation models.Invitation
	if err := h.db.Where("token = ? AND status = ? AND expires_at > ?", tokenUUID, "pending", time.Now()).
		First(&invitation).Error; err != nil {
		writeError(w, http.StatusBadRequest, "Invalid or expired invitation token")
		return
	}

	if invitation.Email != "" && !strings.EqualFold(invitation.Email, req.Email) {
		writeError(w, http.StatusBadRequest, "This invitation was issued for a different email address")
		return
	}

	// Check if email already exists
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		writeError(w, http.StatusConflict, "Email already in use")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	user := &models.User{
		ID:           uuid.New(),
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         invitation.Role,
	}

	if err := h.db.Create(user).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	h.db.Model(&invitation).Update("status", "accepted")

	writeJSON(w, http.StatusCreated, user)
}

func (h *InvitationsHandler) sendInvitationEmail(to, inviteURL string) {
	subject := "You've been invited to ZynqCloud"
	body := fmt.Sprintf("You have been invited to join ZynqCloud.\n\nClick the link below to create your account:\n%s\n\nThis invitation expires in %d hours.", inviteURL, h.cfg.InviteTokenTTLHours)
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", h.cfg.SMTPFrom, to, subject, body)

	addr := fmt.Sprintf("%s:%d", h.cfg.SMTPHost, h.cfg.SMTPPort)
	var auth smtp.Auth
	if h.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPass, h.cfg.SMTPHost)
	}

	if err := smtp.SendMail(addr, auth, h.cfg.SMTPFrom, []string{to}, []byte(msg)); err != nil {
		slog.Error("failed to send invitation email", "error", err, "to", to)
	}
}
