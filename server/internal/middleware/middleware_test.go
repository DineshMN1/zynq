package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func contextWithClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, UserClaimsKey, c)
}

const testSecret = "test-secret-at-least-32-characters-long"

func makeToken(t *testing.T, claims *Claims, secret string) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func okHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func TestAuth_NoCookie_NoHeader(t *testing.T) {
	mw := Auth(testSecret)
	h := mw(http.HandlerFunc(okHandler))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestAuth_ValidCookie(t *testing.T) {
	claims := &Claims{
		Sub:   "user-123",
		Email: "test@example.com",
		Role:  "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	tok := makeToken(t, claims, testSecret)

	mw := Auth(testSecret)
	var capturedClaims *Claims
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedClaims = GetClaims(r)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "jid", Value: tok})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if capturedClaims == nil {
		t.Fatal("expected claims in context, got nil")
	}
	if capturedClaims.Sub != "user-123" {
		t.Errorf("wrong sub: %s", capturedClaims.Sub)
	}
}

func TestAuth_ValidBearerHeader(t *testing.T) {
	claims := &Claims{
		Sub:  "user-456",
		Role: "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	tok := makeToken(t, claims, testSecret)

	mw := Auth(testSecret)
	h := mw(http.HandlerFunc(okHandler))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestAuth_ExpiredToken(t *testing.T) {
	claims := &Claims{
		Sub: "user-789",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)),
		},
	}
	tok := makeToken(t, claims, testSecret)

	mw := Auth(testSecret)
	h := mw(http.HandlerFunc(okHandler))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "jid", Value: tok})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %d", rec.Code)
	}
}

func TestAuth_WrongSecret(t *testing.T) {
	claims := &Claims{
		Sub: "user-000",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	tok := makeToken(t, claims, "different-secret-value-here-for-test")

	mw := Auth(testSecret)
	h := mw(http.HandlerFunc(okHandler))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "jid", Value: tok})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong secret, got %d", rec.Code)
	}
}

func TestRequireRole_Allowed(t *testing.T) {
	claims := &Claims{Sub: "u1", Role: "admin"}
	mw := RequireRole("admin", "owner")
	h := mw(http.HandlerFunc(okHandler))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(contextWithClaims(req.Context(), claims))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for allowed role, got %d", rec.Code)
	}
}

func TestRequireRole_Forbidden(t *testing.T) {
	claims := &Claims{Sub: "u2", Role: "user"}
	mw := RequireRole("admin", "owner")
	h := mw(http.HandlerFunc(okHandler))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(contextWithClaims(req.Context(), claims))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for insufficient role, got %d", rec.Code)
	}
}
