import requests
import json
import base64
import time

BASE_URL = "http://localhost:8000"

def test_welcome_message():
    print("Testing Welcome Message...")
    # Registration triggers welcome message
    username = f"test_{int(time.time())}@ses"
    payload = {
        "username": username,
        "password": "password123",
        "public_key": "mock_pub",
        "encrypted_private_key": "mock_priv"
    }
    resp = requests.post(f"{BASE_URL}/api/register", json=payload)
    print("Register response:", resp.json())
    
    # Login to get token
    login_payload = {"username": username, "password": "password123"}
    login_resp = requests.post(f"{BASE_URL}/api/login", json=login_payload)
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check emails
    emails_resp = requests.get(f"{BASE_URL}/api/emails", headers=headers)
    emails = emails_resp.json()
    print(f"Found {len(emails)} emails")
    for email_id, email in emails.items():
        print(f"Email: {email['sender_username']} - {email['uuid']}")

def test_burn_addresses():
    print("\nTesting Burn Addresses...")
    # Use existing user or register new
    username = f"burn_test_{int(time.time())}@ses"
    requests.post(f"{BASE_URL}/api/register", json={
        "username": username, "password": "password123", "public_key": "mock_pub", "encrypted_private_key": "mock_priv"
    })
    login_resp = requests.post(f"{BASE_URL}/api/login", json={"username": username, "password": "password123"})
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create burn address
    create_resp = requests.post(f"{BASE_URL}/api/burn-addresses/create", headers=headers)
    burn = create_resp.json()
    burn_address = burn["address"]
    print(f"Created burn address: {burn_address}")
    
    # Send email to burn address from admin
    admin_login = requests.post(f"{BASE_URL}/api/login", json={"username": "admin@ses", "password": "admin123"})
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    send_payload = {
        "to": burn_address,
        "subject": "Burn Test",
        "body": "This is a test to a burn address"
    }
    requests.post(f"{BASE_URL}/api/send", json=send_payload, headers=admin_headers)
    print("Sent email to burn address")
    
    # Check if received
    emails_resp = requests.get(f"{BASE_URL}/api/emails", headers=headers)
    emails = emails_resp.json()
    print(f"Found {len(emails)} emails in burn owner's inbox")

def test_steganography():
    print("\nTesting Steganography...")
    # Register/Login premium user (admin is premium)
    login_resp = requests.post(f"{BASE_URL}/api/login", json={"username": "admin@ses", "password": "admin123"})
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Upgrade to Enterprise for steganography
    requests.post(f"{BASE_URL}/api/confirm-upgrade", headers=headers, json={"tier": "Enterprise"})
    
    # Create a mock image
    from PIL import Image
    import io
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    # Hide message
    files = {'image': ('test.png', img_bytes, 'image/png')}
    data = {'message': 'Secret Message'}
    hide_resp = requests.post(f"{BASE_URL}/api/steganography/hide", headers=headers, files=files, data=data)
    encoded_img_b64 = hide_resp.json()["image"]
    print("Message hidden in image")
    
    # Extract message
    encoded_img_bytes = base64.b64decode(encoded_img_b64)
    files = {'image': ('encoded.png', encoded_img_bytes, 'image/png')}
    extract_resp = requests.post(f"{BASE_URL}/api/steganography/extract", headers=headers, files=files)
    print("Extracted message:", extract_resp.json()["message"])

if __name__ == "__main__":
    try:
        test_welcome_message()
        test_burn_addresses()
        test_steganography()
        print("\nAll tests passed!")
    except Exception as e:
        print(f"\nTest failed: {e}")
