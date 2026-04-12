package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/zynqcloud/api/internal/config"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

func (h *AuthHandler) generateToken(user *models.User) (string, error) {
	claims := &mw.Claims{
		Sub:   user.ID.String(),
		Email: user.Email,
		Role:  user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

func (h *AuthHandler) setAuthCookie(w http.ResponseWriter, tokenStr string) {
	secure := h.cfg.NodeEnv == "production"
	cookie := &http.Cookie{ // #nosec G124 -- Secure is intentionally false in dev, true in prod
		Name:     "jid",
		Value:    tokenStr,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 60 * 60,
		Path:     "/",
	}
	if h.cfg.CookieDomain != "" {
		cookie.Domain = h.cfg.CookieDomain
	}
	http.SetCookie(w, cookie)
}

func (h *AuthHandler) clearAuthCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{ // #nosec G124 -- Secure is intentionally false in dev, true in prod
		Name:     "jid",
		Value:    "",
		HttpOnly: true,
		Secure:   h.cfg.NodeEnv == "production",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Path:     "/",
	}
	if h.cfg.CookieDomain != "" {
		cookie.Domain = h.cfg.CookieDomain
	}
	http.SetCookie(w, cookie)
}

// GET /api/v1/auth/setup-status
func (h *AuthHandler) SetupStatus(w http.ResponseWriter, r *http.Request) {
	var count int64
	h.db.Model(&models.User{}).Count(&count)
	writeJSON(w, http.StatusOK, map[string]bool{"needsSetup": count == 0})
}

// POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Token    string `json:"token"` // invitation token
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" || req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "name, email and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	// Check if any users exist
	var userCount int64
	h.db.Model(&models.User{}).Count(&userCount)

	role := "user"
	if userCount == 0 {
		// First user becomes the instance owner
		role = "owner"
	} else if !h.cfg.PublicRegistration {
		// Require invitation token
		if req.Token == "" {
			writeError(w, http.StatusForbidden, "Registration is not open. An invitation is required.")
			return
		}
		// Validate invitation token
		tokenUUID, err := uuid.Parse(req.Token)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Invalid invitation token")
			return
		}
		var invitation models.Invitation
		if err := h.db.Where("token = ? AND status = ? AND expires_at > ?", tokenUUID, "pending", time.Now()).First(&invitation).Error; err != nil {
			writeError(w, http.StatusBadRequest, "Invalid or expired invitation token")
			return
		}
		// Check email matches invitation if it has one
		if invitation.Email != "" && !strings.EqualFold(invitation.Email, req.Email) {
			writeError(w, http.StatusBadRequest, "This invitation was issued for a different email address")
			return
		}
		role = invitation.Role
		// Mark invitation as used
		h.db.Model(&invitation).Updates(map[string]interface{}{"status": "used"})
	}

	// Check if email already exists
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		writeError(w, http.StatusConflict, "Email already in use")
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	storageLimit := int64(10 * 1024 * 1024 * 1024) // 10 GiB default
	if role == "admin" || role == "owner" {
		storageLimit = 0 // unlimited
	}

	user := &models.User{
		ID:           uuid.New(),
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         role,
		StorageLimit: storageLimit,
	}

	if err := h.db.Select("id", "name", "email", "password_hash", "role", "storage_limit").Create(user).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Enroll new user in all existing spaces
	AutoEnrollUserInSpaces(h.db, user.ID, user.Role)

	tokenStr, err := h.generateToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	h.setAuthCookie(w, tokenStr)

	uid := user.ID
	LogAudit(h.db, AuditEntry{
		UserID:    &uid,
		UserName:  user.Name,
		UserEmail: user.Email,
		Action:    "user.register",
		IPAddress: auditIP(r),
		Metadata:  models.JSONB{"role": role},
	})

	writeJSON(w, http.StatusCreated, user)
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		LogAudit(h.db, AuditEntry{
			Action:    "auth.login_failed",
			UserEmail: req.Email,
			IPAddress: auditIP(r),
			Metadata:  models.JSONB{"reason": "user not found"},
		})
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		uid := user.ID
		LogAudit(h.db, AuditEntry{
			UserID:    &uid,
			UserName:  user.Name,
			UserEmail: user.Email,
			Action:    "auth.login_failed",
			IPAddress: auditIP(r),
			Metadata:  models.JSONB{"reason": "wrong password"},
		})
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	tokenStr, err := h.generateToken(&user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	h.setAuthCookie(w, tokenStr)

	uid := user.ID
	LogAudit(h.db, AuditEntry{
		UserID:    &uid,
		UserName:  user.Name,
		UserEmail: user.Email,
		Action:    "auth.login",
		IPAddress: auditIP(r),
	})

	writeJSON(w, http.StatusOK, user)
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	h.clearAuthCookie(w)
	if claims != nil {
		var user models.User
		if err := h.db.Select("id, name, email").First(&user, "email = ?", claims.Email).Error; err == nil {
			uid := user.ID
			LogAudit(h.db, AuditEntry{
				UserID:    &uid,
				UserName:  user.Name,
				UserEmail: user.Email,
				Action:    "auth.logout",
				IPAddress: auditIP(r),
			})
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

// GET /api/v1/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := uuid.Parse(claims.Sub)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusUnauthorized, "User not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// PATCH /api/v1/auth/profile
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := uuid.Parse(claims.Sub)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Name string `json:"name"`
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

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	if err := h.db.Model(&user).Update("name", req.Name).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// POST /api/v1/auth/change-password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := mw.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := uuid.Parse(claims.Sub)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "New password must be at least 8 characters")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		writeError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	if err := h.db.Model(&user).Update("password_hash", string(hash)).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	uid := user.ID
	LogAudit(h.db, AuditEntry{
		UserID:    &uid,
		UserName:  user.Name,
		UserEmail: user.Email,
		Action:    "auth.password_change",
		IPAddress: auditIP(r),
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Password changed successfully"})
}

// POST /api/v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Always return success to prevent email enumeration
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"message": "If that email exists, a reset link has been sent"})
		return
	}

	// Generate token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		slog.Error("failed to generate password reset token", "error", err)
		writeError(w, http.StatusInternalServerError, "Failed to generate reset token")
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Delete any existing reset tokens for this user
	h.db.Where("user_id = ?", user.ID).Delete(&models.PasswordReset{})

	reset := &models.PasswordReset{
		ID:        uuid.New(),
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(1 * time.Hour), // short window — 1 hour
	}

	if err := h.db.Create(reset).Error; err != nil {
		slog.Error("failed to create password reset", "error", err)
		writeJSON(w, http.StatusOK, map[string]string{"message": "If that email exists, a reset link has been sent"})
		return
	}

	// Send email if configured
	if h.cfg.EmailEnabled {
		resetURL := fmt.Sprintf("%s/reset-password?token=%s", h.cfg.FrontendURL, token)
		go h.sendPasswordResetEmail(user.Email, user.Name, resetURL)
	} else {
		slog.Info("password reset token generated (email disabled — configure SMTP to send emails)", "user", user.Email)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "If that email exists, a reset link has been sent"})
}

// POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	var reset models.PasswordReset
	if err := h.db.Where("token = ? AND expires_at > ? AND used_at IS NULL", req.Token, time.Now()).First(&reset).Error; err != nil {
		writeError(w, http.StatusBadRequest, "Invalid or expired reset token")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	// Update user password
	if err := h.db.Model(&models.User{}).Where("id = ?", reset.UserID).Update("password_hash", string(hash)).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to reset password")
		return
	}

	// Mark token as used
	now := time.Now()
	h.db.Model(&reset).Update("used_at", now)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}

func (h *AuthHandler) sendPasswordResetEmail(to, name, resetURL string) {
	subject := "Reset your ZynqCloud password"
	body := fmt.Sprintf("Hi %s,\n\nClick the link below to reset your password:\n%s\n\nThis link expires in %d hours.\n\nIf you did not request a password reset, please ignore this email.", name, resetURL, h.cfg.InviteTokenTTLHours)
	sendEmail(h.cfg, to, subject, body)
}
