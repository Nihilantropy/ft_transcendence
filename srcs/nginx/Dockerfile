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