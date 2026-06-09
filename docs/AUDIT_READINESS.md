# Audit Readiness Checklist

Use this checklist when preparing for a third-party security audit or customer security review.

---

## Cryptography

- [ ] `GET /api/crypto/specification` returns current algorithm set
- [ ] `GET /api/crypto/compliance` — all values `true`
- [ ] Client code review: `frontend/src/crypto.js`
- [ ] Server does not log message bodies (grep codebase for `print.*data`)
- [ ] Private keys stored wrapped only (`encrypted_private_key` field)

## Authentication

- [ ] `SECRET_KEY` is deployment-unique
- [ ] bcrypt work factor ≥ 12 (`db.py`)
- [ ] JWT expiry configured (`ACCESS_TOKEN_EXPIRE_MINUTES`)
- [ ] WebAuthn marked as non-production unless challenge verification implemented

## SMTP / Mail

- [ ] Inbound listener bound correctly (`SMTP_INBOUND_PORT`)
- [ ] Outbound relay tested (smart-host or MX)
- [ ] DKIM DNS published and signing succeeds
- [ ] SPF/DMARC records published
- [ ] License gating active (`LICENSE_REQUIRED=true`)

## Licensing

- [ ] `license_public.pem` present; `license_private.pem` NOT on customer server
- [ ] Expired license behavior documented (SMTP blocked, data retained)
- [ ] Seat limits enforced at registration

## Operations

- [ ] Docker runs as non-root user
- [ ] Health endpoint responds (`/api/health`)
- [ ] Audit logs capture admin actions (`/api/admin/audit-logs`)
- [ ] Backup/restore procedure tested
- [ ] EULA on file for customer

## Known limitations (disclose to auditor)

1. Subject lines and metadata not encrypted
2. External inbound mail stored as received (may be plaintext MIME)
3. Password-based key wrapping uses padded UTF-8 (Argon2id recommended for v2)
4. SQLite used — scale limits for very large deployments
5. No independent audit completed unless vendor engages firm

---

## Files auditors typically request

| File | Purpose |
|------|---------|
| `crypto_spec.py` | Algorithm specification |
| `docs/THREAT_MODEL.md` | Threat model |
| `frontend/src/crypto.js` | Client encryption |
| `smtp_relay.py` | Mail transport |
| `db.py` | Auth and storage |
| `EULA.md` | License terms |
| `Dockerfile` | Deployment surface |

---

*This checklist does not constitute a passed audit — it prepares you for one.*
