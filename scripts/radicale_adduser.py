"""Append a user/bcrypt-hash pair to radicale.htpasswd.

Reads username + password from stdin (or env vars RADICALE_USER /
RADICALE_PASSWORD) and appends an htpasswd line. Existing entries are
not deduplicated -- the last matching line wins when Radicale reads it.
"""

from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

import bcrypt

HTPASSWD = Path(__file__).resolve().parent.parent / "radicale.htpasswd"


def main() -> int:
    user = os.environ.get("RADICALE_USER") or input("Username: ").strip()
    if not user:
        print("error: empty username", file=sys.stderr)
        return 1

    pw = os.environ.get("RADICALE_PASSWORD") or getpass.getpass("Password: ")
    if not pw:
        print("error: empty password", file=sys.stderr)
        return 1

    hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    with HTPASSWD.open("a", encoding="utf-8") as f:
        f.write(f"{user}:{hashed}\n")
    print(f"appended user '{user}' to {HTPASSWD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
