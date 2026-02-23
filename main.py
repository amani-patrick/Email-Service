from typing import Annotated
from fastapi import Body, Depends, FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from jinja2 import Template
from model import User, Email
from sqlmodel import Session
import asyncio
import db
import util
import uuid
import uvicorn
import sys
import os
from datetime import timedelta

app = FastAPI()

template = Template(open('./template.jinja2', 'r').read(), autoescape=True)
browser = asyncio.Lock()

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

@app.get('/api/me')
async def ok(user: Annotated[User, Depends(db.request_user)]):
    return user.username

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

@app.post('/api/mark_read/{email_id}')
async def mark_read(
    user: Annotated[User, Depends(db.request_user)], 
    email_id: str,
    session: Session = Depends(db.get_session)
) -> bool:
    return await db.mark_read(user, str(email_id), session)

@app.post('/api/send')
async def send(
    user: Annotated[User, Depends(db.request_user)],
    to: Annotated[str, Body()],
    subject: Annotated[str, Body()],
    body: Annotated[str, Body()],
    session: Session = Depends(db.get_session)
):
    recipient = await db.get_user(to, session)

    if len(user.public_key) == 0:
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
            cert=user.public_key,
            key=user.private_key
        )

    email_id = str(uuid.uuid4())
    await db.send_email(recipient.username, email_id, msg, session)

    return email_id

@app.get('/api/root_cert')
async def root_cert():
    cert = await db.get_root_cert()
    if cert is None:
        raise HTTPException(status_code=404, detail="Root cert not found")
    return cert

# Keep for debugging/admin but maybe restrict it
@app.post('/api/admin_bot')
async def admin_bot(user: Annotated[User, Depends(db.request_user)]):
    # This might need adjustment since we now use JWT and hashed passwords
    # For now, let's just leave a placeholder or disable it for production safety
    return {"message": "Admin bot functionality disabled in modern version for security reasons."}

if __name__ == "__main__":
    uvicorn.run(app, port=8000, host='0.0.0.0')