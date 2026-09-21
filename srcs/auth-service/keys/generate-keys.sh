#!/bin/bash
# Generate the RS256 key pair for JWT signing: jwt-private.pem (auth-service signs with it) and
# jwt-public.pem (the API Gateway verifies with it).
#
# Neither key is tracked by git; `make up` runs this for you. It is safe to run repeatedly:
#
#   (no flag)  private key missing  -> generate a new pair
#              private key present  -> only make sure the public key matches it (rewrites the
#                                      public key if not); existing tokens stay valid
#   --force    replace both with a brand-new pair. Invalidates every token already issued, so use
#              it to rotate the keys, never as a routine step.

set -euo pipefail

KEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRIVATE="$KEYS_DIR/jwt-private.pem"
PUBLIC="$KEYS_DIR/jwt-public.pem"

command -v openssl >/dev/null || { echo "openssl is required to generate the JWT keys" >&2; exit 1; }

# The api-gateway bind-mounts the public key as a file. If a container was ever started while it was
# missing, Docker (as root) may have created a directory there, which we cannot write over.
if [ -d "$PUBLIC" ] || [ -d "$PRIVATE" ]; then
  echo "A directory is sitting where a key file should be (Docker creates one for a missing bind-mount source):" >&2
  ls -ld "$PUBLIC" "$PRIVATE" 2>/dev/null | grep '^d' >&2
  echo "Remove it (it is root-owned, so: sudo rm -rf <path>) and run this again." >&2
  exit 1
fi

write_public_key() {
  openssl rsa -in "$PRIVATE" -pubout -out "$PUBLIC" 2>/dev/null
  chmod 644 "$PUBLIC"
}

if [ "${1:-}" = "--force" ] || [ ! -f "$PRIVATE" ]; then
  echo "Generating RS256 key pair (4096-bit)..."
  # Generate beside the target and move into place, so an interrupted run never leaves a truncated key
  TMP="$(mktemp "$KEYS_DIR/.jwt-private.XXXXXX")"
  trap 'rm -f "$TMP"' EXIT
  openssl genrsa -out "$TMP" 4096 2>/dev/null || { echo "openssl failed to generate the private key" >&2; exit 1; }
  chmod 600 "$TMP"
  mv -f "$TMP" "$PRIVATE"
  write_public_key
  echo "Keys generated:"
  echo "   Private key: $PRIVATE (600, auth-service only)"
  echo "   Public key:  $PUBLIC (644, mounted read-only into the API Gateway)"
  exit 0
fi

# Private key exists: it is the source of truth, and the public key is derived from it.
if ! EXPECTED="$(openssl rsa -in "$PRIVATE" -pubout 2>/dev/null)"; then
  echo "$PRIVATE is not a valid RSA private key. Replace it with: $0 --force" >&2
  exit 1
fi

if [ -f "$PUBLIC" ] && [ "$EXPECTED" = "$(cat "$PUBLIC")" ]; then
  echo "JWT keys present and consistent."
else
  write_public_key
  echo "jwt-public.pem was missing or did not match jwt-private.pem: rewrote it from the private key."
fi
