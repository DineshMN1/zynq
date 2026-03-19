package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// JSONB type for PostgreSQL jsonb fields
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	b, err := json.Marshal(j)
	return string(b), err
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case string:
		bytes = []byte(v)
	case []byte:
		bytes = v
	default:
		return fmt.Errorf("cannot scan type %T into JSONB", value)
	}
	return json.Unmarshal(bytes, j)
}

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	Name         string    `gorm:"not null" json:"name"`
	Email        string    `gorm:"not null" json:"email"`
	PasswordHash string    `gorm:"column:password_hash;not null" json:"-"`
	Role         string    `gorm:"default:'user'" json:"role"`
	StorageUsed  int64     `gorm:"column:storage_used;default:0" json:"storage_used"`
	StorageLimit int64     `gorm:"column:storage_limit;default:10737418240" json:"storage_limit"`
}

func (User) TableName() string { return "users" }

type File struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt      time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	OwnerID        uuid.UUID  `gorm:"column:owner_id;not null" json:"owner_id"`
	Owner          *User      `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	SpaceID        *uuid.UUID `gorm:"column:space_id" json:"space_id,omitempty"`
	Name           string     `gorm:"not null" json:"name"`
	MimeType       *string    `gorm:"column:mime_type" json:"mime_type"`
	Size           int64      `gorm:"default:0" json:"size"`
	StoragePath    *string    `gorm:"column:storage_path" json:"storage_path,omitempty"`
	ParentID       *uuid.UUID `gorm:"column:parent_id" json:"parent_id"`
	IsFolder       bool       `gorm:"column:is_folder;default:false" json:"is_folder"`
	FileHash       *string    `gorm:"column:file_hash" json:"file_hash,omitempty"`
	EncryptedDEK   []byte     `gorm:"column:encrypted_dek" json:"-"`
	EncryptionIV   []byte     `gorm:"column:encryption_iv" json:"-"`
	EncryptionAlgo string     `gorm:"column:encryption_algo;default:'AES-256-GCM'" json:"encryption_algo,omitempty"`
	DeletedAt      *time.Time `gorm:"column:deleted_at" json:"deleted_at,omitempty"`
	// computed fields (not in DB)
	ShareCount        int `gorm:"-" json:"shareCount,omitempty"`
	PublicShareCount  int `gorm:"-" json:"publicShareCount,omitempty"`
	PrivateShareCount int `gorm:"-" json:"privateShareCount,omitempty"`
}

func (File) TableName() string { return "files" }

type Share struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt     time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	FileID        uuid.UUID  `gorm:"column:file_id;not null" json:"file_id"`
	File          *File      `gorm:"foreignKey:FileID" json:"file,omitempty"`
	GranteeUserID *uuid.UUID `gorm:"column:grantee_user_id" json:"grantee_user_id"`
	GranteeUser   *User      `gorm:"foreignKey:GranteeUserID" json:"grantee_user,omitempty"`
	GranteeEmail  *string    `gorm:"column:grantee_email" json:"grantee_email"`
	Permission    string     `gorm:"default:'read'" json:"permission"`
	CreatedBy     uuid.UUID  `gorm:"column:created_by" json:"created_by"`
	Creator       *User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	IsPublic      bool       `gorm:"column:is_public;default:false" json:"is_public"`
	ShareToken    *string    `gorm:"column:share_token" json:"share_token,omitempty"`
	ExpiresAt     *time.Time `gorm:"column:expires_at" json:"expires_at"`
	Password      *string    `gorm:"column:password" json:"-"`
	// computed
	HasPassword bool `gorm:"-" json:"hasPassword,omitempty"`
}

func (Share) TableName() string { return "shares" }

type PasswordReset struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	UserID    uuid.UUID  `gorm:"column:user_id;not null" json:"user_id"`
	Token     string     `gorm:"not null" json:"token"`
	ExpiresAt time.Time  `gorm:"column:expires_at;not null" json:"expires_at"`
	UsedAt    *time.Time `gorm:"column:used_at" json:"used_at"`
}

func (PasswordReset) TableName() string { return "password_resets" }

type Invitation struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	Email     string     `gorm:"not null" json:"email"`
	Token     uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4()" json:"token"`
	Role      string     `gorm:"default:'user'" json:"role"`
	InviterID *uuid.UUID `gorm:"column:inviter_id" json:"inviter_id"`
	Status    string     `gorm:"default:'pending'" json:"status"`
	ExpiresAt time.Time  `gorm:"column:expires_at;not null" json:"expires_at"`
}

func (Invitation) TableName() string { return "invitations" }

type Setting struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	UserID    *uuid.UUID `gorm:"column:user_id" json:"user_id"`
	Key       string     `gorm:"not null" json:"key"`
	Value     JSONB      `gorm:"type:jsonb" json:"value"`
}

func (Setting) TableName() string { return "settings" }

// Space is a shared workspace accessible to all (or selected) org members.
type Space struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	Name        string     `gorm:"not null" json:"name"`
	Description *string    `gorm:"column:description" json:"description,omitempty"`
	CreatedBy   *uuid.UUID `gorm:"column:created_by" json:"created_by,omitempty"`
	Creator     *User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	// computed
	MemberCount int `gorm:"-" json:"memberCount,omitempty"`
}

func (Space) TableName() string { return "spaces" }

// SpaceMemberRole constants
const (
	SpaceRoleViewer      = "viewer"
	SpaceRoleContributor = "contributor"
	SpaceRoleAdmin       = "admin"
)

type SpaceMember struct {
	SpaceID uuid.UUID  `gorm:"column:space_id;primaryKey" json:"space_id"`
	UserID  uuid.UUID  `gorm:"column:user_id;primaryKey" json:"user_id"`
	Role    string     `gorm:"not null;default:'contributor'" json:"role"`
	AddedBy *uuid.UUID `gorm:"column:added_by" json:"added_by,omitempty"`
	AddedAt time.Time  `gorm:"column:added_at;autoCreateTime" json:"added_at"`
	// associations
	User    *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Adder   *User  `gorm:"foreignKey:AddedBy" json:"adder,omitempty"`
}

func (SpaceMember) TableName() string { return "space_members" }

// SpaceActivityAction constants
const (
	SpaceActionUpload            = "upload"
	SpaceActionDelete            = "delete"
	SpaceActionRename            = "rename"
	SpaceActionMove              = "move"
	SpaceActionMemberAdded       = "member_added"
	SpaceActionMemberRoleChanged = "member_role_changed"
	SpaceActionMemberRemoved     = "member_removed"
)

type SpaceActivity struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	SpaceID   uuid.UUID  `gorm:"column:space_id;not null" json:"space_id"`
	UserID    *uuid.UUID `gorm:"column:user_id" json:"user_id,omitempty"`
	Action    string     `gorm:"not null" json:"action"`
	FileID    *uuid.UUID `gorm:"column:file_id" json:"file_id,omitempty"`
	FileName  *string    `gorm:"column:file_name" json:"file_name,omitempty"`
	Details   JSONB      `gorm:"type:jsonb" json:"details,omitempty"`
	// associations
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (SpaceActivity) TableName() string { return "space_activity" }
