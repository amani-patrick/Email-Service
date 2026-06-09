# Enterprise Support Agreement (Template)

**This is a template only — not legal advice. Have a qualified attorney review before use.**

---

## SecureMail Enterprise Support Agreement

**Between:** [Vendor Legal Name], a [State] [Entity Type] ("Vendor")  
**And:** [Customer Legal Name] ("Customer")  
**Effective date:** [Date]

### 1. Scope

Vendor provides technical support for the SecureMail Enterprise software deployed at Customer's designated environment ("Deployment").

### 2. Support tiers

| Tier | Response time | Channels | Annual fee |
|------|---------------|----------|------------|
| Standard | 2 business days | Email | Included year 1 |
| Priority | 8 business hours | Email + phone | [ $X / year ] |
| Mission-critical | 4 hours (24×7) | Dedicated line | [ $Y / year ] |

### 3. Covered items

- Installation and upgrade assistance
- SMTP/DNS configuration guidance
- License renewal and seat expansion
- Security advisory notifications
- Bug fixes delivered as patch releases

### 4. Excluded items

- On-site presence (available as separate SOW)
- Third-party penetration test remediation without separate agreement
- Recovery of data when Customer loses private keys or recovery material
- Integration with non-documented third-party systems

### 5. Air-gapped support procedure

1. Customer exports diagnostic bundle (logs, `/api/health`, `/api/smtp/status` — **no message content**).
2. Customer transmits bundle via approved secure channel.
3. Vendor responds with written guidance or signed patch artifact.
4. Customer applies patch in maintenance window.

### 6. Security advisories

Vendor will notify Customer of critical vulnerabilities within **72 hours** of confirmed discovery via [contact email].

### 7. Liability

Consistent with EULA Section 6. Vendor liability capped at fees paid in the 12 months preceding the claim.

### 8. Term

Co-terminous with software license unless otherwise stated. Either party may terminate with **90 days** written notice.

---

**Vendor signature:** ___________________  
**Customer signature:** ___________________

---

## Vendor prerequisites (before selling support)

- [ ] Registered LLC or equivalent legal entity
- [ ] Professional liability / E&O insurance
- [ ] Documented incident response process
- [ ] Secure channel for customer diagnostic exchange
- [ ] Versioned release and patch signing process
