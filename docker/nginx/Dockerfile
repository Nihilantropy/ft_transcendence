# ---------------------------------------------------------------------------- #
#                                  RUNNER                                      #
# ---------------------------------------------------------------------------- #

FROM nginx:1.25-alpine

# Install required packages
RUN apk update && apk add --no-cache \
    openssl \
    curl \
    && rm -rf /var/cache/apk/*

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed certificate for development
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/C=IT/ST=Rome/L=Rome/O=42/OU=ft_transcendence/CN=localhost"

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create necessary directories
RUN mkdir -p /var/log/nginx /var/cache/nginx

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f https://localhost/health --insecure || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]