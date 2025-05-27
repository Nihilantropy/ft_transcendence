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

# Load the headers-more module
RUN echo "load_module modules/ngx_http_headers_more_filter_module.so;" > /etc/nginx/modules/headers-more.conf

# Create directory structure
RUN mkdir -p /etc/nginx/conf.d \
             /etc/nginx/ssl \
             /var/log/nginx \
             /var/cache/nginx

# Copy modular nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# Copy SSL certificates
COPY ssl/ /etc/nginx/ssl/

# Set proper permissions
RUN chown -R nginx:nginx /var/log/nginx /var/cache/nginx \
    && chmod 644 /etc/nginx/ssl/selfsigned.crt \
    && chmod 600 /etc/nginx/ssl/selfsigned.key

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f https://localhost/health --insecure || exit 1

# Start nginx with modules
CMD ["sh", "-c", "cat /etc/nginx/modules/headers-more.conf /etc/nginx/nginx.conf > /tmp/nginx.conf && nginx -c /tmp/nginx.conf -g 'daemon off;'"]