import logging
import os
import sys
import base64
import getpass
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


def _load_env() -> list[str]:
    """
    Load env vars from common local files (if present).
    Priority: .env -> .env.local -> env.example
    """
    # Silence noisy dotenv parsing warnings; we'll validate required vars ourselves.
    logging.getLogger("dotenv").setLevel(logging.ERROR)
    logging.getLogger("dotenv.main").setLevel(logging.ERROR)

    here = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.join(here, ".env"),
        os.path.join(here, ".env.local"),
        os.path.join(here, "env.example"),
    ]
    loaded: list[str] = []
    for path in candidates:
        if os.path.exists(path):
            load_dotenv(path, override=False)
            loaded.append(os.path.basename(path))
    return loaded


def _is_placeholder_secret(value: str | None) -> bool:
    if not value:
        return True
    v = value.strip()
    return v == "YOUR_PASSWORD" or v == "change-me" or v.startswith("replace-")

def _resolve_password_interactively_if_needed() -> None:
    """
    Ensure DB_PASSWORD is available.

    Resolution order:
    1) DB_PASSWORD (if non-placeholder)
    2) DB_PASSWORD_B64 (base64-encoded UTF-8 password)
    3) Interactive prompt (if running in a real terminal)
    """
    current = os.getenv("DB_PASSWORD")
    if not _is_placeholder_secret(current):
        return

    b64 = os.getenv("DB_PASSWORD_B64")
    if b64:
        try:
            decoded = base64.b64decode(b64).decode("utf-8")
            if not _is_placeholder_secret(decoded):
                os.environ["DB_PASSWORD"] = decoded
                return
        except Exception:
            # fall through to prompt / error
            pass

    if sys.stdin is not None and sys.stdin.isatty():
        pw = getpass.getpass("Enter DB_PASSWORD for AWS RDS: ")
        if pw and not _is_placeholder_secret(pw):
            os.environ["DB_PASSWORD"] = pw
            return

    raise RuntimeError(
        "DB_PASSWORD is missing/placeholder and no interactive input is available. "
        "Set DB_PASSWORD (or DB_PASSWORD_B64) and rerun."
    )


def get_engine_from_env():
    """
    Load local env vars (if present), ensure a real DB password exists, and return a SQLAlchemy engine.

    Returns:
      (engine, loaded_files)
    """
    loaded_files = _load_env()

    database_url = os.getenv("DATABASE_URL") or ""
    if "YOUR_PASSWORD" in database_url:
        # Ignore placeholder DATABASE_URL and rely on DB_* pieces instead.
        os.environ.pop("DATABASE_URL", None)

    _resolve_password_interactively_if_needed()
    return create_db_engine(), loaded_files


def get_database_url() -> str:
    """
    Resolve DATABASE_URL, or construct one from DB_* pieces.
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "5432")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD")
    dbname = os.getenv("DB_NAME", "postgres")

    if not host:
        raise RuntimeError(
            "Missing DB connection info. Set DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME."
        )

    if password is None:
        raise RuntimeError("Missing DB_PASSWORD in environment.")

    # URL-encode password to safely handle special characters.
    return f"postgresql+psycopg2://{user}:{quote_plus(password)}@{host}:{port}/{dbname}"


def create_db_engine():
    database_url = get_database_url()
    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10},
    )


def test_connection() -> None:
    try:
        engine, loaded_files = get_engine_from_env()
    except Exception as e:
        print(str(e))
        sys.exit(2)

    if loaded_files:
        print(f"Loaded env from: {', '.join(loaded_files)}")
    else:
        print("No .env/.env.local found; using process environment only.")

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Connection Successful")
    except SQLAlchemyError as e:
        print("❌ Database connection failed.")
        print(f"SQLAlchemy error: {e.__class__.__name__}: {e}")
        sys.exit(1)
    except Exception as e:
        print("❌ Database connection failed.")
        print(f"Error: {e.__class__.__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    test_connection()

