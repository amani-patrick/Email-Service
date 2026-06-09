# SecureMail Enterprise

Self-hosted, air-gapped secure email for finance, defense, and government deployments.

SecureMail is a **zero-knowledge email platform** you run on your own infrastructure. Message bodies and attachments are encrypted client-side; the server stores opaque blobs and routing metadata only. Licensing is **offline** — no phone-home, no telemetry, no kill switch.

---

## What this product is

| Capability | Status |
|------------|--------|
| Client-side E2E encryption (RSA-OAEP + AES-GCM) | ✅ |
| S/MIME identity certificates | ✅ |
| Inbound SMTP relay (port 2525) | ✅ |
| Outbound SMTP (direct MX or smart-host relay) | ✅ |
| DKIM / SPF / DMARC DNS guidance | ✅ |
| Secure external delivery (link + passphrase, no signup) | ✅ |
| Offline enterprise license (RSA-PSS signed) | ✅ |
| Cryptographic transparency API | ✅ |
| Audit logging (actions, not content) | ✅ |
| Docker deployment with reproducible builds | ✅ |

**Not included (vendor / Phase 2+):** third-party security audit, mobile apps, IMAP bridge, paid support SLA (template provided).

---

## Quick start (evaluation)

```bash
# 1. Install dependencies
pip install -r requirements.txt
cd frontend && npm ci && npm run build && cd ..

# 2. Generate vendor keys + demo license (first time only)
python license_gen.py --generate-keys
python license_gen.py --customer "Evaluation Org" --seats 50 --days 365

# 3. Initialize database (prints admin credentials)
python init.py

# 4. Run API + inbound SMTP
LICENSE_REQUIRED=false SMTP_INBOUND_ENABLED=true uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` — the built React UI is served from `/static`.

For production, use Docker:

```bash
docker compose up -d --build
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full on-prem setup including DNS, smart-host relay, and air-gap procedure.

---

## Architecture

```
Internet / internal MTA
        │
        ▼  SMTP :2525
┌───────────────────────────────────────┐
│  SecureMail (FastAPI + aiosmtpd)      │
│  • Inbound relay → encrypted storage  │
│  • Outbound relay → MX / smart-host   │
│  • DKIM signing                       │
│  • Offline license verification       │
└───────────────────────────────────────┘
        ▲
        │ HTTPS
┌───────┴───────────────────────────────┐
│  Browser (React + WebCrypto)          │
│  • Key generation & wrapping          │
│  • Encrypt/decrypt before transit     │
└───────────────────────────────────────┘
```

---

## Licensing (B2B)

1. **Vendor** generates `license_private.pem` (keep secret) and ships `license_public.pem` with the product.
2. **Customer** receives a signed `enterprise_license.lic` file (customer name, seats, expiry).
3. Admin uploads the `.lic` file via **Admin → Licensing Infrastructure**.
4. SMTP relay and domain provisioning require a valid license when `LICENSE_REQUIRED=true` (default).

Generate a license:

```bash
python license_gen.py --customer "Acme Defense" --seats 100 --days 730 --tier Enterprise
```

Legal terms: [EULA.md](EULA.md). Support template: [docs/ENTERPRISE_SUPPORT.md](docs/ENTERPRISE_SUPPORT.md).

---

## Security documentation

| Document | Description |
|----------|-------------|
| [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) | Assets, threats, mitigations, limitations |
| [docs/AUDIT_READINESS.md](docs/AUDIT_READINESS.md) | Checklist for third-party auditors |
| [docs/REPRODUCIBLE_BUILDS.md](docs/REPRODUCIBLE_BUILDS.md) | Pin-verified Docker builds |
| `/api/crypto/*` | Live machine-readable crypto spec |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(required in prod)* | JWT signing key |
| `LICENSE_REQUIRED` | `true` | Gate SMTP on valid license |
| `SES_DOMAIN` | `ses` | Default mail domain |
| `SES_DOMAINS` | `["ses"]` | JSON list of local domains |
| `SES_MAIL_HOST` | `mail.{domain}` | Hostname for MX/SPF checks |
| `SMTP_INBOUND_ENABLED` | `true` | Start aiosmtpd listener |
| `SMTP_INBOUND_PORT` | `2525` | Inbound SMTP port |
| `SMTP_RELAY_HOST` | *(empty)* | Smart-host for outbound (recommended) |
| `SMTP_RELAY_PORT` | `587` | Smart-host port |
| `SMTP_RELAY_USER` / `SMTP_RELAY_PASSWORD` | | Smart-host auth |
| `DKIM_SELECTOR` | `ses` | DKIM DNS selector |

---

## API highlights

```
GET  /api/health                    # Health + license status
GET  /api/crypto/specification      # Public crypto spec
GET  /api/crypto/threat-model       # Threat model (plain text)
GET  /api/domains                   # List custom domains
POST /api/domains                   # Register domain
GET  /api/domains/{id}/dns-records  # SPF/DKIM/DMARC records to publish
POST /api/domains/{id}/verify       # Verify DNS configuration
POST /api/external/send              # Encrypted payload + notification email
GET  /api/external/view/{token}      # Public — encrypted blob only
POST /api/external/{id}/revoke       # Revoke link
GET  /api/external/sent              # Sender's outbound secure invites
GET  /api/routing/{email}            # local E2E vs external secure_link
GET  /api/admin/audit-logs          # Admin audit trail
```

---

## Commercial positioning

SecureMail Enterprise is sold as **source + deployment license** to organizations that need:

- Air-gapped or on-prem operation
- Auditable cryptography (spec published, builds reproducible)
- No vendor lock-in via cloud accounts
- Offline license renewal

Typical pricing band: **$5k–50k per deployment** depending on seats, support tier, and audit assistance. You as vendor should operate through an LLC with appropriate liability insurance before signing customer contracts.

---

## Development

```bash
# Backend only (no license gate)
LICENSE_REQUIRED=false uvicorn main:app --reload

# Frontend dev server (proxies /api)
cd frontend && npm run dev
```

---

## License

Proprietary — see [EULA.md](EULA.md). Source provided to licensed customers only.
