from typing import Annotated, Optional
from fastapi import HTTPException, Header, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, create_engine, select, SQLModel
from model import User, Email, Attachment, BurnAddress, DriveFile, WebAuthnCredential
import jwt
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext

# Configuration
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def request_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Session = Depends(get_session)
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_user(username: str, session: Session) -> User:
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        # Check if it's a burn address
        burn = session.exec(select(BurnAddress).where(BurnAddress.address == username, BurnAddress.is_active == True)).first()
        if burn:
            # Check if expired
            if burn.expires_at < datetime.now():
                burn.is_active = False
                session.add(burn)
                session.commit()
                raise HTTPException(status_code=404, detail="Burn address expired")
            return session.exec(select(User).where(User.username == burn.owner_username)).first()
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def set_user(user: User, session: Session):
    session.add(user)
    session.commit()
    session.refresh(user)

async def get_emails(user: User, session: Session) -> dict[str, Email]:
    emails = session.exec(select(Email).where(Email.recipient_username == user.username)).all()
    return {email.uuid: email for email in emails}

async def get_email(user: User, email_id: str, session: Session) -> Email:
    email = session.exec(select(Email).where(Email.uuid == email_id, Email.recipient_username == user.username)).first()
    if email is None:
         raise HTTPException(status_code=404, detail="Email not found")
    # Trigger loading of attachments for serialization
    _ = email.attachments
    return email

async def mark_read(user: User, email_id: str, session: Session) -> bool:
    email = session.exec(select(Email).where(Email.uuid == email_id, Email.recipient_username == user.username)).first()
    if email:
        email.read = True
        session.add(email)
        session.commit()
        return True
    return False

async def send_email(recipient_username: str, email_id: str, raw: str, sender_username: str, session: Session):
    # Fetch recipient
    recipient = session.exec(select(User).where(User.username == recipient_username)).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    email_size = len(raw.encode('utf-8'))
    
    # Check quota
    if recipient.storage_used + email_size > recipient.storage_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Recipient storage quota exceeded ({recipient.username})"
        )
    
    email = Email(
        uuid=email_id,
        recipient_username=recipient_username,
        data=raw,
        sender_username=sender_username,
        size=email_size
    )
    
    # Update recipient's used storage
    recipient.storage_used += email_size
    session.add(recipient)
    session.add(email)
    session.commit()
    session.refresh(email)
    return email

async def add_attachment(email_id: int, attachment_uuid: str, filename: str, mime_type: str, size: int, storage_path: str, encrypted_key: str, session: Session):
    attachment = Attachment(
        uuid=attachment_uuid,
        filename=filename,
        mime_type=mime_type,
        size=size,
        storage_path=storage_path,
        encrypted_key=encrypted_key,
        email_id=email_id
    )
    session.add(attachment)
    session.commit()
    return attachment

async def get_attachment(attachment_uuid: str, session: Session) -> Attachment:
    return session.exec(select(Attachment).where(Attachment.uuid == attachment_uuid)).first()

# Admin Functions
async def get_all_users(session: Session):
    return session.exec(select(User)).all()

async def update_user_tier(username: str, tier: str, limit: int, session: Session):
    user = session.exec(select(User).where(User.username == username)).first()
    if user:
        user.tier = tier
        user.storage_limit = limit
        session.add(user)
        session.commit()
        return True
    return False

# Root cert logic
async def set_root_cert(cert: str, session: Session):
    with open("root.crt", "w") as f:
        f.write(cert)

async def get_root_cert():
    if os.path.exists("root.crt"):
        with open("root.crt", "r") as f:
            return f.read()
    return None

# Data Lifecycle Management
async def delete_email(user: User, email_id: str, session: Session):
    stmt = select(Email).where(Email.uuid == email_id, Email.recipient_username == user.username)
    email = session.exec(stmt).first()
    if email:
        # Update user quota
        user.storage_used -= email.size
        # Delete attachments
        for att in email.attachments:
            if os.path.exists(att.storage_path):
                try:
                    os.remove(att.storage_path)
                except Exception: pass
            session.delete(att)
        session.delete(email)
        session.add(user)
        session.commit()
        return True
    return False

async def delete_user_account(user: User, session: Session):
    # Delete all user emails and attachments
    stmt = select(Email).where(Email.recipient_username == user.username)
    emails = session.exec(stmt).all()
    for email in emails:
        for att in email.attachments:
            if os.path.exists(att.storage_path):
                try:
                    os.remove(att.storage_path)
                except Exception: pass
            session.delete(att)
        session.delete(email)
    
    session.delete(user)
    session.commit()
    return True

async def reset_user_data(username: str, new_password_hash: str, session: Session):
    stmt = select(User).where(User.username == username)
    user = session.exec(stmt).first()
    if user:
        # Wipe all data as it's unrecoverable without old password
        stmt_emails = select(Email).where(Email.recipient_username == user.username)
        emails = session.exec(stmt_emails).all()
        for email in emails:
            for att in email.attachments:
                if os.path.exists(att.storage_path):
                    try:
                        os.remove(att.storage_path)
                    except Exception: pass
                session.delete(att)
            session.delete(email)
        
        user.password_hash = new_password_hash
        user.storage_used = 0
        user.public_key = ""
        user.encrypted_private_key = ""
        session.add(user)
        session.commit()
        return True
    return False

# Burn Addresses
async def create_burn_address(user: User, address: str, expires_in_hours: int, session: Session):
    expires_at = datetime.now() + timedelta(hours=expires_in_hours)
    burn = BurnAddress(address=address, owner_username=user.username, expires_at=expires_at)
    session.add(burn)
    session.commit()
    session.refresh(burn)
    return burn

async def get_user_burn_addresses(user: User, session: Session):
    return session.exec(select(BurnAddress).where(BurnAddress.owner_username == user.username, BurnAddress.is_active == True)).all()

# Private Drive
async def add_drive_file(user: User, file_uuid: str, filename: str, mime_type: str, size: int, storage_path: str, encrypted_key: str, session: Session):
    drive_file = DriveFile(
        uuid=file_uuid,
        owner_username=user.username,
        filename=filename,
        mime_type=mime_type,
        size=size,
        storage_path=storage_path,
        encrypted_key=encrypted_key
    )
    user.storage_used += size
    session.add(drive_file)
    session.add(user)
    session.commit()
    session.refresh(drive_file)
    return drive_file

async def get_drive_files(user: User, session: Session):
    return session.exec(select(DriveFile).where(DriveFile.owner_username == user.username)).all()

# WebAuthn
async def add_webauthn_credential(user: User, credential_id: str, public_key: str, transports: Optional[str], session: Session):
    cred = WebAuthnCredential(
        user_username=user.username,
        credential_id=credential_id,
        public_key=public_key,
        transports=transports
    )
    session.add(cred)
    session.commit()
    session.refresh(cred)
    return cred

async def get_user_credentials(username: str, session: Session):
    return session.exec(select(WebAuthnCredential).where(WebAuthnCredential.user_username == username)).all()