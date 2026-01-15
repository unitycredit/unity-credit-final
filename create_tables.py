from sqlalchemy import inspect

from database_setup import get_engine_from_env
from models import Base


def main() -> None:
    engine, loaded_files = get_engine_from_env()
    if loaded_files:
        print(f"Loaded env from: {', '.join(loaded_files)}")

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if inspector.has_table("unity_users"):
        print("User table created (unity_users).")
    else:
        raise RuntimeError("Expected table 'unity_users' was not created.")


if __name__ == "__main__":
    main()

