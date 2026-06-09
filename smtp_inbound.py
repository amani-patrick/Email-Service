"""
Inbound SMTP server using aiosmtpd.
Listens for incoming mail from the internet (or internal MTA) and stores
messages as opaque blobs via SMTPRelay.receive_inbound().
"""

import asyncio
import logging
import os

from typing import Optional

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP as SMTPServer

from sqlmodel import Session

import db
from smtp_relay import smtp_relay

logger = logging.getLogger(__name__)

_inbound_controller: Optional[Controller] = None


class InboundHandler:
    """aiosmtpd handler — accepts mail for locally routed domains."""

    async def handle_DATA(self, server, session, envelope):
        peer = session.peer[0] if session.peer else "unknown"
        logger.info(
            "Inbound SMTP from %s: mail_from=%s rcpt_tos=%s size=%d",
            peer,
            envelope.mail_from,
            envelope.rcpt_tos,
            len(envelope.content),
        )

        stored_any = False
        last_error = "No local recipients"

        with Session(db.engine) as db_session:
            for rcpt in envelope.rcpt_tos:
                rcpt_lower = rcpt.lower()
                routing = smtp_relay.mx_router.route_email(
                    rcpt_lower, smtp_relay.config.supported_domains
                )
                if routing["type"] != "local":
                    continue

                success, result = await smtp_relay.receive_inbound(
                    envelope.content,
                    db_session,
                    db.get_user,
                )
                if success:
                    stored_any = True
                    last_error = ""
                else:
                    last_error = result

        if stored_any:
            return "250 Message accepted for delivery"

        logger.warning("Inbound SMTP rejected: %s", last_error)
        return f"550 {last_error}"


def start_inbound_smtp() -> Optional[Controller]:
    """Start the inbound SMTP listener if enabled."""
    global _inbound_controller

    if os.environ.get("SMTP_INBOUND_ENABLED", "true").lower() != "true":
        logger.info("Inbound SMTP disabled (SMTP_INBOUND_ENABLED=false)")
        return None

    host = os.environ.get("SMTP_INBOUND_HOST", "0.0.0.0")
    port = int(os.environ.get("SMTP_INBOUND_PORT", "2525"))

    handler = InboundHandler()
    _inbound_controller = Controller(
        handler,
        hostname=host,
        port=port,
        server_kwargs={
            "data_size_limit": smtp_relay.config.max_message_size,
        },
    )
    _inbound_controller.start()
    logger.info("Inbound SMTP listening on %s:%d", host, port)
    return _inbound_controller


def stop_inbound_smtp():
    global _inbound_controller
    if _inbound_controller:
        _inbound_controller.stop()
        _inbound_controller = None
        logger.info("Inbound SMTP stopped")
