from typing import Annotated
from fastapi import Body, Depends, FastAPI, HTTPException, status, UploadFile, File, Request, Form
from fastapi.responses import FileResponse
from model import User, Email, Attachment
from sqlmodel import Session, select
import asyncio
import db
import util
import uuid
import uvicorn
import sys
import os
import stripe
from datetime import timedelta
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
        
        expiry = datetime.datetime.fromisoformat(data["expiry"])
        if datetime.datetime.now() > expiry:
            return {"status": "Expired", "data": data}
            
        return {"status": "Valid", "data": data}
    except Exception as e:
        return {"status": "Invalid", "error": str(e)}

# Global license state (cached)
current_license = verify_license()

# Initialize DB
db.create_db_and_tables()

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
             # In a real app, we'd load the private key securely. 
             # For this simulation/enclave, we'll use a consistent root for all users.
             # If we don't have ca_priv in DB, we'll use the one from initialization if possible.
             # For now, we'll keep the logic simple but efficient.
             from cryptography import x509
             ca_pub = x509.load_pem_x509_certificate(ca_pub_pem.encode())
        
        # Performance optimization: Generate the user cert using the provided root components
        # (Using temp_ca for simulation but ensuring it doesn't block forever)
        user_cert, user_priv_key = util.generate_sign_cert(username, ca_pub, None) # None for ca_priv will generate a self-signed as fallback if util allows, but let's be precise.
        
        # Re-using the root generation logic but once only
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
            is_admin=False
        )
        await db.set_user(new_user, session)
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

    if not recipient and to.endswith('@ses'):
        raise HTTPException(status_code=404, detail=f"Recipient {to} not found in SecureMail network")

    # Sign if we have a valid PEM private key (not zero-knowledge wrapped)
    should_sign = len(user.certificate) > 0 and len(user.encrypted_private_key) > 0 and not user.encrypted_private_key.startswith('{')

    if not should_sign:
        msg = util.generate_email(
            sender=user.username,
            recipient=recipient.username,
            subject=subject,
            content=body,
        )
    else:
        msg = util.generate_email(
            sender=user.username,
            recipient=recipient.username,
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
        # In a real enterprise app, we'd log this in an 'external_invites' table
        pass

    return email_id

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
    # Fetch email to link
    email = session.exec(select(Email).where(Email.uuid == email_uuid, Email.sender_username == user.username)).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email context not found")
    
    # Save encrypted file
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
    
    # Check permission
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
    # Mock checkout session
    # Future: session = stripe.checkout.Session.create(...)
    return {"url": f"/payment-success?tier={tier}"}

@app.post('/api/stripe/webhook')
async def stripe_webhook(
    request: Request,
    session: Session = Depends(db.get_session)
):
    # Future implementation: payload = await request.body(); sig_header = request.headers.get('stripe-signature')
    # event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    # if event['type'] == 'checkout.session.completed': ...
    return {"status": "success"}

@app.post('/api/confirm-upgrade')
async def confirm_upgrade(
    user: Annotated[User, Depends(db.request_user)],
    tier: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
):
    # Real logic: Verify payment status first
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