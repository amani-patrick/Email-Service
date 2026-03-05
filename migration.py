"""
Migration Tooling Module
- IMAP import utility
- Contact import (vCard/CSV)
- Forwarding bridge during transition
"""

import imaplib
import email
from email.utils import parseaddr
import csv
import json
import base64
import uuid
import os
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any, Callable
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IMAPImporter:
    """
    IMAP Import Utility for migrating emails from external providers.
    Runs locally or via secure worker - never exposes plaintext to server.
    """
    
    def __init__(self, host: str, port: int = 993, use_ssl: bool = True):
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.connection = None
        self.progress_callback: Optional[Callable] = None
    
    def set_progress_callback(self, callback: Callable):
        """Set a callback function for progress updates"""
        self.progress_callback = callback
    
    async def connect(self, username: str, password: str) -> bool:
        """Connect to IMAP server"""
        try:
            if self.use_ssl:
                self.connection = imaplib.IMAP4_SSL(self.host, self.port)
            else:
                self.connection = imaplib.IMAP4(self.host, self.port)
                self.connection.starttls()
            
            self.connection.login(username, password)
            logger.info(f"Connected to IMAP server {self.host}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IMAP: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from IMAP server"""
        if self.connection:
            try:
                self.connection.close()
                self.connection.logout()
            except Exception:
                pass
            self.connection = None
    
    async def list_folders(self) -> List[str]:
        """List all folders/mailboxes in the account"""
        if not self.connection:
            return []
        
        try:
            status, folders = self.connection.list()
            folder_names = []
            for folder in folders:
                # Parse folder name from IMAP LIST response
                parts = folder.decode().split('"')
                if len(parts) >= 3:
                    folder_names.append(parts[-2])
            return folder_names
        except Exception as e:
            logger.error(f"Failed to list folders: {e}")
            return []
    
    async def count_messages(self, folder: str = "INBOX") -> int:
        """Count messages in a folder"""
        if not self.connection:
            return 0
        
        try:
            status, data = self.connection.select(folder)
            if status != 'OK':
                return 0
            
            status, search_data = self.connection.search(None, 'ALL')
            if status != 'OK':
                return 0
            
            message_ids = search_data[0].split()
            return len(message_ids)
        except Exception as e:
            logger.error(f"Failed to count messages: {e}")
            return 0
    
    async def fetch_messages(
        self,
        folder: str = "INBOX",
        limit: int = None,
        offset: int = 0,
        encrypt_func: Callable = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch messages from IMAP server.
        
        Args:
            folder: IMAP folder name
            limit: Maximum number of messages to fetch
            offset: Number of messages to skip
            encrypt_func: Optional function to encrypt message content
        
        Returns:
            List of message dictionaries with metadata and content
        """
        if not self.connection:
            return []
        
        messages = []
        
        try:
            status, data = self.connection.select(folder)
            if status != 'OK':
                logger.error(f"Failed to select folder {folder}")
                return []
            
            status, search_data = self.connection.search(None, 'ALL')
            if status != 'OK':
                return []
            
            message_ids = search_data[0].split()
            total = len(message_ids)
            
            # Apply offset and limit
            if offset > 0:
                message_ids = message_ids[offset:]
            if limit:
                message_ids = message_ids[:limit]
            
            for i, msg_id in enumerate(message_ids):
                try:
                    # Fetch message
                    status, msg_data = self.connection.fetch(msg_id, '(RFC822)')
                    if status != 'OK':
                        continue
                    
                    raw_message = msg_data[0][1]
                    parsed = email.message_from_bytes(raw_message)
                    
                    # Extract metadata
                    from_addr = parsed.get('From', '')
                    to_addr = parsed.get('To', '')
                    subject = parsed.get('Subject', '')
                    date = parsed.get('Date', '')
                    
                    # Extract body
                    body = ""
                    html_body = ""
                    attachments = []
                    
                    if parsed.is_multipart():
                        for part in parsed.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get('Content-Disposition', ''))
                            
                            if 'attachment' in content_disposition:
                                att_data = part.get_payload(decode=True)
                                attachments.append({
                                    'filename': part.get_filename(),
                                    'mime_type': content_type,
                                    'data': base64.b64encode(att_data).decode() if att_data else '',
                                    'size': len(att_data) if att_data else 0
                                })
                            elif content_type == 'text/plain':
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body = payload.decode('utf-8', errors='replace')
                            elif content_type == 'text/html':
                                payload = part.get_payload(decode=True)
                                if payload:
                                    html_body = payload.decode('utf-8', errors='replace')
                    else:
                        payload = parsed.get_payload(decode=True)
                        if payload:
                            body = payload.decode('utf-8', errors='replace')
                    
                    # Encrypt if function provided
                    if encrypt_func:
                        body = await encrypt_func(body)
                        if html_body:
                            html_body = await encrypt_func(html_body)
                    
                    message = {
                        'id': str(uuid.uuid4()),
                        'from': from_addr,
                        'to': to_addr,
                        'subject': subject,
                        'date': date,
                        'body': body,
                        'html_body': html_body,
                        'attachments': attachments,
                        'raw': base64.b64encode(raw_message).decode(),
                        'size': len(raw_message)
                    }
                    
                    messages.append(message)
                    
                    # Progress callback
                    if self.progress_callback:
                        await self.progress_callback({
                            'current': i + 1,
                            'total': len(message_ids),
                            'folder': folder,
                            'message_id': message['id']
                        })
                    
                except Exception as e:
                    logger.warning(f"Failed to fetch message {msg_id}: {e}")
                    continue
            
            return messages
            
        except Exception as e:
            logger.error(f"Failed to fetch messages: {e}")
            return []
    
    async def import_to_ses(
        self,
        folder: str = "INBOX",
        username: str,
        session,
        encrypt_func: Callable = None,
        re_encrypt_func: Callable = None
    ) -> Dict[str, Any]:
        """
        Import emails from IMAP to SES.
        
        Args:
            folder: IMAP folder to import
            username: SES username to import to
            session: Database session
            encrypt_func: Function to encrypt message content
            re_encrypt_func: Function to re-encrypt with SES keys
        
        Returns:
            Import statistics
        """
        from model import Email
        
        stats = {
            'total': 0,
            'imported': 0,
            'failed': 0,
            'total_size': 0
        }
        
        messages = await self.fetch_messages(folder, encrypt_func=encrypt_func)
        stats['total'] = len(messages)
        
        for msg in messages:
            try:
                # Create email record
                email_record = Email(
                    uuid=msg['id'],
                    recipient_username=username,
                    sender_username=parseaddr(msg['from'])[1] or msg['from'],
                    data=msg['raw'],
                    size=msg['size']
                )
                session.add(email_record)
                stats['imported'] += 1
                stats['total_size'] += msg['size']
                
            except Exception as e:
                logger.warning(f"Failed to import message: {e}")
                stats['failed'] += 1
        
        session.commit()
        return stats


class ContactImporter:
    """
    Contact Import Utility for vCard and CSV formats.
    """
    
    @staticmethod
    def parse_vcard(vcard_content: str) -> List[Dict[str, str]]:
        """Parse vCard format contacts"""
        contacts = []
        current_contact = {}
        
        lines = vcard_content.split('\n')
        
        for line in lines:
            line = line.strip()
            
            if line.startswith('BEGIN:VCARD'):
                current_contact = {}
            elif line.startswith('END:VCARD'):
                if current_contact:
                    contacts.append(current_contact)
                    current_contact = {}
            elif ':' in line:
                key, value = line.split(':', 1)
                
                # Handle vCard property parameters
                if ';' in key:
                    key = key.split(';')[0]
                
                key = key.upper()
                
                # Map vCard fields
                if key == 'FN':
                    current_contact['name'] = value
                elif key == 'EMAIL':
                    current_contact['email'] = value
                elif key == 'TEL':
                    current_contact['phone'] = value
                elif key == 'ORG':
                    current_contact['organization'] = value
                elif key == 'TITLE':
                    current_contact['title'] = value
                elif key == 'URL':
                    current_contact['url'] = value
                elif key == 'NOTE':
                    current_contact['notes'] = value
        
        return contacts
    
    @staticmethod
    def parse_csv(csv_content: str, field_mapping: Dict[str, int] = None) -> List[Dict[str, str]]:
        """
        Parse CSV format contacts.
        
        Args:
            csv_content: CSV file content
            field_mapping: Optional mapping of field names to column indices
        """
        contacts = []
        
        lines = csv_content.split('\n')
        if not lines:
            return contacts
        
        # Auto-detect header
        header = lines[0].split(',')
        header = [h.strip().lower().strip('"') for h in header]
        
        # Default field mappings
        field_aliases = {
            'email': ['email', 'email_address', 'e-mail', 'mail'],
            'name': ['name', 'full_name', 'contact_name', 'display_name'],
            'phone': ['phone', 'phone_number', 'tel', 'mobile', 'cell'],
            'organization': ['organization', 'company', 'org', 'business'],
            'title': ['title', 'job_title', 'position'],
        }
        
        # Find column indices
        indices = {}
        for field, aliases in field_aliases.items():
            for i, col in enumerate(header):
                if col in aliases:
                    indices[field] = i
                    break
        
        # Parse rows
        for line in lines[1:]:
            if not line.strip():
                continue
            
            # Handle quoted CSV
            values = []
            in_quote = False
            current = ""
            
            for char in line:
                if char == '"':
                    in_quote = not in_quote
                elif char == ',' and not in_quote:
                    values.append(current.strip().strip('"'))
                    current = ""
                else:
                    current += char
            values.append(current.strip().strip('"'))
            
            contact = {}
            for field, idx in indices.items():
                if idx < len(values):
                    contact[field] = values[idx]
            
            if contact.get('email'):
                contacts.append(contact)
        
        return contacts
    
    @staticmethod
    async def import_contacts(
        contacts: List[Dict[str, str]],
        username: str,
        session,
        encrypt_func: Callable = None
    ) -> Dict[str, Any]:
        """
        Import contacts to SES.
        
        Args:
            contacts: List of contact dictionaries
            username: SES username
            session: Database session
            encrypt_func: Optional function to encrypt contact data
        """
        from model import Contact
        
        stats = {
            'total': len(contacts),
            'imported': 0,
            'failed': 0
        }
        
        for contact in contacts:
            try:
                # Encrypt contact data if function provided
                contact_data = json.dumps(contact)
                if encrypt_func:
                    contact_data = await encrypt_func(contact_data)
                
                contact_record = Contact(
                    uuid=str(uuid.uuid4()),
                    owner_username=username,
                    encrypted_data=contact_data if encrypt_func else contact_data,
                    email=contact.get('email', ''),
                    name=contact.get('name', '')
                )
                session.add(contact_record)
                stats['imported'] += 1
                
            except Exception as e:
                logger.warning(f"Failed to import contact: {e}")
                stats['failed'] += 1
        
        session.commit()
        return stats


class ForwardingBridge:
    """
    Forwarding bridge for transition period.
    Forwards emails from legacy account to SES during migration.
    """
    
    def __init__(self, smtp_config: dict):
        self.smtp_host = smtp_config.get('host', 'localhost')
        self.smtp_port = smtp_config.get('port', 25)
        self.smtp_user = smtp_config.get('user', '')
        self.smtp_pass = smtp_config.get('password', '')
        self.use_ssl = smtp_config.get('ssl', True)
    
    async def setup_forwarding_rule(
        self,
        legacy_email: str,
        ses_address: str,
        provider: str = 'generic'
    ) -> Dict[str, Any]:
        """
        Generate instructions for setting up forwarding.
        
        Note: Actual forwarding setup requires access to the legacy provider's
        settings. This returns instructions for manual setup or API calls.
        """
        instructions = {
            'legacy_email': legacy_email,
            'ses_address': ses_address,
            'provider': provider,
            'methods': []
        }
        
        # Provider-specific instructions
        if 'gmail' in provider.lower() or 'google' in provider.lower():
            instructions['methods'].append({
                'type': 'gmail_filter',
                'steps': [
                    '1. Go to Gmail Settings > Filters and Blocked Addresses',
                    '2. Click "Create a new filter"',
                    f'3. In "To" field, enter: {legacy_email}',
                    '4. Click "Create filter"',
                    '5. Check "Forward it to:" and enter your SES address',
                    '6. Click "Create filter"'
                ]
            })
        
        elif 'outlook' in provider.lower() or 'microsoft' in provider.lower():
            instructions['methods'].append({
                'type': 'outlook_rule',
                'steps': [
                    '1. Go to Outlook Settings > Mail > Forwarding',
                    '2. Select "Enable forwarding"',
                    f'3. Enter your SES address: {ses_address}',
                    '4. Optionally check "Keep a copy of forwarded messages"',
                    '5. Click Save'
                ]
            })
        
        else:
            instructions['methods'].append({
                'type': 'generic',
                'steps': [
                    f'1. Log into your email provider for {legacy_email}',
                    '2. Look for "Forwarding" or "Mail Settings"',
                    f'3. Set up forwarding to: {ses_address}',
                    '4. Verify the forwarding works by sending a test email'
                ]
            })
        
        # Programmatic method (if provider supports API)
        instructions['api_method'] = {
            'endpoint': f'/api/forwarding/setup',
            'method': 'POST',
            'body': {
                'legacy_email': legacy_email,
                'ses_address': ses_address
            }
        }
        
        return instructions
    
    async def verify_forwarding(
        self,
        legacy_email: str,
        ses_address: str,
        test_code: str = None
    ) -> Dict[str, Any]:
        """
        Verify forwarding is working by checking if test message arrives.
        """
        if not test_code:
            test_code = str(uuid.uuid4())[:8]
        
        return {
            'test_code': test_code,
            'instructions': f'Send an email from {legacy_email} to {ses_address} with subject "VERIFY-{test_code}"',
            'check_endpoint': f'/api/forwarding/verify/{test_code}'
        }


class MigrationManager:
    """
    Orchestrates the full migration process.
    """
    
    def __init__(self):
        self.imap_importer: Optional[IMAPImporter] = None
        self.contact_importer = ContactImporter()
        self.forwarding_bridge: Optional[ForwardingBridge] = None
    
    async def start_imap_migration(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        ses_username: str,
        session,
        folders: List[str] = None,
        encrypt_func: Callable = None
    ) -> Dict[str, Any]:
        """
        Start a full IMAP migration.
        """
        self.imap_importer = IMAPImporter(host, port)
        
        connected = await self.imap_importer.connect(username, password)
        if not connected:
            return {'status': 'error', 'message': 'Failed to connect to IMAP server'}
        
        if not folders:
            folders = await self.imap_importer.list_folders()
        
        results = {
            'status': 'success',
            'folders': {},
            'total_imported': 0,
            'total_failed': 0,
            'total_size': 0
        }
        
        for folder in folders:
            stats = await self.imap_importer.import_to_ses(
                folder=folder,
                username=ses_username,
                session=session,
                encrypt_func=encrypt_func
            )
            results['folders'][folder] = stats
            results['total_imported'] += stats['imported']
            results['total_failed'] += stats['failed']
            results['total_size'] += stats['total_size']
        
        self.imap_importer.disconnect()
        
        return results
    
    async def import_contacts_from_file(
        self,
        file_path: str,
        username: str,
        session,
        encrypt_func: Callable = None
    ) -> Dict[str, Any]:
        """
        Import contacts from a file (vCard or CSV).
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Detect format
        if file_path.endswith('.vcf') or 'BEGIN:VCARD' in content:
            contacts = ContactImporter.parse_vcard(content)
        else:
            contacts = ContactImporter.parse_csv(content)
        
        return await self.contact_importer.import_contacts(
            contacts=contacts,
            username=username,
            session=session,
            encrypt_func=encrypt_func
        )


# Export instances
migration_manager = MigrationManager()
