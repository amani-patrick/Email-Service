# Threat Model — SecureMail Enterprise v1.0

This document describes what SecureMail protects, how, and where responsibility lies. It mirrors the live API at `GET /api/crypto/threat-model`.

---

## Assets

1. **Message content** — end-to-end encrypted for internal (same-deployment) mail when both parties use client-side encryption.
2. **File attachments** — encrypted per-file with AES-256-GCM; keys wrapped to recipient public key.
3. **Private signing/encryption keys** — password-wrapped (AES-256-GCM) before storage.
4. **Contact data** — optional client-side encrypted contact blobs.

---

## Trust boundaries

### Client (browser) — trusted by user

- Passwords and unwrapped private keys exist only in browser memory during session.
- Decryption of messages and files happens client-side via WebCrypto.

### Server — zero-knowledge for message content

**Never sees:**

- Plaintext message bodies (when client encryption is used)
- Unwrapped private keys
- Shared secrets for external secure links

**Stores:**

- bcrypt password hashes
- Wrapped private keys and public keys (JWK)
- Encrypted message blobs (RFC822 or client-encrypted payloads)
- Metadata: sender, recipient, timestamps, sizes
- Audit logs of administrative actions (not message content)

**Can access:**

- Routing metadata (who emailed whom)
- Public keys
- License file and configuration

---

## Threats mitigated

| Threat | Mitigation |
|--------|------------|
| Server compromise | Message blobs encrypted client-side; keys password-wrapped |
| Database exfiltration | No plaintext content for E2E mail; bcrypt on passwords |
| Network MITM | TLS in transit; content pre-encrypted for internal mail |
| Malicious admin | Admin cannot decrypt E2E content; actions audit-logged |
| License tampering | Offline RSA-PSS signature verification |

---

## Threats NOT mitigated

| Threat | Notes |
|--------|-------|
| Client malware | Device compromise exposes decrypted content |
| Weak passwords | Reduces protection of wrapped keys |
| Social engineering | User may disclose password or shared secret |
| Metadata analysis | Server sees communication graph |
| Inbound external mail | Internet senders deliver plaintext MIME; stored as opaque blob but not client-encrypted |
| Subject lines | Not encrypted in current implementation |
| Simulated WebAuthn | Biometric login path is not fully challenge-verified — do not rely on it for high assurance |

---

## SMTP-specific considerations

- **Outbound:** Messages relayed to the public internet are protected in transit by TLS where supported; content may be readable at recipient's provider unless they use PGP/S/MIME.
- **Inbound:** External senders are not required to encrypt; SecureMail stores the raw message. Internal users should treat external mail accordingly.
- **DKIM/SPF/DMARC:** Operator must publish DNS records; misconfiguration affects deliverability and spoofing resistance, not at-rest encryption.

---

## Deployment assumptions

1. Operator controls physical access to the host (air-gap or hardened VM).
2. `SECRET_KEY` is unique per deployment and not committed to source control.
3. Vendor `license_public.pem` is shipped with the product; `license_private.pem` never leaves vendor.
4. Backups of `database.db`, `uploads/`, and `drive/` are encrypted at rest by the operator.
5. Third-party audit is recommended before production use in regulated environments.

---

## Verification

Auditors should cross-reference:

- `frontend/src/crypto.js` — client encryption implementation
- `crypto_spec.py` — algorithm specification
- `GET /api/crypto/compliance` — automated algorithm checks
- `docs/AUDIT_READINESS.md` — file-level audit checklist

---

*Last updated: 2026. Version aligned with crypto spec v1.0.*
