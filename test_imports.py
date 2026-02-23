try:
    import fastapi
    print("fastapi version:", fastapi.__version__)
    import sqlmodel
    print("sqlmodel version:", sqlmodel.__version__)
    import passlib
    print("passlib version:", passlib.__version__)
    import jwt
    print("pyjwt (jwt) version:", jwt.__version__)
    print("All core imports successful")
except Exception as e:
    print("Import failed:", e)
