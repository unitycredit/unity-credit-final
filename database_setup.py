import logging
import os
import sys
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
    loaded_files = _load_env()
    if loaded_files:
        print(f"Loaded env from: {', '.join(loaded_files)}")
    else:
        print("No .env/.env.local found; using process environment only.")

    database_url = os.getenv("DATABASE_URL")
    password = os.getenv("DB_PASSWORD")

    # Don't attempt a network connection with placeholder secrets.
    if database_url and "YOUR_PASSWORD" in database_url:
        print(
            "DATABASE_URL still contains the placeholder 'YOUR_PASSWORD'.\n"
            "Update your local .env/.env.local with the real password, then rerun:\n"
            "  python database_setup.py"
        )
        sys.exit(2)
    if _is_placeholder_secret(password):
        print(
            "DB_PASSWORD is missing or still a placeholder.\n"
            "Set DB_PASSWORD (or DATABASE_URL) with your real AWS RDS password, then rerun:\n"
            "  python database_setup.py"
        )
        sys.exit(2)

    try:
        engine = create_db_engine()
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

