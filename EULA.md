# Enterprise User License Agreement (EULA)

## 1. Grant of License
Subject to the terms of this Agreement, SecureMail ("Licensor") grants to the Licensee a non-exclusive, non-transferable license to use the SecureMail Enterprise Suite within the designated environment.

## 2. Air-Gapped Compliance
The Software is designed for high-security, air-gapped environments. No outbound calls, "phoning home," or external telemetry are required for operation or license validation.

## 3. License Validation & Renewal
- **Offline Validation**: All licensing checks are performed locally via cryptographic signature verification.
- **Manual Renewal**: Licensee may manually provision new license files via the administrative interface to ensure continuous service in offline environments.

## 4. Backup, Archival, and Disaster Recovery
Licensee is explicitly granted the right to:
- **Redundant Instances**: Maintain up to three (3) standby or "cold-site" instances for disaster recovery purposes.
- **Data Archival**: Perform full periodic backups of the encrypted database and file storage for compliance and archival requirements.
- **Verification**: Licensor warrants that no "kill-switch" mechanisms exist that would prevent access to archived data, provided a valid (even if expired) decryption context is maintained.

## 5. Reverse Engineering
Licensee shall not attempt to reverse engineer the cryptographic signing keys or bypass the local license verification mechanisms.

## 6. Liability
Licensor's liability is limited to the cost of the licensing fee paid by the Licensee. Given the Zero-Knowledge nature of the software, Licensor holds no liability for data loss due to misplaced private keys by the Licensee's end-users.

---
*Authorized for use in Finance, Defense, and Government sectors.*
