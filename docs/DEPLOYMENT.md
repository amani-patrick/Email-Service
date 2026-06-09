# Deployment Guide — SecureMail Enterprise

## Prerequisites

- Linux host (Ubuntu 22.04+ or RHEL 8+ recommended)
- Docker 24+ and Docker Compose v2
- DNS control for your mail domain
- Outbound SMTP: either port 25 to MX **or** a smart-host (recommended)

---

## 1. Build and run

```bash
cp .env.example .env   # create from template below
docker compose up -d --build
docker compose logs -f ses
```

Initial admin credentials are printed on first run:

```bash
docker compose exec ses python init.py
```

---

## 2. Environment template (`.env`)

```bash
SECRET_KEY=change-me-to-64-char-random-hex
LICENSE_REQUIRED=true

SES_DOMAIN=mail.example.gov
SES_DOMAINS=["mail.example.gov"]
SES_MAIL_HOST=mx.mail.example.gov

SMTP_INBOUND_ENABLED=true
SMTP_INBOUND_PORT=2525

# Recommended: relay through your org's MTA instead of direct MX
SMTP_RELAY_HOST=smtp.internal.example.gov
SMTP_RELAY_PORT=587
SMTP_RELAY_USER=securemail-relay
SMTP_RELAY_PASSWORD=...
SMTP_RELAY_TLS=true

DKIM_SELECTOR=securemail
```

---

## 3. DNS records

After adding a domain in **Admin → Domains** (or via API `POST /api/domains`), fetch required records:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/domains/1/dns-records
```

Publish:

| Type | Name | Value |
|------|------|-------|
| MX | `example.gov` | `10 mx.mail.example.gov` |
| TXT | `example.gov` | `v=spf1 mx a:mx.mail.example.gov -all` |
| TXT | `securemail._domainkey.example.gov` | DKIM public key from API |
| TXT | `_dmarc.example.gov` | `v=DMARC1; p=quarantine; ...` |

Verify:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/domains/1/verify
```

Point your firewall **MX** to the host running SecureMail. Map public port **25 → 2525** if using the built-in inbound listener, or front with Postfix/haproxy.

---

## 4. License provisioning (air-gap)

On a connected staging machine:

```bash
python license_gen.py --generate-keys          # vendor only, once
python license_gen.py --customer "Agency X" --seats 200 --days 1095
```

Transfer to air-gapped deployment via approved media:

1. `license_public.pem` (bundled with product)
2. `enterprise_license.lic` (customer-specific)

Upload `.lic` in Admin UI. No network call is made during verification.

---

## 5. Backup and disaster recovery

Per EULA Section 4, maintain:

- `database.db` — user and message metadata + blob references
- `uploads/` and `drive/` — encrypted attachment storage
- `root.crt`, `dkim_private.pem` — signing infrastructure
- `enterprise_license.lic`

Restore procedure:

1. Deploy fresh container from same image digest
2. Restore volumes
3. Re-upload license if expired (data remains accessible with valid historical keys)

Up to **3 cold-site standby instances** permitted under EULA.

---

## 6. Hardening checklist

- [ ] Set strong `SECRET_KEY`
- [ ] Run container as non-root (default in Dockerfile)
- [ ] TLS terminate at reverse proxy (nginx/Caddy) with valid cert
- [ ] Restrict SMTP inbound to known MTAs where possible
- [ ] Disable `LICENSE_REQUIRED=false` in production
- [ ] Remove default `admin123` fallback paths — use `init.py` credentials only
- [ ] Schedule encrypted off-site backups

---

## 7. Health monitoring

```bash
curl http://localhost:8000/api/health
# {"status":"ok","license":"Valid","smtp_inbound":"true","local_domains":["mail.example.gov"]}
```

Docker healthcheck uses this endpoint automatically.
