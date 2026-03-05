from typing import Annotated, List
from fastapi import Body, Depends, FastAPI, HTTPException, status, UploadFile, File, Request, Form
from fastapi.responses import FileResponse, JSONResponse
from model import User, Email, Attachment, BurnAddress, DriveFile, WebAuthnCredential
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

# mock stripe api key 
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "sk_test_mock")
endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

app = FastAPI()

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
    username: Annotated[str, Body()],
    password: Annotated[str, Body()],
    public_key: Annotated[str, Body()] = "",
    encrypted_private_key: Annotated[str, Body()] = "",
    session: Session = Depends(db.get_session)
):
    try:
        # Check if user exists
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
        
        # Send welcome message
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
    user: Annotated[User, Depends(db.request_user)],
    to: Annotated[str, Body()],
    subject: Annotated[str, Body()],
    body: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
):
    recipient = await db.get_user(to, session)
    
    # Tier Gating for External Domains
    if not to.endswith('@ses'):
        if user.tier == "Free":
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="External secure invites are a Pro/Enterprise feature. Please upgrade your account."
            )
        
        # Simulation: Create a "Guest" account or just skip validation if external
        if not recipient:
            # For the simulation, we'll allow sending to external domains by skipping recipient storage
            # In a real app, this would trigger an SMTP invite.
            pass

    if not recipient and to.endswith('@ses') and not to.endswith('.burn'): # Basic burn address handling in send
        raise HTTPException(status_code=404, detail=f"Recipient {to} not found in SecureMail network")

    # Sign if we have a valid PEM private key (not zero-knowledge wrapped)
    should_sign = len(user.certificate) > 0 and len(user.encrypted_private_key) > 0 and not user.encrypted_private_key.startswith('{')

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
            content=template.render(
                title=subject,
                content=body
            ),
            html=True,
            sign=True,
            cert=user.certificate,
            key=user.encrypted_private_key
        )

    email_id = str(uuid.uuid4())
    
    if recipient:
        await db.send_email(recipient.username, email_id, msg, user.username, session)
    else:
        # Externally dispatched message simulation
        pass

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
    
    file_uuid = str(uuid.uuid4())
    file_path = os.path.join(upload_dir, file_uuid)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
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
    if user.tier == "Free":
        raise HTTPException(status_code=402, detail="Steganography is a Premium feature")
        
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
    user: Annotated[User, Depends(db.request_user)],
    file: UploadFile = File(...)
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    content = await file.read()
    with open(LICENSE_FILE_PATH, "wb") as f:
        f.write(content)
    
    global current_license
    current_license = verify_license()
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
    
    attachment_uuid = str(uuid.uuid4())
    file_path = os.path.join(upload_dir, attachment_uuid)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
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
    limits = {
        "Free": 104857600,
        "Pro": 1073741824,
        "Enterprise": 10737418240
    }
    await db.update_user_tier(user.username, tier, limits.get(tier, 104857600), session)
    return {"status": "upgraded"}

@app.get('/api/root_cert')
async def root_cert():
    cert = await db.get_root_cert()
    if cert is None:
        raise HTTPException(status_code=404, detail="Root cert not found")
    return cert

if __name__ == "__main__":
    uvicorn.run(app, port=8000, host='0.0.0.0')
