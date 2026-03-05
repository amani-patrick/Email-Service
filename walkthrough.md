# Secure Email Service (SES) Implementation Walkthrough

## Overview

This document provides a comprehensive walkthrough of the Secure Email Service implementation, covering all phases from SMTP interoperability to UX hardening. The implementation follows a zero-knowledge architecture where the server never has access to plaintext message content.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ WebCrypto   │  │ React UI    │  │ Encryption/Decryption   │  │
│  │ RSA-OAEP    │  │ Components  │  │ AES-256-GCM             │  │
│  │ AES-256-GCM │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (TLS)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (FastAPI)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Auth API    │  │ Email API   │  │ SMTP Relay              │  │
│  │ JWT Tokens  │  │ Metadata    │  │ DKIM Signing            │  │
│  │ bcrypt      │  │ Storage     │  │ MX Routing              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ External    │  │ Migration   │  │ Audit Logging           │  │
│  │ Viewer      │  │ IMAP/CSV    │  │ Admin Actions           │  │
│  │ Tokens      │  │ vCard       │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE (SQLite/SQLModel)                   │
│  User | Email | Attachment | Domain | ExternalMessage | AuditLog│
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: SMTP Interoperability

### Files Created/Modified
- `smtp_relay.py` - New module for SMTP relay functionality
- `main.py` - Integrated SMTP relay endpoints
- `requirements.txt` - Added dnspython, dkimpy

### Key Components

#### SMTPConfig
Configuration class for SMTP settings:
```python
class SMTPConfig:
    smtp_host: str = os.environ.get("SMTP_HOST", "localhost")
    smtp_port: int = int(os.environ.get("SMTP_PORT", "25"))
    default_domain: str = os.environ.get("SES_DOMAIN", "ses")
    supported_domains: list = json.loads(os.environ.get("SES_DOMAINS", '["ses"]'))
```

#### DKIMManager
Handles DKIM signing for outbound messages:
- Generates DKIM keys for domains
- Signs outgoing messages
- Provides DNS TXT record for domain verification

#### MXRouter
Routes emails based on MX records:
- Queries DNS for MX records
- Determines internal vs external routing
- Supports custom domain routing

#### SMTPRelay
Main relay class for sending/receiving:
- `send_outbound()` - Sends emails via SMTP with DKIM signing
- `receive_inbound()` - Handles incoming SMTP messages

### API Endpoints
- `GET /api/dns/{domain}/mx` - Check MX records for a domain
- `POST /api/domains` - Add custom domain
- `POST /api/domains/{domain_id}/verify` - Verify domain DNS records

## Phase 2: External Secure Delivery

### Files Modified
- `smtp_relay.py` - Added SecureExternalViewer class
- `main.py` - Added external message endpoints
- `model.py` - Added ExternalMessage, RevokedToken models

### SecureExternalViewer
Provides ephemeral access tokens for non-SES recipients:

```python
class SecureExternalViewer:
    def generate_access_token(self, message_id: str, recipient_email: str) -> dict:
        # Generates JWT token with 7-day expiration
        # Returns viewer URL for recipient
    
    def validate_token(self, token: str) -> dict:
        # Validates JWT signature and expiration
        # Returns message_id if valid
    
    def is_revoked(self, message_id: str, session) -> bool:
        # Checks if token has been revoked
```

### External Message Flow
1. Sender encrypts message client-side with shared secret
2. Server stores encrypted blob (cannot decrypt)
3. Server generates ephemeral access token
4. Notification email sent to recipient via SMTP
5. Recipient clicks link, enters shared secret
6. Client-side decryption reveals message content

### API Endpoints
- `POST /api/external/send` - Send secure external message
- `GET /view/{token}` - View external message (public, no auth)
- `POST /api/external/{message_id}/revoke` - Revoke access

## Phase 3: Account Recovery

### Files Modified
- `model.py` - Added RecoveryKey model
- `main.py` - Added recovery endpoints

### Recovery Flow
1. User generates recovery key during registration
2. Key encrypted with user's password client-side
3. Encrypted key stored in database
4. On password loss, user provides recovery key
5. Account reset, user re-registers encryption keys

### API Endpoints
- `POST /api/recovery/generate` - Store recovery key
- `POST /api/recovery/restore` - Restore account with recovery key
- `GET /api/recovery/hint/{username}` - Get recovery hint

## Phase 4: Migration Tooling

### Files Created
- `migration.py` - New module for migration utilities

### IMAPImporter
Migrates emails from external IMAP servers:

```python
class IMAPImporter:
    async def connect(self, host, username, password) -> bool
    async def list_folders(self) -> List[str]
    async def count_messages(self, folder) -> int
    async def fetch_messages(self, folder, encrypt_func) -> List[Dict]
    async def import_to_ses(self, folder, username, session) -> Dict
```

### ContactImporter
Imports contacts from vCard and CSV:

```python
class ContactImporter:
    @staticmethod
    def parse_vcard(content: str) -> List[Dict]
    
    @staticmethod
    def parse_csv(content: str) -> List[Dict]
```

### ForwardingBridge
Provides forwarding setup instructions during transition:
- Provider-specific instructions (Gmail, Outlook, generic)
- Verification of forwarding setup

### API Endpoints
- `POST /api/migration/imap/connect` - Connect to IMAP server
- `POST /api/migration/imap/import` - Import emails from IMAP
- `POST /api/migration/contacts/import` - Import contacts file
- `GET /api/contacts` - List user contacts
- `DELETE /api/contacts/{contact_id}` - Delete contact
- `POST /api/migration/forwarding/setup` - Get forwarding instructions

## Phase 5: Team/B2B Features

### Files Modified
- `Dockerfile` - Hardened for production
- `docker-compose.yml` - Added security settings
- `frontend/src/pages/Admin.jsx` - Added audit logs section
- `model.py` - Added AuditLog, Contact, DeviceKey models

### Docker Hardening
- Non-root user execution
- Capability dropping (CAP_DROP ALL)
- Resource limits (CPU, memory)
- Health checks
- Security options (no-new-privileges, apparmor)
- Named volumes for data persistence

### Audit Logging
All admin actions logged:
- User creation/deletion
- Domain verification
- License uploads
- Device registration/revocation
- External message operations

### API Endpoints
- `GET /api/admin/audit-logs` - Get all audit logs (admin)
- `GET /api/audit-logs/me` - Get user's audit logs
- `GET /api/devices` - List registered devices
- `POST /api/devices/register` - Register new device
- `DELETE /api/devices/{device_id}` - Revoke device

## Phase 6: Cryptographic Transparency

### Files Created
- `crypto_spec.py` - Cryptographic specification module

### Specification Contents

#### Algorithms
- **Key Encryption**: RSA-OAEP, 2048-bit, SHA-256
- **Message Encryption**: AES-256-GCM, 96-bit IV
- **Key Wrapping**: AES-256-GCM for private key storage
- **Signing**: RSASSA-PSS, SHA-256, S/MIME
- **Password Hashing**: bcrypt, work factor 12
- **Token Signing**: HS256 (JWT)

#### Trust Boundaries
- **Client Trusted**: Passwords, private keys, decrypted content
- **Server Never Sees**: Plaintext messages, attachments, encryption keys
- **Server Stores**: Hashed passwords, wrapped keys, encrypted blobs

#### Threat Model
Documents mitigated threats:
- Server compromise
- Database leak
- MITM attacks
- Malicious admin

Documents limitations:
- Client-side compromise
- Weak passwords
- Social engineering
- Metadata analysis

### API Endpoints (Public)
- `GET /api/crypto/specification` - Full crypto spec
- `GET /api/crypto/threat-model` - Threat model document
- `GET /api/crypto/key-derivation` - Key derivation flow
- `GET /api/crypto/compliance` - Algorithm compliance check
- `GET /api/crypto/trust-boundaries` - Trust boundaries

## Phase 7: UX Hardening

### Files Modified
- `frontend/src/pages/Inbox.jsx` - Added security indicators

### Security Indicators
- E2E Encrypted badge
- Zero-Knowledge badge
- Device count display
- Encryption column (AES-256)
- Client-side decryption status

### Device Management
Users can:
- Register multiple devices
- View active devices
- Revoke device access
- Each device has its own encrypted key

## Database Models

### Core Models
```python
class User:
    username: str
    password_hash: str  # bcrypt
    public_key: str     # JWK format
    certificate: str    # PEM format
    encrypted_private_key: str  # AES-256-GCM wrapped
    tier: str           # Free, Pro, Enterprise
    storage_limit: int
    storage_used: int
    is_admin: bool

class Email:
    uuid: str
    recipient_username: str
    sender_username: str
    data: str           # Encrypted blob
    size: int
    read: bool

class Attachment:
    uuid: str
    filename: str
    mime_type: str
    size: int
    storage_path: str
    encrypted_key: str  # RSA-encrypted AES key
```

### Domain & External Models
```python
class Domain:
    domain: str
    owner_username: str
    verified: bool
    dkim_public_key: str
    dkim_selector: str

class ExternalMessage:
    uuid: str
    sender_username: str
    recipient_email: str
    encrypted_payload: str
    access_token: str
    expires_at: datetime
    viewed: bool
    revoked: bool

class RevokedToken:
    token_id: str
    revoked_at: datetime
```

### Supporting Models
```python
class RecoveryKey:
    user_username: str
    encrypted_recovery_key: str
    hint: str

class Contact:
    owner_username: str
    encrypted_data: str
    email: str
    name: str

class DeviceKey:
    user_username: str
    device_id: str
    device_name: str
    encrypted_key: str
    public_key: str
    is_active: bool

class AuditLog:
    actor_username: str
    action: str
    target: str
    ip_address: str
    timestamp: datetime
```

## Running the Service

### Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

### Docker Production
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Health check
curl http://localhost:8000/api/me
```

### Environment Variables
```bash
SECRET_KEY=your_secure_random_key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SES_DOMAIN=yourdomain.com
SES_DOMAINS=["yourdomain.com","other.com"]
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
DKIM_SELECTOR=ses
```

## Security Considerations

### What the Server Cannot Access
1. Plaintext message content
2. Plaintext file attachments
3. User's private key (unwrapped)
4. Message encryption keys
5. Shared secrets for external messages

### What the Server Can Access
1. User metadata (username, tier, storage)
2. Message metadata (sender, recipient, timestamp)
3. Public keys for encryption
4. Audit logs (actions, not content)

### Best Practices
1. Use strong passwords (user responsibility)
2. Keep recovery key secure (user responsibility)
3. Verify sender identity before sharing secrets
4. Revoke external messages when no longer needed
5. Monitor audit logs for suspicious activity

## API Reference Summary

### Authentication
- `POST /api/login` - User login
- `POST /api/register` - User registration
- `GET /api/me` - Current user info

### Email Operations
- `GET /api/emails` - List emails
- `GET /api/email/{id}` - Get specific email
- `POST /api/send` - Send email
- `POST /api/mark_read/{id}` - Mark as read
- `DELETE /api/delete_email/{id}` - Delete email

### File Operations
- `POST /api/upload` - Upload attachment
- `GET /api/download/{uuid}` - Download attachment

### External Delivery
- `POST /api/external/send` - Send external message
- `GET /view/{token}` - View external message
- `POST /api/external/{id}/revoke` - Revoke message

### Domain Management
- `GET /api/domains` - List domains
- `POST /api/domains` - Add domain
- `POST /api/domains/{id}/verify` - Verify domain

### Migration
- `POST /api/migration/imap/connect` - Connect IMAP
- `POST /api/migration/imap/import` - Import emails
- `POST /api/migration/contacts/import` - Import contacts
- `POST /api/migration/forwarding/setup` - Setup forwarding

### Device Management
- `GET /api/devices` - List devices
- `POST /api/devices/register` - Register device
- `DELETE /api/devices/{id}` - Revoke device

### Recovery
- `POST /api/recovery/generate` - Create recovery key
- `POST /api/recovery/restore` - Restore account
- `GET /api/recovery/hint/{username}` - Get hint

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/license/status` - License status
- `POST /api/admin/license/upload` - Upload license
- `GET /api/admin/audit-logs` - Audit logs

### Crypto Transparency
- `GET /api/crypto/specification` - Crypto spec
- `GET /api/crypto/threat-model` - Threat model
- `GET /api/crypto/key-derivation` - Key derivation
- `GET /api/crypto/compliance` - Compliance check
- `GET /api/crypto/trust-boundaries` - Trust boundaries

## Conclusion

This implementation provides a complete secure email service with:
- Zero-knowledge architecture
- SMTP interoperability with global email ecosystem
- Secure external delivery for non-SES recipients
- Migration tools for transitioning from legacy providers
- Enterprise features (audit logs, device management)
- Cryptographic transparency for external audit

All sensitive data is encrypted client-side, and the server operates as a metadata and encrypted blob store without access to plaintext content.
