import os
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database_setup import get_engine_from_env


def _is_placeholder_secret(value: str | None) -> bool:
    if not value:
        return True
    v = value.strip()
    return v == "YOUR_PASSWORD" or v == "change-me" or v.startswith("replace-")


def _print_rows(title: str, rows: list[dict]) -> None:
    print(f"\n=== {title} ({len(rows)} rows) ===")
    if not rows:
        return
    # stable column order (as returned)
    cols = list(rows[0].keys())
    print(" | ".join(cols))
    for r in rows:
        print(" | ".join(str(r.get(c, "")) for c in cols))


def main() -> int:
    # Prevent `database_setup.py` from blocking on an interactive password prompt
    # when run in non-interactive automation (like Cursor tools).
    if _is_placeholder_secret(os.getenv("DB_PASSWORD")) and not os.getenv("DB_PASSWORD_B64"):
        os.environ["DB_PASSWORD"] = "__MISSING__"
        print("[check_user] Note: DB_PASSWORD was missing/placeholder; set to '__MISSING__' to avoid interactive prompt.")

    try:
        engine, loaded_files = get_engine_from_env()
        if loaded_files:
            print(f"Loaded env from: {', '.join(loaded_files)}")
        else:
            print("No .env/.env.local found; using process environment only.")
    except Exception as e:
        print(f"[check_user] Failed to load DB env / create engine: {e.__class__.__name__}: {e}")
        return 2

    # Optional filter: CHECK_USER_EMAIL / CHECK_USERNAME
    email = (os.getenv("CHECK_USER_EMAIL") or "").strip().lower()
    username = (os.getenv("CHECK_USERNAME") or "").strip().lower()

    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))

            # Prisma users table
            if email:
                users_rs = conn.execute(
                    text(
                        """
                        select id, email, password_hash, email_verified_at
                        from users
                        where lower(email) = :email
                        limit 20
                        """
                    ),
                    {"email": email},
                )
            else:
                users_rs = conn.execute(
                    text(
                        """
                        select id, email, password_hash, email_verified_at
                        from users
                        order by created_at desc nulls last
                        limit 20
                        """
                    )
                )
            users_rows = [dict(r._mapping) for r in users_rs.fetchall()]
            _print_rows("users table", users_rows)

            # Legacy/admin unity_users table (seeded by create_admin.py)
            if username:
                admin_rs = conn.execute(
                    text(
                        """
                        select id, username, hashed_password, is_active
                        from unity_users
                        where lower(username) = :u
                        limit 20
                        """
                    ),
                    {"u": username},
                )
            else:
                admin_rs = conn.execute(
                    text(
                        """
                        select id, username, hashed_password, is_active
                        from unity_users
                        order by id desc
                        limit 20
                        """
                    )
                )
            admin_rows = [dict(r._mapping) for r in admin_rs.fetchall()]
            _print_rows("unity_users table", admin_rows)

        return 0
    except SQLAlchemyError as e:
        print(f"[check_user] DB query failed: {e.__class__.__name__}: {e}")
        return 1
    except Exception as e:
        print(f"[check_user] Unexpected error: {e.__class__.__name__}: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

