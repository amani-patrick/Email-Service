from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

class RevokedToken(SQLModel, table=True):
    """Revoked tokens for external message viewer"""
    id: Optional[int] = Field(default=None, primary_key=True)
    token_id: str = Field(unique=True, index=True)
    revoked_at: datetime = Field(default_factory=datetime.now)

class Domain(SQLModel, table=True):
    """Custom domains for SES service"""
    id: Optional[int] = Field(default=None, primary_key=True)
    domain: str = Field(unique=True, index=True)
    owner_username: str = Field(foreign_key="user.username")
    verified: bool = Field(default=False)
    dkim_selector: str = Field(default="ses")
    dkim_public_key: str = ""
    spf_record: str = ""
    dmarc_record: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    verified_at: Optional[datetime] = None

class ExternalMessage(SQLModel, table=True):
    """External secure messages for non-SES recipients"""
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True, index=True)
    sender_username: str = Field(foreign_key="user.username")
    recipient_email: str = Field(index=True)
    encrypted_payload: str  # Client-side encrypted message
    access_token: str = Field(unique=True, index=True)
    token_id: str = Field(unique=True)
    expires_at: datetime
    viewed: bool = Field(default=False)
    viewed_at: Optional[datetime] = None
    revoked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    public_key: str = "" # JWK format for frontend
    certificate: str = "" # PEM format for backend S/MIME
    encrypted_private_key: str = ""
    
    # Commercial fields
    tier: str = Field(default="Free") # Free, Pro, Enterprise
    storage_limit: int = Field(default=104857600) # Default 100MB in bytes
    storage_used: int = Field(default=0)
    is_admin: bool = Field(default=False)
    
    # WebAuthn
    webauthn_id: Optional[str] = Field(default=None, unique=True)

class Email(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True)
    time: float = Field(default_factory=lambda: datetime.now().timestamp())
    read: bool = False
    data: str
    size: int = Field(default=0) # Size in bytes
    
    recipient_username: str = Field(index=True)
    sender_username: str
    
    attachments: List["Attachment"] = Relationship(back_populates="email")

class Attachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True)
    filename: str
    mime_type: str
    size: int
    storage_path: str
    encrypted_key: str = "" # AES key encrypted with recipient public key
    
    email_id: int = Field(foreign_key="email.id")
    email: Optional[Email] = Relationship(back_populates="attachments")

class RecoveryKey(SQLModel, table=True):
    """Recovery keys for account recovery"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_username: str = Field(foreign_key="user.username", index=True)
    encrypted_recovery_key: str  # Recovery key encrypted with user's password
    hint: str = ""  # Optional hint for recovery
    created_at: datetime = Field(default_factory=datetime.now)
    used_at: Optional[datetime] = None

class AuditLog(SQLModel, table=True):
    """Audit logs for admin actions (not message content)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    actor_username: str = Field(index=True)
    action: str  # e.g., "user_created", "domain_verified", "license_uploaded"
    target: str = ""  # Target of action (username, domain, etc.)
    details: str = ""  # JSON details
    ip_address: str = ""
    timestamp: datetime = Field(default_factory=datetime.now, index=True)

class Contact(SQLModel, table=True):
    """Encrypted contacts for users"""
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True, index=True)
    owner_username: str = Field(foreign_key="user.username", index=True)
    encrypted_data: str  # Client-side encrypted contact JSON
    email: str = Field(index=True)  # Unencrypted for search/routing
    name: str = ""  # Display name (unencrypted for UI)
    created_at: datetime = Field(default_factory=datetime.now)

class DeviceKey(SQLModel, table=True):
    """Device-specific encryption keys for multi-device support"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_username: str = Field(foreign_key="user.username", index=True)
    device_id: str = Field(index=True)  # Unique device identifier
    device_name: str = ""  # User-friendly name
    encrypted_key: str  # Device-specific key encrypted with master key
    public_key: str = ""  # Device public key for receiving
    created_at: datetime = Field(default_factory=datetime.now)
    last_used: Optional[datetime] = None
    is_active: bool = Field(default=True)

class BurnAddress(SQLModel, table=True):
    """Temporary UUID sub-addresses"""
    id: Optional[int] = Field(default=None, primary_key=True)
    address: str = Field(unique=True, index=True) # e.g. temp-123@ses
    owner_username: str = Field(foreign_key="user.username", index=True)
    created_at: datetime = Field(default_factory=datetime.now)
    expires_at: datetime
    is_active: bool = Field(default=True)

class DriveFile(SQLModel, table=True):
    """Encrypted files in the Private Drive"""
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True, index=True)
    owner_username: str = Field(foreign_key="user.username", index=True)
    filename: str
    mime_type: str
    size: int
    storage_path: str
    encrypted_key: str  # AES key encrypted with user's public key
    created_at: datetime = Field(default_factory=datetime.now)

class WebAuthnCredential(SQLModel, table=True):
    """WebAuthn credentials for biometric login"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_username: str = Field(foreign_key="user.username", index=True)
    credential_id: str = Field(unique=True, index=True)
    public_key: str
    sign_count: int = Field(default=0)
    transports: Optional[str] = None # JSON list of transports
    created_at: datetime = Field(default_factory=datetime.now)

