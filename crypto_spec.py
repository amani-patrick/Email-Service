"""
Cryptographic Transparency Module
Documents the security model, key derivation, and what SES can/cannot access.
This module provides reproducible crypto specifications for external audit.
"""

import hashlib
import base64
import json
from typing import Dict, Any, List, Tuple
from datetime import datetime


class CryptoSpecification:
    """
    Documents and implements the cryptographic specifications for SES.
    All algorithms are standardized and reproducible for external audit.
    """
    
    # ==================== Algorithm Specifications ====================
    
    ALGORITHMS = {
        "key_encryption": {
            "algorithm": "RSA-OAEP",
            "modulus_length": 2048,
            "hash": "SHA-256",
            "mgf": "MGF1",
            "purpose": "Encrypt symmetric keys for message encryption"
        },
        "message_encryption": {
            "algorithm": "AES-256-GCM",
            "key_length": 256,
            "iv_length": 96,
            "tag_length": 128,
            "purpose": "Encrypt message content and attachments"
        },
        "key_wrapping": {
            "algorithm": "AES-256-GCM",
            "key_length": 256,
            "purpose": "Wrap private keys with user password"
        },
        "signing": {
            "algorithm": "RSASSA-PSS",
            "hash": "SHA-256",
            "salt_length": "MAX_LENGTH",
            "purpose": "Sign outgoing emails (S/MIME)"
        },
        "password_hashing": {
            "algorithm": "bcrypt",
            "work_factor": 12,
            "purpose": "Hash user passwords for authentication"
        },
        "token_signing": {
            "algorithm": "HS256",
            "purpose": "Sign JWT tokens for session management"
        }
    }
    
    # ==================== Key Derivation Flow ====================
    
    KEY_DERIVATION_FLOW = """
    SES Key Derivation Flow
    =======================
    
    1. User Registration
       ------------------
       Client generates:
       - RSA 2048-bit key pair (RSA-OAEP with SHA-256)
       - Private key wrapped with AES-256-GCM using password-derived key
       - Public key stored in JWK format
       
       Password key derivation:
       - User password padded to 32 bytes (UTF-8, space-padded)
       - Used directly as AES-256 key (no PBKDF2 in current implementation)
       - Note: Future versions should use Argon2id or scrypt
    
    2. Message Encryption (Sender)
       ---------------------------
       For SES-to-SES messages:
       - Generate random AES-256-GCM key
       - Encrypt message content with AES-256-GCM
       - Encrypt AES key with recipient's RSA public key
       - Store encrypted message as blob
       
       For external messages:
       - Sender encrypts message client-side with shared secret
       - Server stores encrypted blob (cannot decrypt)
       - Recipient receives link with ephemeral token
    
    3. Message Decryption (Recipient)
       ------------------------------
       - Retrieve encrypted AES key
       - Decrypt AES key with recipient's RSA private key
       - Decrypt message content with AES-256-GCM
       - All decryption happens client-side
    
    4. File Attachments
       ----------------
       - Generate random AES-256-GCM key per file
       - Encrypt file content with AES-256-GCM
       - Encrypt AES key with recipient's RSA public key
       - Store encrypted file and encrypted key
    """
    
    # ==================== Trust Boundaries ====================
    
    TRUST_BOUNDARIES = {
        "client_trusted": [
            "User password",
            "Unwrapped private key",
            "Decrypted message content",
            "Decrypted file attachments",
            "Recovery key (unwrapped)"
        ],
        "server_never_sees": [
            "Plaintext messages",
            "Plaintext attachments",
            "User's private key (unwrapped)",
            "Message encryption keys",
            "Shared secrets for external messages"
        ],
        "server_stores": [
            "Hashed password (bcrypt)",
            "Wrapped private key (AES-256-GCM encrypted)",
            "Public key (JWK format)",
            "Encrypted message blobs",
            "Encrypted file blobs",
            "Wrapped AES keys",
            "Access tokens (for external messages)"
        ],
        "server_can_access": [
            "User metadata (username, tier, storage)",
            "Message metadata (sender, recipient, timestamp, size)",
            "Public keys for encryption",
            "Audit logs (actions, not content)"
        ]
    }
    
    # ==================== Threat Model ====================
    
    THREAT_MODEL = """
    SES Threat Model
    ================
    
    Assets Protected:
    -----------------
    1. Message content (end-to-end encrypted)
    2. File attachments (end-to-end encrypted)
    3. User private keys (password-encrypted)
    4. Contact information (client-side encrypted)
    
    Threats Mitigated:
    ------------------
    1. Server Compromise
       - Attacker gains full server access
       - Impact: Cannot read messages (encrypted client-side)
       - Cannot impersonate users (private keys password-wrapped)
       - Cannot decrypt external messages (shared secret not stored)
    
    2. Database Leak
       - Attacker obtains database dump
       - Impact: User metadata exposed, but no message content
       - Public keys exposed (intended)
       - Hashed passwords exposed (bcrypt protected)
    
    3. Network Interception (MITM)
       - TLS protects all client-server communication
       - Message content already encrypted before transmission
       - External message tokens are single-use, time-limited
    
    4. Malicious Admin
       - Admin cannot read messages (zero-knowledge architecture)
       - Admin can see metadata (sender, recipient, timestamps)
       - Admin can delete accounts and revoke tokens
       - Admin cannot impersonate users (no private key access)
    
    Threats NOT Mitigated:
    ----------------------
    1. Client-Side Compromise
       - Malware on user's device can access decrypted content
       - Mitigation: User responsibility (antivirus, secure device)
    
    2. Weak Passwords
       - Simple passwords reduce protection of wrapped private keys
       - Mitigation: User should use strong passwords
    
    3. Social Engineering
       - User tricked into revealing password or shared secret
       - Mitigation: User education, verification indicators
    
    4. Metadata Analysis
       - Server can see who communicates with whom
       - Mitigation: Future - mixnet routing, dummy traffic
    """
    
    # ==================== Security Guarantees ====================
    
    SECURITY_GUARANTEES = {
        "confidentiality": {
            "guarantee": "Server cannot read message content",
            "mechanism": "Client-side encryption with keys server never sees",
            "verification": "Audit crypto.js and crypto_spec.py"
        },
        "integrity": {
            "guarantee": "Messages cannot be tampered without detection",
            "mechanism": "AES-GCM authentication tag",
            "verification": "Any modification causes decryption failure"
        },
        "authentication": {
            "guarantee": "Messages are from claimed sender",
            "mechanism": "S/MIME signatures (when enabled)",
            "verification": "Signature verification with sender's certificate"
        },
        "forward_secrecy": {
            "guarantee": "Limited - compromise of current key doesn't expose past messages",
            "mechanism": "Per-message AES keys",
            "limitation": "If private key compromised, all messages encrypted to that key can be decrypted"
        },
        "recoverability": {
            "guarantee": "User can recover account with recovery key",
            "mechanism": "Recovery key encrypted with password",
            "limitation": "If recovery key lost, account is unrecoverable"
        }
    }
    
    # ==================== Audit Checklist ====================
    
    AUDIT_CHECKLIST = [
        {
            "item": "Key Generation",
            "file": "frontend/src/crypto.js:generateKeyPair()",
            "check": "Uses WebCrypto API with RSA-OAEP, 2048-bit minimum"
        },
        {
            "item": "Key Storage",
            "file": "frontend/src/crypto.js:wrapPrivateKey()",
            "check": "Private key encrypted with AES-256-GCM before storage"
        },
        {
            "item": "Message Encryption",
            "file": "frontend/src/crypto.js:encryptMessage()",
            "check": "Uses RSA-OAEP for key encryption"
        },
        {
            "item": "File Encryption",
            "file": "frontend/src/crypto.js:encryptFile()",
            "check": "Uses AES-256-GCM with random IV"
        },
        {
            "item": "Password Hashing",
            "file": "db.py:get_password_hash()",
            "check": "Uses bcrypt with work factor 12"
        },
        {
            "item": "Token Security",
            "file": "smtp_relay.py:SecureExternalViewer",
            "check": "Tokens are JWT with expiration, revocable"
        },
        {
            "item": "No Plaintext Logging",
            "file": "All backend files",
            "check": "Verify no message content is logged"
        }
    ]
    
    @classmethod
    def get_specification(cls) -> Dict[str, Any]:
        """Return the full cryptographic specification"""
        return {
            "version": "1.0",
            "generated_at": datetime.utcnow().isoformat(),
            "algorithms": cls.ALGORITHMS,
            "trust_boundaries": cls.TRUST_BOUNDARIES,
            "security_guarantees": cls.SECURITY_GUARANTEES,
            "audit_checklist": cls.AUDIT_CHECKLIST
        }
    
    @classmethod
    def get_threat_model(cls) -> str:
        """Return the threat model document"""
        return cls.THREAT_MODEL
    
    @classmethod
    def get_key_derivation_flow(cls) -> str:
        """Return the key derivation flow document"""
        return cls.KEY_DERIVATION_FLOW
    
    @classmethod
    def verify_algorithm_compliance(cls) -> Dict[str, bool]:
        """Verify that all algorithms meet security standards"""
        compliance = {}
        
        # Check RSA key size
        compliance["rsa_2048_minimum"] = cls.ALGORITHMS["key_encryption"]["modulus_length"] >= 2048
        
        # Check AES key size
        compliance["aes_256_minimum"] = cls.ALGORITHMS["message_encryption"]["key_length"] >= 256
        
        # Check bcrypt work factor
        compliance["bcrypt_work_factor"] = cls.ALGORITHMS["password_hashing"]["work_factor"] >= 12
        
        # Check IV length for AES-GCM
        compliance["aes_gcm_iv_length"] = cls.ALGORITHMS["message_encryption"]["iv_length"] == 96
        
        return compliance


def get_crypto_spec():
    """API endpoint helper - returns crypto specification"""
    return CryptoSpecification.get_specification()


def get_threat_model():
    """API endpoint helper - returns threat model"""
    return CryptoSpecification.get_threat_model()


def get_key_derivation():
    """API endpoint helper - returns key derivation flow"""
    return CryptoSpecification.get_key_derivation_flow()
