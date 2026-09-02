#!/usr/bin/env python3
"""Print the SHA-256 hash to paste into roles-config.json.

    python3 tools/hash-password.py 'SomeStr0ng@Pass'

Passwords are never stored in plaintext. This is still only a demo gate — the comparison
happens in the browser, so treat it as identification, not protection.
"""
import hashlib
import re
import sys

POLICY = [
    (r".{10,}", "at least 10 characters"),
    (r"[A-Z]", "an uppercase letter"),
    (r"[a-z]", "a lowercase letter"),
    (r"[0-9]", "a number"),
    (r"[^A-Za-z0-9]", "a symbol"),
]

if len(sys.argv) != 2:
    sys.exit("usage: python3 tools/hash-password.py '<password>'")

password = sys.argv[1]
missing = [why for pattern, why in POLICY if not re.search(pattern, password)]
if missing:
    sys.exit("Password needs " + ", ".join(missing) + ".")

print(hashlib.sha256(password.encode()).hexdigest())
