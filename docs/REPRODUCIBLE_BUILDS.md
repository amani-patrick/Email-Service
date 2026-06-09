# Reproducible Builds

SecureMail Enterprise supports verifiable deployments for customers and auditors who need to confirm that running binaries match published source.

---

## Docker (recommended)

### Build with pinned base images

The `Dockerfile` uses explicit tags:

- `node:22.0.0-slim` (frontend build)
- `python:3.11-slim` (runtime)

Python dependencies are pinned in `requirements.txt` with exact versions.

### Reproduce a build

```bash
# Record source hash
git rev-parse HEAD > BUILD_COMMIT

# Build
docker build --no-cache -t securemail-enterprise:$(cat BUILD_COMMIT | cut -c1-8) .

# Record image digest
docker inspect --format='{{index .RepoDigests 0}}' securemail-enterprise:$(cat BUILD_COMMIT | cut -c1-8)
```

Customers should store the **image digest** alongside their deployment documentation.

### Verify contents

```bash
docker run --rm securemail-enterprise:TAG pip freeze
docker run --rm securemail-enterprise:TAG python -c "import crypto_spec; print(crypto_spec.get_crypto_spec())"
```

---

## Manual (non-Docker) build

```bash
# Frontend — lockfile required
cd frontend && npm ci && npm run build && cd ..

# Backend — hash-locked installs
pip install --require-hashes -r requirements.txt  # optional: generate hashes with pip-tools

# Record versions
pip freeze > BUILD_PIP_FREEZE.txt
node --version > BUILD_NODE_VERSION.txt
python --version > BUILD_PYTHON_VERSION.txt
```

---

## Supply chain notes

| Component | Pin mechanism |
|-----------|---------------|
| Python packages | `requirements.txt` exact versions |
| Node packages | `package-lock.json` |
| Base OS image | Dockerfile `FROM` tag |
| Crypto algorithms | `crypto_spec.py` + `/api/crypto/specification` |

---

## Auditor workflow

1. Obtain source at tagged release (e.g. `v1.0.0-enterprise`).
2. Rebuild Docker image with `--no-cache`.
3. Compare `pip freeze` and frontend bundle hashes to customer deployment.
4. Hit `/api/crypto/compliance` on running instance — all checks should be `true`.
5. Cross-reference `docs/THREAT_MODEL.md` and `docs/AUDIT_READINESS.md`.

---

## Release checklist (vendor)

- [ ] Tag git release
- [ ] Publish image digest
- [ ] Attach `requirements.txt` + `package-lock.json` to release notes
- [ ] Sign release notes with vendor GPG key (optional)
- [ ] Update `crypto_spec.py` version if algorithms change
