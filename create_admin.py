import base64
import os
import secrets
import sys
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from database_setup import get_engine_from_env
from models import User


@dataclass(frozen=True)
class PasswordHash:
    scheme: str
    iterations: int
    salt_b64: str
    digest_b64: str

    def to_storage_string(self) -> str:
        # Format: pbkdf2_sha256$<iterations>$<salt_b64>$<digest_b64>
        return f"{self.scheme}${self.iterations}${self.salt_b64}${self.digest_b64}"


def hash_password_pbkdf2_sha256(password: str, *, iterations: int = 260_000) -> PasswordHash:
    import hashlib

    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32)
    salt_b64 = base64.urlsafe_b64encode(salt).decode("ascii").rstrip("=")
    digest_b64 = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return PasswordHash("pbkdf2_sha256", iterations, salt_b64, digest_b64)


def _get_admin_credentials() -> tuple[str, str]:
    username = os.getenv("ADMIN_USERNAME", "admin").strip()
    if not username:
        raise RuntimeError("ADMIN_USERNAME is empty.")

    pw = os.getenv("ADMIN_PASSWORD")
    if pw:
        return username, pw

    pw_b64 = os.getenv("ADMIN_PASSWORD_B64")
    if pw_b64:
        try:
            decoded = base64.b64decode(pw_b64).decode("utf-8")
            return username, decoded
        except Exception as e:
            raise RuntimeError(f"Failed to decode ADMIN_PASSWORD_B64: {e}") from e

    raise RuntimeError("Missing ADMIN_PASSWORD (or ADMIN_PASSWORD_B64).")


def main() -> None:
    engine, loaded_files = get_engine_from_env()
    if loaded_files:
        print(f"Loaded env from: {', '.join(loaded_files)}")

    username, password = _get_admin_credentials()
    hashed = hash_password_pbkdf2_sha256(password).to_storage_string()

    with Session(engine) as session:
        existing = session.execute(select(User).where(User.username == username)).scalar_one_or_none()
        if existing is None:
            session.add(User(username=username, hashed_password=hashed, is_active=True))
            session.commit()
            print(f"Admin user created: {username}")
            return

        # Idempotent: update hash if user already exists
        existing.hashed_password = hashed
        existing.is_active = True
        session.commit()
        print(f"Admin user already existed; password reset: {username}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Failed to create admin user: {e}")
        sys.exit(1)

