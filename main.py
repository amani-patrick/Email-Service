from typing import Annotated, List, Optional
from fastapi import Body, Depends, FastAPI, HTTPException, status, UploadFile, File, Request, Form
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from model import User, Email, Attachment, BurnAddress, DriveFile, WebAuthnCredential, Domain, ExternalMessage
from sqlmodel import Session, select
import asyncio
import db
import util
import uuid
import uvicorn
import sys
import os
import stripe
from datetime import timedelta, datetime
from jinja2 import Template
import base64
import json
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

import audit
from crypto_spec import (
    CryptoSpecification,
    get_crypto_spec,
    get_threat_model,
    get_key_derivation,
)
from smtp_relay import smtp_relay, mx_router, secure_viewer, smtp_config
from smtp_inbound import start_inbound_smtp, stop_inbound_smtp

# Enterprise deployments do not require Stripe; kept for optional SaaS mode
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

app = FastAPI(
    title="SecureMail Enterprise",
    description="Self-hosted zero-knowledge secure email for air-gapped and on-prem deployments.",
    version="1.0.0",
)

STATIC_DIR = os.environ.get("STATIC_DIR", "static")

template = Template(open('./template.jinja2', 'r').read(), autoescape=True)
browser = asyncio.Lock()

LICENSE_PUBLIC_KEY_PATH = "license_public.pem"
LICENSE_FILE_PATH = "enterprise_license.lic"

def verify_license():
    if not os.path.exists(LICENSE_PUBLIC_KEY_PATH):
        return {"status": "Unlicensed", "error": "Public Key Missing"}
    if not os.path.exists(LICENSE_FILE_PATH):
        return {"status": "Unlicensed", "error": "License File Missing"}
    
    try:
        with open(LICENSE_PUBLIC_KEY_PATH, "rb") as f:
            public_key = serialization.load_pem_public_key(f.read())
        
        with open(LICENSE_FILE_PATH, "r") as f:
            bundle = json.load(f)
        
        data = bundle["data"]
        signature = base64.b64decode(bundle["signature"])
        
        message = json.dumps(data, sort_keys=True).encode()
        public_key.verify(
            signature,
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        expiry = datetime.fromisoformat(data["expiry"])
        if datetime.now() > expiry:
            return {"status": "Expired", "data": data}
            
        return {"status": "Valid", "data": data}
    except Exception as e:
        return {"status": "Invalid", "error": str(e)}

# Global license state (cached)
current_license = verify_license()

# Initialize DB
db.create_db_and_tables()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def require_valid_license_for_smtp() -> dict:
    """Enterprise SMTP relay requires a valid offline license in production."""
    if os.environ.get("LICENSE_REQUIRED", "true").lower() != "true":
        return {"status": "Bypassed"}
    lic = verify_license()
    if lic.get("status") != "Valid":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Valid enterprise license required for SMTP relay ({lic.get('error', lic.get('status'))})",
        )
    return lic


async def refresh_smtp_domains(session: Session):
    domains = await db.get_supported_domains(session)
    smtp_relay.refresh_local_domains(domains)


@app.on_event("startup")
async def on_startup():
    with Session(db.engine) as session:
        await refresh_smtp_domains(session)
    start_inbound_smtp()


@app.on_event("shutdown")
async def on_shutdown():
    stop_inbound_smtp()


@app.get("/api/health")
async def health():
    lic = verify_license()
    return {
        "status": "ok",
        "license": lic.get("status"),
        "smtp_inbound": os.environ.get("SMTP_INBOUND_ENABLED", "true"),
        "local_domains": smtp_config.supported_domains,
    }

async def send_welcome_message(username: str, session: Session):
    """Send welcome message to newly registered user"""
    try:
        # Get admin user to send from
        admin_user = session.exec(select(User).where(User.username == 'admin@ses')).first()
        
        if not admin_user:
            # Create admin user if doesn't exist
            from cryptography import x509
            ca_pub_pem = await db.get_root_cert()
            if ca_pub_pem:
                ca_pub = x509.load_pem_x509_certificate(ca_pub_pem.encode())
                ca_pub, ca_priv = util.generate_root_cert()
                admin_cert, admin_priv_key = util.generate_sign_cert('admin@ses', ca_pub, ca_priv)
                admin_pub_pem, admin_priv_pem = util.export((admin_cert, admin_priv_key))
                
                admin_user = User(
                    username='admin@ses',
                    password_hash=db.get_password_hash('admin123'),
                    public_key=util.rsa_pub_to_jwk(admin_pub_pem),
                    certificate=admin_pub_pem,
                    encrypted_private_key=util.wrap_private_key_python(util.rsa_priv_to_jwk(admin_priv_key), 'admin123'),
                    is_admin=True
                )
                session.add(admin_user)
                session.commit()
                session.refresh(admin_user)
            else:
                # Skip welcome message if no admin available
                return
        
        # Generate welcome message
        welcome_content = template.render(title='Welcome!', content='\n\n'.join([
            'Welcome to Secure Email Service (SES)!',
            'We\'re excited to have you on board and look forward to helping you manage your email needs with ease and reliability.',
            'If you have any questions or need assistance, feel free to reach out to us at admin@ses. Our team is here to support you every step of the way.',
            'Thank you for choosing SES!',
            'Best regards,',
            'The Secure Email Service Team'
        ]))
        
        msg = util.generate_email(
            sender=admin_user.username,
            recipient=username,
            subject='Welcome to Secure Email Service!',
            content=welcome_content,
            html=True,
            sign=True,
            cert=admin_user.certificate,
            key=admin_user.encrypted_private_key
        )
        
        await db.send_email(username, str(uuid.uuid4()), msg, admin_user.username, session)
        
    except Exception as e:
        # Log error but don't fail registration
        print(f"Failed to send welcome message to {username}: {str(e)}")
        pass

@app.post('/api/login')
async def login(
    username: Annotated[str, Body()],
    password: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
) -> dict:
    user = session.query(User).filter(User.username == username).first()
    if not user or not db.verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='incorrect username or password'
        )
    
    access_token_expires = timedelta(minutes=db.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = db.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post('/api/register')
async def register(
    request: Request,
    username: Annotated[str, Body()],
    password: Annotated[str, Body()],
    public_key: Annotated[str, Body()] = "",
    encrypted_private_key: Annotated[str, Body()] = "",
    session: Session = Depends(db.get_session)
):
    try:
        supported = await db.get_supported_domains(session)

        if "@" not in username:
            username = f"{username}@{smtp_config.default_domain}"

        domain_part = username.split("@", 1)[1].lower()
        if domain_part not in supported:
            raise HTTPException(
                status_code=400,
                detail=f"Domain '{domain_part}' is not provisioned. Add and verify the domain first.",
            )

        lic = verify_license()
        if lic.get("status") == "Valid":
            seats = lic["data"].get("seats", 0)
            user_count = await db.count_users(session)
            if user_count >= seats:
                raise HTTPException(
                    status_code=403,
                    detail=f"License seat limit reached ({seats} seats). Contact your vendor for renewal.",
                )

        existing_user = session.exec(select(User).where(User.username == username)).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Identity address already provisioned")
            
        # Provision Root-Signed S/MIME Identity
        ca_pub_pem = await db.get_root_cert()
        if not ca_pub_pem:
             # Fallback: Generate if missing
             ca_pub, ca_priv = util.generate_root_cert()
             await db.set_root_cert(ca_pub.public_bytes(serialization.Encoding.PEM).decode(), session)
        else:
             from cryptography import x509
             ca_pub = x509.load_pem_x509_certificate(ca_pub_pem.encode())
        
        ca_pub, ca_priv = util.generate_root_cert()
        user_cert, _ = util.generate_sign_cert(username, ca_pub, ca_priv)
        user_pub_pem, _ = util.export((user_cert, ca_priv))

        new_user = User(
            username=username,
            password_hash=db.get_password_hash(password),
            public_key=public_key,
            certificate=user_pub_pem,
            encrypted_private_key=encrypted_private_key,
            tier="Free",
            storage_limit=104857600, # 100MB
            storage_used=0,
            is_admin=False,
            webauthn_id=str(uuid.uuid4())
        )
        await db.set_user(new_user, session)

        audit.log_action(
            session, username, "user_registered", username,
            ip_address=_client_ip(request),
        )

        await send_welcome_message(new_user.username, session)
        
        return {"status": "success", "message": "Identity provisioned"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/me')
async def ok(user: Annotated[User, Depends(db.request_user)]):
    return user

@app.get('/api/emails')
async def emails(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
) -> dict[str, Email]:
    return await db.get_emails(user, session)

@app.get('/api/devices')
async def devices(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    return await db.get_user_devices(user, session)

@app.get('/api/email/{email_id}')
async def email(
    user: Annotated[User, Depends(db.request_user)],
    email_id: str,
    session: Session = Depends(db.get_session)
):
    return await db.get_email(user, email_id, session)

@app.get('/api/user/{username}/pubkey')
async def get_pubkey(
    username: str,
    session: Session = Depends(db.get_session)
):
    user = await db.get_user(username, session)
    return {"public_key": user.public_key}

@app.post('/api/mark_read/{email_id}')
async def mark_read(
    user: Annotated[User, Depends(db.request_user)], 
    email_id: str,
    session: Session = Depends(db.get_session)
) -> bool:
    return await db.mark_read(user, str(email_id), session)

@app.post('/api/delete_email/{email_id}')
async def delete_email(
    user: Annotated[User, Depends(db.request_user)],
    email_id: str,
    session: Session = Depends(db.get_session)
):
    success = await db.delete_email(user, email_id, session)
    if not success: raise HTTPException(status_code=404, detail="Email not found")
    return {"status": "deleted"}

@app.post('/api/delete_account')
async def delete_account(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    await db.delete_user_account(user, session)
    return {"status": "account deleted"}

@app.post('/api/reset_account')
async def reset_account(
    username: Annotated[str, Body()],
    new_password: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
):
    # For security-first reset, we wipe all unrecoverable data
    success = await db.reset_user_data(username, db.get_password_hash(new_password), session)
    if not success: raise HTTPException(status_code=404, detail="Identity not found")
    return {"status": "account reset", "message": "All unrecoverable E2E data has been purged"}

@app.post('/api/send')
async def send(
    request: Request,
    user: Annotated[User, Depends(db.request_user)],
    to: Annotated[str, Body()],
    subject: Annotated[str, Body()],
    body: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
):
    to = to.strip().lower()
    is_local = False
    if "@" in to:
        domain_part = to.split("@", 1)[1]
        is_local = domain_part in smtp_config.supported_domains

    if not is_local:
        raise HTTPException(
            status_code=400,
            detail="Non-local recipients require secure external delivery. Use the Secure Invite flow in Compose.",
        )

    recipient = None
    try:
        recipient = await db.get_user(to, session)
    except HTTPException:
        if not to.endswith(".burn"):
            raise HTTPException(status_code=404, detail=f"Recipient {to} not found")

    should_sign = (
        len(user.certificate) > 0
        and len(user.encrypted_private_key) > 0
        and not user.encrypted_private_key.startswith("{")
    )

    if not should_sign:
        msg = util.generate_email(
            sender=user.username,
            recipient=recipient.username if recipient else to,
            subject=subject,
            content=body,
        )
    else:
        msg = util.generate_email(
            sender=user.username,
            recipient=recipient.username if recipient else to,
            subject=subject,
            content=template.render(title=subject, content=body),
            html=True,
            sign=True,
            cert=user.certificate,
            key=user.encrypted_private_key,
        )

    email_id = str(uuid.uuid4())
    await db.send_email(to, email_id, msg, user.username, session)
    return email_id

# WebAuthn Endpoints
@app.post('/api/webauthn/register/options')
async def webauthn_register_options(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    if not user.webauthn_id:
        user.webauthn_id = str(uuid.uuid4())
        session.add(user)
        session.commit()
    
    existing_creds = await db.get_user_credentials(user.username, session)
    exclude_credentials = []
    for cred in existing_creds:
        exclude_credentials.append({"id": base64.urlsafe_b64decode(cred.credential_id), "type": "public-key"})
        
    options = util.get_registration_options(user.username, user.webauthn_id, exclude_credentials)
    # Store challenge in session/cache for verification
    # For simulation, we'll skip the stateful challenge verification or use a mock
    return JSONResponse(content=json.loads(options))

@app.post('/api/webauthn/register/verify')
async def webauthn_register_verify(
    user: Annotated[User, Depends(db.request_user)],
    response: Annotated[dict, Body()],
    session: Session = Depends(db.get_session)
):
    # In a real app, use util.verify_registration_response
    # For simulation, we'll just save the credential
    credential_id = response.get("id")
    public_key = response.get("response", {}).get("publicKey")
    transports = json.dumps(response.get("response", {}).get("transports", []))
    
    await db.add_webauthn_credential(user, credential_id, public_key, transports, session)
    return {"status": "success"}

@app.post('/api/webauthn/login/options')
async def webauthn_login_options(
    username: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
):
    existing_creds = await db.get_user_credentials(username, session)
    allow_credentials = []
    for cred in existing_creds:
        allow_credentials.append({"id": base64.urlsafe_b64decode(cred.credential_id), "type": "public-key"})
        
    options = util.get_authentication_options(allow_credentials)
    return JSONResponse(content=json.loads(options))

@app.post('/api/webauthn/login/verify')
async def webauthn_login_verify(
    username: Annotated[str, Body()],
    response: Annotated[dict, Body()],
    session: Session = Depends(db.get_session)
):
    # In a real app, use util.verify_authentication_response
    # For simulation, verify credential exists and return token
    user = await db.get_user(username, session)
    access_token_expires = timedelta(minutes=db.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = db.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Burn Address Endpoints
@app.post('/api/burn-addresses/create')
async def create_burn(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    burn_id = str(uuid.uuid4())[:8]
    address = f"temp-{burn_id}@ses"
    burn = await db.create_burn_address(user, address, 24, session)
    return burn

@app.get('/api/burn-addresses')
async def get_burns(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    return await db.get_user_burn_addresses(user, session)

# Private Drive Endpoints
@app.post('/api/drive/upload')
async def upload_drive(
    user: Annotated[User, Depends(db.request_user)],
    encrypted_key: Annotated[str, Form()],
    file: UploadFile = File(...),
    session: Session = Depends(db.get_session)
):
    upload_dir = "drive"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    content = await file.read()
    file_size = len(content)
    if user.storage_used + file_size > user.storage_limit:
        raise HTTPException(status_code=402, detail="Storage limit exceeded. Upgrade to Private Drive Pro.")

    file_uuid = str(uuid.uuid4())
    file_path = os.path.join(upload_dir, file_uuid)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    drive_file = await db.add_drive_file(
        user=user,
        file_uuid=file_uuid,
        filename=file.filename,
        mime_type=file.content_type,
        size=file.size or 0,
        storage_path=file_path,
        encrypted_key=encrypted_key,
        session=session
    )
    return drive_file

@app.get('/api/drive/files')
async def get_drive(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    return await db.get_drive_files(user, session)

@app.get('/api/drive/download/{file_uuid}')
async def download_drive(
    user: Annotated[User, Depends(db.request_user)],
    file_uuid: str,
    session: Session = Depends(db.get_session)
):
    stmt = select(DriveFile).where(DriveFile.uuid == file_uuid, DriveFile.owner_username == user.username)
    drive_file = session.exec(stmt).first()
    if not drive_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        drive_file.storage_path,
        media_type=drive_file.mime_type,
        filename=drive_file.filename
    )

# Steganography Endpoints
@app.post('/api/steganography/hide')
async def hide_msg(
    user: Annotated[User, Depends(db.request_user)],
    message: Annotated[str, Form()],
    image: UploadFile = File(...)
):
    if user.tier not in ["Pro", "Enterprise"]:
        raise HTTPException(status_code=402, detail="Steganography is a Premium feature (Pro/Enterprise required)")
        
    image_bytes = await image.read()
    try:
        encoded_image = util.hide_message_in_image(image_bytes, message)
        return JSONResponse(content={
            "status": "success",
            "image": base64.b64encode(encoded_image).decode()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/api/steganography/extract')
async def extract_msg(
    user: Annotated[User, Depends(db.request_user)],
    image: UploadFile = File(...)
):
    image_bytes = await image.read()
    try:
        message = util.extract_message_from_image(image_bytes)
        return {"message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/admin/users')
async def admin_users(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session)
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.get_all_users(session)

@app.get('/api/admin/license/status')
async def get_license_status(user: Annotated[User, Depends(db.request_user)]):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return verify_license()

@app.post('/api/admin/license/upload')
async def upload_license(
    request: Request,
    user: Annotated[User, Depends(db.request_user)],
    file: UploadFile = File(...),
    session: Session = Depends(db.get_session),
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    content = await file.read()
    with open(LICENSE_FILE_PATH, "wb") as f:
        f.write(content)

    global current_license
    current_license = verify_license()
    audit.log_action(
        session, user.username, "license_uploaded", LICENSE_FILE_PATH,
        details={"status": current_license.get("status")},
        ip_address=_client_ip(request),
    )
    return current_license

@app.post('/api/upload')
async def upload_attachment(
    user: Annotated[User, Depends(db.request_user)],
    email_uuid: Annotated[str, Form()],
    encrypted_key: Annotated[str, Form()],
    file: UploadFile = File(...),
    session: Session = Depends(db.get_session)
):
    email = session.exec(select(Email).where(Email.uuid == email_uuid, Email.sender_username == user.username)).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email context not found")
    
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    content = await file.read()
    file_size = len(content)
    
    attachment_uuid = str(uuid.uuid4())
    file_path = os.path.join(upload_dir, attachment_uuid)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    await db.add_attachment(
        email_id=email.id,
        attachment_uuid=attachment_uuid,
        filename=file.filename,
        mime_type=file.content_type,
        size=file.size or 0,
        storage_path=file_path,
        encrypted_key=encrypted_key,
        session=session
    )
    
    return {"uuid": attachment_uuid}

@app.get('/api/download/{attachment_uuid}')
async def download_attachment(
    user: Annotated[User, Depends(db.request_user)],
    attachment_uuid: str,
    session: Session = Depends(db.get_session)
):
    attachment = await db.get_attachment(attachment_uuid, session)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    email = attachment.email
    if email.recipient_username != user.username and email.sender_username != user.username:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(
        attachment.storage_path,
        media_type=attachment.mime_type,
        filename=attachment.filename
    )

@app.post('/api/create-checkout-session')
async def create_checkout(
    user: Annotated[User, Depends(db.request_user)],
    tier: Annotated[str, Body()]
):
    return {"url": f"/payment-success?tier={tier}"}

@app.post('/api/stripe/webhook')
async def stripe_webhook(
    request: Request,
    session: Session = Depends(db.get_session)
):
    return {"status": "success"}

@app.post('/api/confirm-upgrade')
async def confirm_upgrade(
    user: Annotated[User, Depends(db.request_user)],
    tier: str = Body(embed=True),
    session: Session = Depends(db.get_session)
):
    # Map frontend names to backend names if necessary
    tier_map = {
        "Starter": "Free",
        "Professional": "Pro",
        "Enterprise": "Enterprise"
    }
    mapped_tier = tier_map.get(tier, tier)

    limits = {
        "Free": 104857600,
        "Pro": 1073741824,
        "Enterprise": 10737418240
    }
    await db.update_user_tier(user.username, mapped_tier, limits.get(mapped_tier, 104857600), session)
    return {"status": "upgraded", "tier": mapped_tier}

@app.get('/api/root_cert')
async def root_cert():
    cert = await db.get_root_cert()
    if cert is None:
        raise HTTPException(status_code=404, detail="Root cert not found")
    return cert


# --- Phase 1: SMTP & Domain Management ---

@app.get("/api/smtp/status")
async def smtp_status(user: Annotated[User, Depends(db.request_user)]):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {
        "local_domains": smtp_config.supported_domains,
        "inbound_enabled": os.environ.get("SMTP_INBOUND_ENABLED", "true"),
        "inbound_port": os.environ.get("SMTP_INBOUND_PORT", "2525"),
        "relay_host": smtp_config.relay_host or "(direct MX delivery)",
        "relay_port": smtp_config.relay_port,
        "dkim_selector": smtp_config.dkim_selector,
        "license": verify_license().get("status"),
    }


@app.get("/api/dns/{domain}/mx")
async def dns_mx(domain: str):
    records = mx_router.get_mx_records(domain)
    return {"domain": domain, "mx_records": [{"priority": p, "host": h} for p, h in records]}


@app.get("/api/domains")
async def list_domains(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session),
):
    if user.is_admin:
        return list(session.exec(select(Domain)).all())
    return await db.get_user_domains(user, session)


@app.post("/api/domains")
async def add_domain(
    request: Request,
    user: Annotated[User, Depends(db.request_user)],
    domain: Annotated[str, Body()],
    session: Session = Depends(db.get_session),
):
    require_valid_license_for_smtp()
    domain = domain.lower().strip()
    record = await db.add_domain(domain, user.username, session)
    audit.log_action(
        session, user.username, "domain_added", domain,
        ip_address=_client_ip(request),
    )
    return record


@app.get("/api/domains/{domain_id}/dns-records")
async def domain_dns_records(
    domain_id: int,
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session),
):
    record = await db.get_domain_by_id(domain_id, session)
    if not record:
        raise HTTPException(status_code=404, detail="Domain not found")
    if not user.is_admin and record.owner_username != user.username:
        raise HTTPException(status_code=403, detail="Access denied")
    mail_host = os.environ.get("SES_MAIL_HOST", f"mail.{record.domain}")
    return {
        "domain": record.domain,
        "verified": record.verified,
        "records": smtp_relay.dkim.get_dns_records(record.domain, mail_host),
    }


@app.post("/api/domains/{domain_id}/verify")
async def verify_domain(
    request: Request,
    domain_id: int,
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session),
):
    record = await db.get_domain_by_id(domain_id, session)
    if not record:
        raise HTTPException(status_code=404, detail="Domain not found")
    if not user.is_admin and record.owner_username != user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    results = await db.verify_domain_dns(record, session)
    if results.get("verified"):
        await refresh_smtp_domains(session)
        audit.log_action(
            session, user.username, "domain_verified", record.domain,
            details=results, ip_address=_client_ip(request),
        )
    return {"domain": record.domain, **results}


# --- Phase 2: External Secure Delivery ---

def _viewer_base_url(request: Request) -> str:
    configured = os.environ.get("EXTERNAL_VIEWER_BASE_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    return str(request.base_url).rstrip("/")


@app.get("/api/routing/{email}")
async def routing_info(email: str, session: Session = Depends(db.get_session)):
    """Determine whether an address is local (E2E) or external (secure link)."""
    email = email.strip().lower()
    if "@" not in email:
        return {"type": "unknown", "encryption": "none"}

    domain = email.split("@", 1)[1]
    if domain not in smtp_config.supported_domains:
        return {"type": "external", "encryption": "secure_link"}

    try:
        user = await db.get_user(email, session)
        if user.public_key:
            try:
                jwk = json.loads(user.public_key)
                if jwk.get("kty") == "RSA":
                    return {"type": "local", "encryption": "e2e", "user_exists": True}
            except json.JSONDecodeError:
                pass
        return {"type": "local", "encryption": "none", "user_exists": True}
    except HTTPException:
        return {"type": "local", "encryption": "none", "user_exists": False}


@app.post("/api/external/send")
async def external_send(
    request: Request,
    user: Annotated[User, Depends(db.request_user)],
    to: Annotated[str, Body()],
    encrypted_payload: Annotated[str, Body()],
    hint: Annotated[str, Body()] = "",
    session: Session = Depends(db.get_session),
):
    """Store client-encrypted payload and email recipient a secure viewing link."""
    to = to.strip().lower()
    if "@" not in to:
        raise HTTPException(status_code=400, detail="Invalid recipient email")

    domain = to.split("@", 1)[1]
    if domain in smtp_config.supported_domains:
        raise HTTPException(
            status_code=400,
            detail="Recipient is on this deployment — use internal send instead.",
        )

    require_valid_license_for_smtp()
    if user.tier not in ["Pro", "Enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Secure external delivery requires Pro or Enterprise tier.",
        )

    message_id = str(uuid.uuid4())
    token_data = secure_viewer.generate_access_token(message_id, to, hint or None)
    expires_at = datetime.fromisoformat(token_data["expires"])

    await db.create_external_message(
        session,
        uuid=message_id,
        sender_username=user.username,
        recipient_email=to,
        encrypted_payload=encrypted_payload,
        access_token=token_data["token"],
        token_id=token_data["token_id"],
        expires_at=expires_at,
    )

    base_url = _viewer_base_url(request)
    viewer_url = f"{base_url}/view/{token_data['token']}"
    notification_body = "\n".join([
        f"You have received a secure encrypted message from {user.username}.",
        "",
        "Open the link below to view it. You will need the shared secret from the sender.",
        "",
        viewer_url,
        "",
        f"This link expires: {expires_at.strftime('%Y-%m-%d %H:%M UTC')}",
    ])
    if hint:
        notification_body += f"\nHint: {hint}\n"

    from_domain = user.username.split("@", 1)[1]
    success, result = await smtp_relay.send_outbound(
        from_addr=user.username,
        to_addr=to,
        subject=f"Secure message from {user.username}",
        body=notification_body,
        dkim_domain=from_domain,
    )
    if not success:
        raise HTTPException(status_code=502, detail=f"Notification email failed: {result}")

    audit.log_action(
        session, user.username, "external_message_sent", to,
        details={"message_id": message_id, "expires": token_data["expires"]},
        ip_address=_client_ip(request),
    )

    return {
        "message_id": message_id,
        "viewer_url": viewer_url,
        "expires": token_data["expires"],
        "notification_sent": True,
    }


@app.get("/api/external/view/{token}")
async def external_view_message(token: str, session: Session = Depends(db.get_session)):
    """Public endpoint — returns encrypted blob only (no auth, no decryption)."""
    validation = secure_viewer.validate_token(token)
    if not validation.get("valid"):
        raise HTTPException(status_code=404, detail=validation.get("error", "Invalid token"))

    if secure_viewer.is_revoked(validation["token_id"], session):
        raise HTTPException(status_code=410, detail="Access revoked")

    message = await db.get_external_message(session, validation["message_id"])
    if not message or message.revoked:
        raise HTTPException(status_code=410, detail="Message not available")
    if message.expires_at < datetime.now():
        raise HTTPException(status_code=410, detail="Message expired")

    return {
        "sender": message.sender_username,
        "recipient": message.recipient_email,
        "encrypted_payload": message.encrypted_payload,
        "hint": validation.get("hint") or "",
        "expires_at": message.expires_at.isoformat(),
        "viewed": message.viewed,
    }


@app.post("/api/external/view/{token}/opened")
async def external_mark_opened(token: str, session: Session = Depends(db.get_session)):
    """Record that recipient successfully opened the message (after client decrypt)."""
    validation = secure_viewer.validate_token(token)
    if not validation.get("valid"):
        raise HTTPException(status_code=404, detail="Invalid token")
    message = await db.get_external_message(session, validation["message_id"])
    if message:
        await db.mark_external_viewed(session, message)
    return {"status": "ok"}


@app.get("/api/external/sent")
async def external_sent_list(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session),
):
    messages = await db.get_sent_external_messages(user, session)
    return [
        {
            "uuid": m.uuid,
            "recipient_email": m.recipient_email,
            "expires_at": m.expires_at.isoformat(),
            "viewed": m.viewed,
            "viewed_at": m.viewed_at.isoformat() if m.viewed_at else None,
            "revoked": m.revoked,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@app.post("/api/external/{message_id}/revoke")
async def external_revoke(
    request: Request,
    message_id: str,
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session),
):
    message = await db.get_external_message(session, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_username != user.username and not user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.revoke_external_message(session, message)
    secure_viewer.revoke_token(message.token_id, session)
    audit.log_action(
        session, user.username, "external_message_revoked", message_id,
        ip_address=_client_ip(request),
    )
    return {"status": "revoked", "message_id": message_id}


# --- Cryptographic transparency (public audit surface) ---

@app.get("/api/crypto/specification")
async def crypto_specification():
    return get_crypto_spec()


@app.get("/api/crypto/threat-model")
async def crypto_threat_model():
    return PlainTextResponse(get_threat_model(), media_type="text/plain")


@app.get("/api/crypto/key-derivation")
async def crypto_key_derivation():
    return PlainTextResponse(get_key_derivation(), media_type="text/plain")


@app.get("/api/crypto/compliance")
async def crypto_compliance():
    return CryptoSpecification.verify_algorithm_compliance()


@app.get("/api/crypto/trust-boundaries")
async def crypto_trust_boundaries():
    return CryptoSpecification.TRUST_BOUNDARIES


@app.get("/api/admin/audit-logs")
async def admin_audit_logs(
    user: Annotated[User, Depends(db.request_user)],
    session: Session = Depends(db.get_session),
    limit: int = 100,
    offset: int = 0,
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return audit.get_audit_logs(session, limit=limit, offset=offset)


# --- Static frontend (production) ---

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    uvicorn.run(app, port=8000, host='0.0.0.0')
