# SES Transition Plan — From Closed Network to Compatible Secure Email

## Objective

Transform SES from a closed encrypted messaging system into a standards-compatible email service with zero-knowledge security, while remaining feasible for a solo developer to implement.

---

## Guiding Principles

1. **Compatibility First** — Must work with the existing global email ecosystem (SMTP/IMAP).
2. **Client-Side Encryption Always** — Server must never see plaintext.
3. **Progressive Security** — Strong defaults, optional extreme modes.
4. **No Feature Creep** — Focus ONLY on secure mail transport and usability.
5. **Adopt Existing Infrastructure** — Do not rebuild solved problems.

---

## Phase 1 — Email Interoperability (Critical Foundation)

### Goal

Allow SES users to send/receive messages from any email address.

### Tasks

* [ ] Implement SMTP inbound/outbound relay
* [ ] Add domain support (MX record routing)
* [ ] Enable custom domain onboarding
* [ ] Implement DKIM signing
* [ ] Configure SPF + DMARC alignment
* [ ] Store encrypted message blobs instead of plaintext mail

### Deliverable

SES addresses behave like real email addresses.

---

## Phase 2 — External Secure Delivery (No Account Required)

### Goal

Remove forced-registration barrier for recipients.

### Behavior

When emailing a non-SES address:

1. Encrypt message in browser
2. Send notification email containing secure link
3. Recipient decrypts via one-time code or shared secret

### Tasks

* [ ] Build secure message viewer (stateless)
* [ ] Generate ephemeral access tokens
* [ ] Add expiration + revocation logic
* [ ] Ensure server cannot decrypt payload

### Deliverable

Users can securely communicate with anyone without requiring signup.

---

## Phase 3 — Account Recovery Model (Usability Layer)

### Goal

Offer recoverability without violating zero-knowledge guarantees.

### Modes

**Standard Mode (Default)**

* User downloads encrypted recovery key
* SES cannot restore account without it

**Zero-Recovery Mode (Optional)**

* No reset possible
* No recovery channel
* Explicit warning required

### Tasks

* [ ] Implement client-side recovery key generation
* [ ] Add guided backup UX
* [ ] Add irreversible mode toggle

### Deliverable

Balanced usability + high-security option.

---

## Phase 4 — Migration Tooling (Adoption Engine)

### Goal

Allow users to switch without friction.

### Tasks

* [ ] IMAP import utility (runs locally or via secure worker)
* [ ] Client-side re-encryption of imported mail
* [ ] Contact import (vCard/CSV)
* [ ] Optional forwarding bridge during transition

### Deliverable

Users can migrate without losing history.

---

## Phase 5 — Team / B2B Readiness

### Goal

Support organizations and self-hosted deployments.

### Tasks

* [ ] Admin panel (user provisioning only — no message visibility)
* [ ] Domain-wide key policy controls
* [ ] Docker deployment hardening
* [ ] License validation system
* [ ] Audit logs of actions (not message content)

### Deliverable

Sellable team product with trust boundaries intact.

---

## Phase 6 — Cryptographic Transparency (Trust Signal)

### Goal

Make security model understandable and verifiable.

### Tasks

* [ ] Publish threat model document
* [ ] Document key derivation flow
* [ ] Explain what SES can and cannot access
* [ ] Provide reproducible crypto spec
* [ ] Prepare for external audit

### Deliverable

Credibility with security-conscious adopters.

---

## Phase 7 — UX Hardening (Retention Layer)

### Goal

Make secure email feel normal.

### Tasks

* [ ] Fast encrypted search index (client-side metadata)
* [ ] Clear encryption-state indicators
* [ ] Device key management UX
* [ ] Graceful handling of large attachments

### Deliverable

Security without daily friction.

---

## Explicit Non-Goals (Do NOT Build)

* Calendar
* Chat system
* File drive
* Video conferencing
* Office suite features
* Custom spam engine (use existing tools)

These dramatically increase complexity without improving core value.

---

## Technical Architecture Direction

**Server Responsibilities:**

* SMTP handling
* Encrypted blob storage
* Delivery routing
* Authentication envelope

**Client Responsibilities:**

* Key generation
* Encryption/decryption
* Search indexing
* Recovery key handling

SES must never possess usable decryption material.

---

## Success Criteria

SES is successful when:

* A user can email any address securely.
* A breach of SES infrastructure reveals no readable messages.
* Organizations can self-host confidently.
* Switching from legacy email is straightforward.

---

## Immediate Next Sprint (Start Here)

1. SMTP interoperability prototype
2. Domain + MX routing
3. Secure external message viewer

Do not begin other phases until these are stable.

---

End of Plan.
