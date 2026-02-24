from cryptography.hazmat.primitives import serialization
from model import User, Email
from jinja2 import Template
from sqlmodel import Session, select
import asyncio
import db
import secrets
import uuid
import util
import os

template = Template(open('./template.jinja2', 'r').read(), autoescape=True)

async def init():
    # Initialize DB tables
    db.create_db_and_tables()
    
    with Session(db.engine) as session:
        # Check if already initialized
        admin_exists = session.exec(select(User).where(User.username == 'admin@ses')).first()
        if admin_exists:
            print("Database already initialized.")
            return

        ca_pub, ca_priv = util.generate_root_cert()
        await db.set_root_cert(ca_pub.public_bytes(serialization.Encoding.PEM).decode(), session)

        admin_password = secrets.token_hex(16)
        admin_cert, admin_priv_key = util.generate_sign_cert('admin@ses', ca_pub, ca_priv)
        admin_pub_pem, admin_priv_pem = util.export((admin_cert, admin_priv_key))
        
        admin = User(
            username='admin@ses',
            password_hash=db.get_password_hash(admin_password),
            public_key=util.rsa_pub_to_jwk(admin_pub_pem),
            certificate=admin_pub_pem,
            encrypted_private_key=util.wrap_private_key_python(util.rsa_priv_to_jwk(admin_priv_key), admin_password),
            is_admin=True
        )
        session.add(admin)

        user_password = secrets.token_hex(16)
        user_cert, user_priv_key = util.generate_sign_cert('user@ses', ca_pub, ca_priv)
        user_pub_pem, _ = util.export((user_cert, user_priv_key))

        user = User(
            username='user@ses',
            password_hash=db.get_password_hash(user_password),
            public_key=util.rsa_pub_to_jwk(user_pub_pem),
            certificate=user_pub_pem,
            encrypted_private_key=util.wrap_private_key_python(util.rsa_priv_to_jwk(user_priv_key), user_password),
            is_admin=False
        )
        session.add(user)
        
        session.commit()
        session.refresh(admin)
        session.refresh(user)

        msg = util.generate_email(
            sender=admin.username,
            recipient=user.username,
            subject='Welcome to Secure Email Service!',
            content=template.render(title='Welcome!', content='\n\n'.join([
                'Welcome to Secure Email Service (SES)!',
                'We\'re excited to have you on board and look forward to helping you manage your email needs with ease and reliability.',
                'If you have any questions or need assistance, feel free to reach out to us at admin@ses. Our team is here to support you every step of the way.',
                'Thank you for choosing SES!',
                'Best regards,',
                'The Secure Email Service Team'
            ])),
            html=True,
            sign=True,
            cert=admin.certificate,
            key=admin_priv_pem
        )
        await db.send_email(user.username, str(uuid.uuid4()), msg, admin.username, session)

        print('--- Initialization Complete ---')
        print('User username:', user.username)
        print('User password:', user_password)
        print('Admin username:', admin.username)
        print('Admin password:', admin_password)
        print('-------------------------------')

if __name__ == "__main__":
    asyncio.run(init())