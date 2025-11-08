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

# Generate self-signed SSL certificate with the correct domain
echo "Generating SSL certificate for ${HOST_DOMAIN}..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=42/CN=${HOST_DOMAIN}"

# Set proper permissions
chmod 644 /etc/nginx/ssl/selfsigned.crt
chmod 600 /etc/nginx/ssl/selfsigned.key

echo "SSL certificate generated for ${HOST_DOMAIN}"

# Test nginx configuration
nginx -t

# Start nginx
echo "Starting nginx..."
exec nginx -g 'daemon off;'
