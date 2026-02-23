from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    public_key: str = ""
    encrypted_private_key: str = ""
    
    # Commercial fields
    tier: str = Field(default="Free") # Free, Pro, Enterprise
    storage_limit: int = Field(default=104857600) # Default 100MB in bytes
    storage_used: int = Field(default=0)
    is_admin: bool = Field(default=False)

class Email(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True)
    time: float = Field(default_factory=lambda: datetime.now().timestamp())
    read: bool = False
    data: str
    size: int = Field(default=0) # Size in bytes
    
    recipient_username: str = Field(foreign_key="user.username")
    sender_username: str
    
    attachments: List["Attachment"] = Relationship(back_populates="email")

class Attachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True)
    filename: str
    mime_type: str
    size: int
    storage_path: str
    encrypted_key: str = "" # AES key encrypted with recipient public key
    
    email_id: int = Field(foreign_key="email.id")
    email: Optional[Email] = Relationship(back_populates="attachments")