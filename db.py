from typing import Annotated, Optional
from fastapi import HTTPException, Header, status, Depends
from sqlmodel import Session, create_engine, select, SQLModel
from model import User, Email
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
    token: Annotated[str, Header()],
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
    return email

async def mark_read(user: User, email_id: str, session: Session) -> bool:
    email = session.exec(select(Email).where(Email.uuid == email_id, Email.recipient_username == user.username)).first()
    if email:
        email.read = True
        session.add(email)
        session.commit()
        return True
    return False

async def send_email(recipient_username: str, email_id: str, raw: str, session: Session):
    email = Email(
        uuid=email_id,
        recipient_username=recipient_username,
        data=raw,
        sender_username="unknown", 
    )
    session.add(email)
    session.commit()

# Root cert logic
async def set_root_cert(cert: str, session: Session):
    # This might need a separate table or a simple file for now
    # For compatibility, let's just store it in a simple KeyValue table or file
    with open("root.crt", "w") as f:
        f.write(cert)

async def get_root_cert():
    if os.path.exists("root.crt"):
        with open("root.crt", "r") as f:
            return f.read()
    return None