"""
SMTP Relay Module - Handles inbound/outbound email via SMTP
Supports DKIM signing, MX routing, and encrypted blob storage
"""

import asyncio
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, parseaddr
import dns.resolver
import ssl
import os
import uuid
import json
import base64
from datetime import datetime
from typing import Optional, List, Tuple
import logging

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography import x509
from cryptography.x509.oid import NameOID
import dkim

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SMTPConfig:
    """SMTP Server Configuration"""
    def __init__(self):
        self.smtp_host = os.environ.get("SMTP_HOST", "localhost")
        self.smtp_port = int(os.environ.get("SMTP_PORT", "25"))
        self.smtp_ssl_port = int(os.environ.get("SMTP_SSL_PORT", "465"))
        self.smtp_tls_port = int(os.environ.get("SMTP_TLS_PORT", "587"))
        self.imap_host = os.environ.get("IMAP_HOST", "localhost")
        self.imap_port = int(os.environ.get("IMAP_PORT", "993"))
        
        # SES domain configuration
        self.default_domain = os.environ.get("SES_DOMAIN", "ses")
        self.supported_domains = json.loads(os.environ.get("SES_DOMAINS", '["ses"]'))
        
        # DKIM configuration
        self.dkim_selector = os.environ.get("DKIM_SELECTOR", "ses")
        self.dkim_private_key_path = os.environ.get("DKIM_PRIVATE_KEY_PATH", "dkim_private.pem")
        
        # Relay settings
        self.max_message_size = int(os.environ.get("MAX_MESSAGE_SIZE", "26214400"))  # 25MB
        self.require_tls = os.environ.get("REQUIRE_TLS", "true").lower() == "true"


class DKIMManager:
    """DKIM Signing Manager"""
    
    def __init__(self, config: SMTPConfig):
        self.config = config
        self.private_key = None
        self._load_dkim_key()
    
    def _load_dkim_key(self):
        """Load or generate DKIM private key"""
        if os.path.exists(self.config.dkim_private_key_path):
            with open(self.config.dkim_private_key_path, 'rb') as f:
                self.private_key = f.read()
        else:
            # Generate new DKIM key
            self.private_key = self._generate_dkim_key()
            with open(self.config.dkim_private_key_path, 'wb') as f:
                f.write(self.private_key)
            logger.info(f"Generated new DKIM key at {self.config.dkim_private_key_path}")
    
    def _generate_dkim_key(self) -> bytes:
        """Generate a new RSA private key for DKIM"""
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        
        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        return key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
    
    def get_dns_txt_record(self, domain: str) -> str:
        """Generate DNS TXT record for DKIM"""
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        
        key = serialization.load_pem_private_key(self.private_key, password=None)
        public_key = key.public_key()
        
        pub_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        # Extract the key data
        pub_str = pub_bytes.decode()
        key_data = ''.join(pub_str.split('\n')[1:-2])
        
        return f"v=DKIM1; k=rsa; p={key_data}"
    
    def sign_message(self, message: MIMEMultipart, domain: str) -> bytes:
        """Sign an email message with DKIM"""
        # Convert message to bytes
        message_bytes = message.as_bytes()
        
        # Create DKIM signature
        sig = dkim.sign(
            message_bytes,
            self.config.dkim_selector.encode(),
            domain.encode(),
            self.private_key,
            include_headers=[b'from', b'to', b'subject', b'date']
        )
        
        return sig


class MXRouter:
    """MX Record Router for domain routing"""
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour
    
    def get_mx_records(self, domain: str) -> List[Tuple[int, str]]:
        """Get MX records for a domain, sorted by priority"""
        cache_key = f"mx:{domain}"
        
        if cache_key in self.cache:
            cached, timestamp = self.cache[cache_key]
            if datetime.now().timestamp() - timestamp < self.cache_ttl:
                return cached
        
        try:
            records = dns.resolver.resolve(domain, 'MX')
            mx_list = [(r.preference, str(r.exchange)) for r in records]
            mx_list.sort(key=lambda x: x[0])
            
            self.cache[cache_key] = (mx_list, datetime.now().timestamp())
            return mx_list
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, Exception) as e:
            logger.warning(f"No MX records found for {domain}: {e}")
            return []
    
    def is_local_domain(self, domain: str, local_domains: List[str]) -> bool:
        """Check if domain is handled locally"""
        return domain.lower() in [d.lower() for d in local_domains]
    
    def route_email(self, recipient_email: str, local_domains: List[str]) -> dict:
        """Determine routing for an email address"""
        _, domain = recipient_email.rsplit('@', 1) if '@' in recipient_email else (recipient_email, '')
        
        if self.is_local_domain(domain, local_domains):
            return {
                "type": "local",
                "domain": domain,
                "user": recipient_email.split('@')[0]
            }
        
        mx_records = self.get_mx_records(domain)
        if mx_records:
            return {
                "type": "external",
                "domain": domain,
                "mx_records": mx_records,
                "next_hop": mx_records[0][1]
            }
        
        return {
            "type": "unknown",
            "domain": domain
        }


class SMTPRelay:
    """SMTP Relay Server for inbound/outbound email"""
    
    def __init__(self, config: SMTPConfig = None):
        self.config = config or SMTPConfig()
        self.dkim = DKIMManager(self.config)
        self.mx_router = MXRouter()
    
    async def send_outbound(
        self,
        from_addr: str,
        to_addr: str,
        subject: str,
        body: str,
        html_body: str = None,
        attachments: List[dict] = None,
        dkim_domain: str = None
    ) -> Tuple[bool, str]:
        """
        Send an outbound email via SMTP
        Returns (success, message_id_or_error)
        """
        # Parse recipient domain
        _, to_domain = to_addr.rsplit('@', 1) if '@' in to_addr else (to_addr, '')
        
        # Get MX records for recipient domain
        routing = self.mx_router.route_email(to_addr, self.config.supported_domains)
        
        if routing["type"] == "local":
            # Local delivery - handled by internal system
            return True, "local_delivery"
        
        if routing["type"] == "unknown":
            return False, f"No MX records found for domain {to_domain}"
        
        # Build message
        msg = MIMEMultipart('mixed')
        msg['From'] = from_addr
        msg['To'] = to_addr
        msg['Subject'] = subject
        msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')
        msg['Message-ID'] = f"<{uuid.uuid4()}@{from_addr.split('@')[1]}>"
        
        # Add body
        if html_body:
            msg_alt = MIMEMultipart('alternative')
            msg_alt.attach(MIMEText(body, 'plain'))
            msg_alt.attach(MIMEText(html_body, 'html'))
            msg.attach(msg_alt)
        else:
            msg.attach(MIMEText(body, 'plain'))
        
        # Add attachments
        if attachments:
            from email.mime.base import MIMEBase
            from email import encoders
            
            for att in attachments:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(att['data'])
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename="{att["filename"]}"')
                msg.attach(part)
        
        # DKIM sign
        if dkim_domain:
            try:
                signed = self.dkim.sign_message(msg, dkim_domain)
                # Add DKIM-Signature header
                msg['DKIM-Signature'] = signed.decode().split('DKIM-Signature: ')[1]
            except Exception as e:
                logger.warning(f"DKIM signing failed: {e}")
        
        # Connect and send
        try:
            mx_host = routing["next_hop"]
            
            # Try TLS first
            try:
                with smtplib.SMTP(mx_host, 25, timeout=30) as smtp:
                    smtp.ehlo()
                    if smtp.has_extn('STARTTLS'):
                        smtp.starttls()
                        smtp.ehlo()
                    smtp.send_message(msg)
                    return True, msg['Message-ID']
            except smtplib.SMTPException:
                # Fallback to SSL
                with smtplib.SMTP_SSL(mx_host, self.config.smtp_ssl_port, timeout=30) as smtp:
                    smtp.send_message(msg)
                    return True, msg['Message-ID']
                    
        except Exception as e:
            logger.error(f"SMTP delivery failed to {to_addr}: {e}")
            return False, str(e)
    
    async def receive_inbound(
        self,
        raw_message: bytes,
        session
    ) -> Tuple[bool, str]:
        """
        Process an inbound email message
        Returns (success, error_message)
        """
        try:
            # Parse the message
            msg = email.message_from_bytes(raw_message)
            
            # Extract headers
            from_addr = msg.get('From', '')
            to_addr = msg.get('To', '')
            subject = msg.get('Subject', '')
            
            # Parse addresses
            _, from_email = parseaddr(from_addr)
            _, to_email = parseaddr(to_addr)
            
            # Check if recipient is local
            routing = self.mx_router.route_email(to_email, self.config.supported_domains)
            
            if routing["type"] != "local":
                return False, f"Recipient {to_email} not in local domains"
            
            # Extract body
            body = ""
            html_body = ""
            attachments = []
            
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get('Content-Disposition', ''))
                    
                    if 'attachment' in content_disposition:
                        # Store attachment
                        att_data = part.get_payload(decode=True)
                        attachments.append({
                            'filename': part.get_filename(),
                            'mime_type': content_type,
                            'data': att_data,
                            'size': len(att_data)
                        })
                    elif content_type == 'text/plain':
                        body = part.get_payload(decode=True).decode('utf-8', errors='replace')
                    elif content_type == 'text/html':
                        html_body = part.get_payload(decode=True).decode('utf-8', errors='replace')
            else:
                body = msg.get_payload(decode=True)
                if isinstance(body, bytes):
                    body = body.decode('utf-8', errors='replace')
            
            # Import here to avoid circular imports
            from model import Email
            from sqlmodel import select
            from database import get_user
            
            # Get recipient user
            recipient = await get_user(routing["user"], session)
            if not recipient:
                return False, f"User {routing['user']} not found"
            
            # Store as encrypted blob (the body should already be encrypted client-side)
            email_id = str(uuid.uuid4())
            email_size = len(raw_message)
            
            # Check quota
            if recipient.storage_used + email_size > recipient.storage_limit:
                return False, "Storage quota exceeded"
            
            new_email = Email(
                uuid=email_id,
                recipient_username=recipient.username,
                sender_username=from_email,
                data=base64.b64encode(raw_message).decode(),  # Store as base64
                size=email_size
            )
            
            recipient.storage_used += email_size
            session.add(recipient)
            session.add(new_email)
            session.commit()
            
            logger.info(f"Received email {email_id} for {to_email}")
            return True, email_id
            
        except Exception as e:
            logger.error(f"Failed to process inbound email: {e}")
            return False, str(e)


class SecureExternalViewer:
    """
    Secure message viewer for non-SES recipients
    Generates ephemeral access tokens for one-time viewing
    """
    
    def __init__(self, secret_key: str = None):
        self.secret_key = secret_key or os.environ.get("SECRET_KEY", "supersecretkey")
        self.token_expiry = int(os.environ.get("EXTERNAL_TOKEN_EXPIRY", "7"))  # days
    
    def generate_access_token(
        self,
        message_id: str,
        recipient_email: str,
        encryption_key_hint: str = None
    ) -> dict:
        """
        Generate an ephemeral access token for secure viewing
        Returns token data that can be used to construct a viewing URL
        """
        import jwt
        from datetime import timedelta
        
        token_id = str(uuid.uuid4())
        expiry = datetime.utcnow() + timedelta(days=self.token_expiry)
        
        payload = {
            "jti": token_id,
            "msg": message_id,
            "to": recipient_email,
            "exp": expiry.timestamp(),
            "hint": encryption_key_hint
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm="HS256")
        
        return {
            "token": token,
            "token_id": token_id,
            "expires": expiry.isoformat(),
            "viewer_url": f"/view/{token}"
        }
    
    def validate_token(self, token: str) -> dict:
        """Validate an access token and return the payload"""
        import jwt
        
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            return {
                "valid": True,
                "message_id": payload.get("msg"),
                "recipient": payload.get("to"),
                "hint": payload.get("hint")
            }
        except jwt.ExpiredSignatureError:
            return {"valid": False, "error": "Token expired"}
        except jwt.InvalidTokenError as e:
            return {"valid": False, "error": str(e)}
    
    def revoke_token(self, token_id: str, session) -> bool:
        """Revoke a token before it expires"""
        # Store revoked token in database
        from model import RevokedToken
        from datetime import datetime
        
        revoked = RevokedToken(
            token_id=token_id,
            revoked_at=datetime.now()
        )
        session.add(revoked)
        session.commit()
        return True
    
    def is_revoked(self, token_id: str, session) -> bool:
        """Check if a token has been revoked"""
        from model import RevokedToken
        from sqlmodel import select
        
        revoked = session.exec(
            select(RevokedToken).where(RevokedToken.token_id == token_id)
        ).first()
        return revoked is not None


# Export instances
smtp_config = SMTPConfig()
smtp_relay = SMTPRelay(smtp_config)
mx_router = MXRouter()
secure_viewer = SecureExternalViewer()
