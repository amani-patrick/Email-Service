import json
import datetime
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding

def generate_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    
    with open("license_private.pem", "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    
    with open("license_public.pem", "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print("Master Keypair generated: license_private.pem and license_public.pem")

def create_license(customer, expiry_days, seats, tier="Enterprise"):
    with open("license_private.pem", "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)
    
    expiry = (datetime.datetime.now() + datetime.timedelta(days=expiry_days)).isoformat()
    license_data = {
        "customer": customer,
        "expiry": expiry,
        "seats": seats,
        "tier": tier,
        "issued_at": datetime.datetime.now().isoformat()
    }
    
    message = json.dumps(license_data, sort_keys=True).encode()
    signature = private_key.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    
    license_bundle = {
        "data": license_data,
        "signature": base64.b64encode(signature).decode()
    }
    
    with open("enterprise_license.lic", "w") as f:
        json.dump(license_bundle, f, indent=4)
    print(f"License generated for {customer} (Exp: {expiry}) -> enterprise_license.lic")

if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="SecureMail Enterprise license generator")
    parser.add_argument("--generate-keys", action="store_true", help="Generate vendor keypair")
    parser.add_argument("--customer", type=str, help="Customer organization name")
    parser.add_argument("--days", type=int, default=365, help="License validity in days")
    parser.add_argument("--seats", type=int, default=50, help="Provisioned user seats")
    parser.add_argument("--tier", type=str, default="Enterprise", help="License tier")
    args = parser.parse_args()

    if args.generate_keys or not os.path.exists("license_private.pem"):
        generate_keypair()

    if args.customer:
        create_license(args.customer, args.days, args.seats, args.tier)
    elif not args.generate_keys:
        customer = input("Customer Name: ")
        days = int(input("Expiry Days (e.g., 365): "))
        seats = int(input("Seat Count: "))
        create_license(customer, days, seats)
