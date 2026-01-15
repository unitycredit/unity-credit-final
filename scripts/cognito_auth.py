"""
UnityCredit Cognito auth helper (Python/boto3).

This repo is primarily a Next.js (Node.js) app. The web app calls this script server-side
to interact with AWS Cognito User Pools using boto3 (per operator preference).

Protocol:
- Read a single JSON object from stdin.
- Write a single JSON object to stdout.

Input shape:
  {
    "op": "sign_up" | "confirm_sign_up" | "resend_confirmation_code" | "initiate_auth",
    "payload": { ... }
  }

Env required:
  AWS_COGNITO_REGION (or AWS_REGION)
  AWS_COGNITO_APP_CLIENT_ID
Optional (only needed for some admin operations; not currently used):
  AWS_COGNITO_USER_POOL_ID
"""

from __future__ import annotations

import base64
import json
import os
import sys
from typing import Any


def _b64url_decode(s: str) -> bytes:
    raw = (s or "").strip()
    if not raw:
        return b""
    pad = "=" * ((4 - (len(raw) % 4)) % 4)
    return base64.urlsafe_b64decode(raw + pad)


def _decode_jwt_payload(jwt_token: str) -> dict[str, Any]:
    parts = (jwt_token or "").split(".")
    if len(parts) < 2:
        return {}
    try:
        payload = _b64url_decode(parts[1]).decode("utf-8", errors="replace")
        data = json.loads(payload)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _err(code: str, message: str, *, status: int = 400) -> dict[str, Any]:
    return {"ok": False, "error_code": code, "error": message, "status": status}


def _ok(data: dict[str, Any] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"ok": True}
    if data:
        out.update(data)
    return out


def main() -> int:
    try:
        import boto3  # type: ignore
    except Exception:
        sys.stdout.write(json.dumps(_err("missing_boto3", "Missing boto3. Install: pip install boto3")))
        return 2

    try:
        raw = sys.stdin.read()
        req = json.loads(raw) if raw else {}
    except Exception:
        sys.stdout.write(json.dumps(_err("bad_json", "Invalid JSON input")))
        return 2

    op = str((req or {}).get("op") or "").strip()
    payload = (req or {}).get("payload") or {}
    if not isinstance(payload, dict):
        payload = {}

    region = (os.getenv("AWS_COGNITO_REGION") or os.getenv("AWS_REGION") or "").strip()
    client_id = (os.getenv("AWS_COGNITO_APP_CLIENT_ID") or "").strip()
    if not region:
        sys.stdout.write(json.dumps(_err("missing_region", "Missing AWS_COGNITO_REGION (or AWS_REGION)")))
        return 2
    if not client_id:
        sys.stdout.write(json.dumps(_err("missing_client_id", "Missing AWS_COGNITO_APP_CLIENT_ID")))
        return 2

    cognito = boto3.client("cognito-idp", region_name=region)

    try:
        if op == "sign_up":
            username = str(payload.get("username") or payload.get("email") or "").strip().lower()
            password = str(payload.get("password") or "")
            if not username or "@" not in username:
                sys.stdout.write(json.dumps(_err("invalid_email", "Invalid email")))
                return 0
            if len(password) < 1:
                sys.stdout.write(json.dumps(_err("invalid_password", "Missing password")))
                return 0

            attrs: list[dict[str, str]] = [{"Name": "email", "Value": username}]
            given_name = str(payload.get("first_name") or payload.get("given_name") or "").strip()
            family_name = str(payload.get("last_name") or payload.get("family_name") or "").strip()
            phone = str(payload.get("phone") or payload.get("phone_number") or "").strip()
            if given_name:
                attrs.append({"Name": "given_name", "Value": given_name})
            if family_name:
                attrs.append({"Name": "family_name", "Value": family_name})
            if phone:
                attrs.append({"Name": "phone_number", "Value": phone})

            resp = cognito.sign_up(ClientId=client_id, Username=username, Password=password, UserAttributes=attrs)
            sys.stdout.write(
                json.dumps(
                    _ok(
                        {
                            "user_sub": resp.get("UserSub"),
                            "user_confirmed": bool(resp.get("UserConfirmed")),
                            "code_delivery": resp.get("CodeDeliveryDetails") or None,
                        }
                    )
                )
            )
            return 0

        if op == "confirm_sign_up":
            username = str(payload.get("username") or payload.get("email") or "").strip().lower()
            code = str(payload.get("code") or payload.get("confirmation_code") or "").strip().replace(" ", "")
            if not username or "@" not in username:
                sys.stdout.write(json.dumps(_err("invalid_email", "Invalid email")))
                return 0
            if len(code) != 6 or not code.isdigit():
                sys.stdout.write(json.dumps(_err("invalid_code", "Invalid confirmation code")))
                return 0
            cognito.confirm_sign_up(ClientId=client_id, Username=username, ConfirmationCode=code)
            sys.stdout.write(json.dumps(_ok({"confirmed": True})))
            return 0

        if op == "resend_confirmation_code":
            username = str(payload.get("username") or payload.get("email") or "").strip().lower()
            if not username or "@" not in username:
                sys.stdout.write(json.dumps(_err("invalid_email", "Invalid email")))
                return 0
            resp = cognito.resend_confirmation_code(ClientId=client_id, Username=username)
            sys.stdout.write(json.dumps(_ok({"code_delivery": resp.get("CodeDeliveryDetails") or None})))
            return 0

        if op == "initiate_auth":
            username = str(payload.get("username") or payload.get("email") or "").strip().lower()
            password = str(payload.get("password") or "")
            if not username:
                sys.stdout.write(json.dumps(_err("invalid_username", "Missing username")))
                return 0
            if len(password) < 1:
                sys.stdout.write(json.dumps(_err("invalid_password", "Missing password")))
                return 0

            resp = cognito.initiate_auth(
                ClientId=client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": username, "PASSWORD": password},
            )

            result = resp.get("AuthenticationResult") or {}
            id_token = str(result.get("IdToken") or "")
            claims = _decode_jwt_payload(id_token) if id_token else {}

            sys.stdout.write(
                json.dumps(
                    _ok(
                        {
                            "auth": {
                                "access_token": result.get("AccessToken"),
                                "id_token": result.get("IdToken"),
                                "refresh_token": result.get("RefreshToken"),
                                "expires_in": result.get("ExpiresIn"),
                                "token_type": result.get("TokenType"),
                            },
                            "claims": {
                                "sub": claims.get("sub"),
                                "email": claims.get("email") or username,
                                "email_verified": claims.get("email_verified"),
                                "given_name": claims.get("given_name"),
                                "family_name": claims.get("family_name"),
                                "phone_number": claims.get("phone_number"),
                            },
                        }
                    )
                )
            )
            return 0

        if op == "forgot_password":
            username = str(payload.get("username") or payload.get("email") or "").strip().lower()
            if not username or "@" not in username:
                sys.stdout.write(json.dumps(_err("invalid_email", "Invalid email")))
                return 0
            resp = cognito.forgot_password(ClientId=client_id, Username=username)
            sys.stdout.write(json.dumps(_ok({"code_delivery": resp.get("CodeDeliveryDetails") or None})))
            return 0

        if op == "confirm_forgot_password":
            username = str(payload.get("username") or payload.get("email") or "").strip().lower()
            code = str(payload.get("code") or payload.get("confirmation_code") or "").strip().replace(" ", "")
            new_password = str(payload.get("new_password") or payload.get("password") or "")
            if not username or "@" not in username:
                sys.stdout.write(json.dumps(_err("invalid_email", "Invalid email")))
                return 0
            if len(code) != 6 or not code.isdigit():
                sys.stdout.write(json.dumps(_err("invalid_code", "Invalid confirmation code")))
                return 0
            if len(new_password) < 1:
                sys.stdout.write(json.dumps(_err("invalid_password", "Missing new password")))
                return 0
            cognito.confirm_forgot_password(
                ClientId=client_id, Username=username, ConfirmationCode=code, Password=new_password
            )
            sys.stdout.write(json.dumps(_ok({"reset": True})))
            return 0

        sys.stdout.write(json.dumps(_err("unknown_op", f"Unknown op: {op}")))
        return 0

    except Exception as e:
        # Translate common Cognito errors into stable codes for the Node layer.
        name = e.__class__.__name__
        msg = str(getattr(e, "response", {}).get("Error", {}).get("Message") or str(e) or "")

        if name in ("NoCredentialsError", "PartialCredentialsError"):
            sys.stdout.write(
                json.dumps(
                    _err(
                        "MissingAWSCredentials",
                        "Missing AWS credentials for boto3. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (and AWS_SESSION_TOKEN if applicable) "
                        "or configure `aws configure` for this machine/user.",
                        status=500,
                    )
                )
            )
            return 0

        if name == "UserNotConfirmedException":
            sys.stdout.write(json.dumps(_err("UserNotConfirmedException", msg, status=403)))
            return 0
        if name == "NotAuthorizedException":
            sys.stdout.write(json.dumps(_err("NotAuthorizedException", msg, status=401)))
            return 0
        if name == "UsernameExistsException":
            sys.stdout.write(json.dumps(_err("UsernameExistsException", msg, status=409)))
            return 0
        if name == "CodeMismatchException":
            sys.stdout.write(json.dumps(_err("CodeMismatchException", msg, status=400)))
            return 0
        if name == "ExpiredCodeException":
            sys.stdout.write(json.dumps(_err("ExpiredCodeException", msg, status=400)))
            return 0
        if name == "InvalidPasswordException":
            sys.stdout.write(json.dumps(_err("InvalidPasswordException", msg, status=400)))
            return 0
        if name == "InvalidParameterException":
            sys.stdout.write(json.dumps(_err("InvalidParameterException", msg, status=400)))
            return 0

        sys.stdout.write(json.dumps(_err(name or "cognito_error", msg or "Cognito error", status=500)))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

