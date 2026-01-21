#!/bin/bash
# Generate RS256 key pair for JWT signing

set -e

KEYS_DIR="$(dirname "$0")"

echo "Generating RS256 key pair..."

# Generate private key (4096 bits for strong security)
openssl genrsa -out "$KEYS_DIR/jwt-private.pem" 4096

# Extract public key from private key
openssl rsa -in "$KEYS_DIR/jwt-private.pem" -pubout -out "$KEYS_DIR/jwt-public.pem"

# Set secure permissions
chmod 600 "$KEYS_DIR/jwt-private.pem"
chmod 644 "$KEYS_DIR/jwt-public.pem"

echo "Keys generated successfully:"
echo "   Private key: $KEYS_DIR/jwt-private.pem (600)"
echo "   Public key:  $KEYS_DIR/jwt-public.pem (644)"
echo ""
echo "IMPORTANT:"
echo "   - Keep jwt-private.pem SECRET (only auth-service needs it)"
echo "   - Share jwt-public.pem with API Gateway and other services"
echo "   - jwt-private.pem is already in .gitignore"
