"""
AWS-only bootstrap helper (Python/boto3).

Why this exists:
- The main app is Next.js (Node.js), so it uses AWS SDK for JavaScript in runtime.
- Some operators prefer Python tooling. This script uses boto3 to fetch Secrets Manager
  values and prints export-friendly lines for local development or CI.

Usage:
  pip install boto3
  set AWS_PROFILE=yourprofile   (or configure env creds)
  set AWS_REGION=us-east-2
  set UC_DB_SECRET_ARN=arn:aws:secretsmanager:...
  set UC_NEXTAUTH_SECRET_ARN=arn:aws:secretsmanager:...
  python scripts/aws_secrets_bootstrap.py

Expected secret formats:
- UC_DB_SECRET_ARN JSON:
    {
      "DB_HOST": "...",
      "DB_PORT": "5432",
      "DB_USER": "...",
      "DB_PASSWORD": "...",
      "DB_NAME": "..."
    }
  (or "DATABASE_URL": "postgresql://...")

- UC_NEXTAUTH_SECRET_ARN JSON:
    { "NEXTAUTH_SECRET": "..." }
"""

from __future__ import annotations

import json
import os
import sys


def _get_secret(sm, secret_id: str) -> str:
    resp = sm.get_secret_value(SecretId=secret_id)
    s = resp.get("SecretString") or ""
    if not s:
        raise RuntimeError(f"SecretString is empty for {secret_id}")
    return s


def main() -> int:
    try:
        import boto3  # type: ignore
    except Exception:
        print("Missing boto3. Install: pip install boto3", file=sys.stderr)
        return 2

    region = (os.getenv("AWS_REGION") or "").strip()
    if not region:
        print("Missing AWS_REGION", file=sys.stderr)
        return 2

    db_arn = (os.getenv("UC_DB_SECRET_ARN") or "").strip()
    jwt_arn = (os.getenv("UC_NEXTAUTH_SECRET_ARN") or "").strip()
    if not db_arn and not jwt_arn:
        print("Set UC_DB_SECRET_ARN and/or UC_NEXTAUTH_SECRET_ARN", file=sys.stderr)
        return 2

    sm = boto3.client("secretsmanager", region_name=region)

    out: dict[str, str] = {}

    if db_arn:
        raw = _get_secret(sm, db_arn)
        data = json.loads(raw)
        for k in ["DATABASE_URL", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]:
            v = data.get(k)
            if v:
                out[k] = str(v)

    if jwt_arn:
        raw = _get_secret(sm, jwt_arn)
        data = json.loads(raw)
        v = data.get("NEXTAUTH_SECRET")
        if v:
            out["NEXTAUTH_SECRET"] = str(v)

    # Print in dotenv format (safe to copy into .env.local).
    for k in sorted(out.keys()):
        print(f"{k}={out[k]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

