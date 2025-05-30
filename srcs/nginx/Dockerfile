# ---------------------------------------------------------------------------- #
#                                  RUNNER                                      #
# ---------------------------------------------------------------------------- #

FROM nginx:1.25-alpine

# Install required packages
RUN apk update && apk add --no-cache \
    openssl \
    curl \
    nginx-mod-http-headers-more \
    && rm -rf /var/cache/apk/*

# Create directory structure
RUN mkdir -p /etc/nginx/conf.d \
             /etc/nginx/ssl \
             /usr/share/nginx/html/error-pages \
             /var/log/nginx \
             /var/cache/nginx

# Enable headers-more module (proper way)
RUN echo "load_module modules/ngx_http_headers_more_filter_module.so;" > /etc/nginx/conf.d/00-modules.conf

# Copy nginx configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/
COPY error-pages/ /usr/share/nginx/html/error-pages/

# Copy SSL certificates
COPY ssl/ /etc/nginx/ssl/

# Set proper permissions
RUN chown -R nginx:nginx /var/log/nginx /var/cache/nginx /usr/share/nginx/html \
    && chmod 644 /etc/nginx/ssl/selfsigned.crt \
    && chmod 600 /etc/nginx/ssl/selfsigned.key

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f https://localhost/health --insecure || exit 1

# Start nginx (simplified - no shell scripts)
CMD ["nginx", "-g", "daemon off;"]