"""Audit logging for admin actions (metadata only — never message content)."""

import json
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from model import AuditLog


def log_action(
    session: Session,
    actor_username: str,
    action: str,
    target: str = "",
    details: Optional[dict] = None,
    ip_address: str = "",
) -> AuditLog:
    entry = AuditLog(
        actor_username=actor_username,
        action=action,
        target=target,
        details=json.dumps(details or {}),
        ip_address=ip_address,
        timestamp=datetime.now(),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def get_audit_logs(session: Session, limit: int = 100, offset: int = 0) -> list[AuditLog]:
    stmt = (
        select(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.exec(stmt).all())
