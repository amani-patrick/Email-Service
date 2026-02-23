from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    public_key: str = ""
    private_key: str = ""

class Email(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(unique=True)
    time: float = Field(default_factory=lambda: datetime.now().timestamp())
    read: bool = False
    data: str
    
    recipient_username: str = Field(foreign_key="user.username")
    sender_username: str