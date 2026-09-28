#!/bin/sh
# /**
#  * @brief Nginx entrypoint script for ft_transcendence
#  *
#  * @description Substitutes environment variables in nginx config and generates SSL certificates
#  * @return Starts nginx with daemon off
#  */

set -e

# Load environment variables
HOST_DOMAIN=${HOST_DOMAIN:-"localhost"}
echo "Configuring nginx for domain: ${HOST_DOMAIN}"

# Substitute environment variables in nginx config
envsubst '${HOST_DOMAIN}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Generate self-signed SSL certificate with the correct domain.
#
# The subjectAltName is required, not decorative: since Chrome 58 the CN is
# ignored for hostname validation and only the SAN is checked, so a CN-only
# certificate fails with NET::ERR_CERT_COMMON_NAME_INVALID on top of the usual
# self-signed warning. The subject requires compatibility with the latest
# stable Chrome. Python's ssl module applies the same rule, so without a SAN the
# certificate could not be verified by a test client either.
# DNS:nginx is for the `tester` container (make gate), which reaches nginx by its
# compose service name and verifies this certificate from the nginx-ssl volume.
echo "Generating SSL certificate for ${HOST_DOMAIN}..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/C=IT/ST=State/L=City/O=42/CN=${HOST_DOMAIN}" \
    -addext "subjectAltName=DNS:${HOST_DOMAIN},DNS:localhost,DNS:nginx,IP:127.0.0.1"

# Set proper permissions
chmod 644 /etc/nginx/ssl/selfsigned.crt
chmod 600 /etc/nginx/ssl/selfsigned.key

echo "SSL certificate generated for ${HOST_DOMAIN}"

# Test nginx configuration
nginx -t

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'
