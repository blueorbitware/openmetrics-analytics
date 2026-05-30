package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token has expired")
)

type Claims struct {
	UserID       uuid.UUID `json:"user_id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	IsSuperAdmin bool      `json:"is_super_admin"`
	WorkspaceID  *uuid.UUID `json:"workspace_id,omitempty"`
	Role         string    `json:"role,omitempty"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secretKey       []byte
	issuer          string
	accessDuration  time.Duration
	refreshDuration time.Duration
}

func NewJWTManager(secret, issuer string, accessDuration, refreshDuration time.Duration) *JWTManager {
	return &JWTManager{
		secretKey:       []byte(secret),
		issuer:          issuer,
		accessDuration:  accessDuration,
		refreshDuration: refreshDuration,
	}
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

func (m *JWTManager) GenerateTokenPair(userID uuid.UUID, email, name string, isSuperAdmin bool) (*TokenPair, error) {
	now := time.Now()
	expiresAt := now.Add(m.accessDuration)

	claims := &Claims{
		UserID:       userID,
		Email:        email,
		Name:         name,
		IsSuperAdmin: isSuperAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			NotBefore: jwt.NewNumericDate(now),
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(m.secretKey)
	if err != nil {
		return nil, err
	}

	refreshToken, err := generateRefreshToken()
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (m *JWTManager) GenerateAccessToken(claims *Claims) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(m.accessDuration)

	claims.RegisteredClaims = jwt.RegisteredClaims{
		Issuer:    m.issuer,
		Subject:   claims.UserID.String(),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(expiresAt),
		NotBefore: jwt.NewNumericDate(now),
		ID:        uuid.New().String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(m.secretKey)
	if err != nil {
		return "", time.Time{}, err
	}

	return accessToken, expiresAt, nil
}

func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func (m *JWTManager) RefreshDuration() time.Duration {
	return m.refreshDuration
}

func generateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func GenerateAPIToken() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sk_" + hex.EncodeToString(bytes), nil
}

func GeneratePublicKey() string {
	bytes := make([]byte, 12)
	rand.Read(bytes)
	return "pk_live_" + hex.EncodeToString(bytes)
}

func GenerateSecretKey() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return "sk_live_" + hex.EncodeToString(bytes)
}
