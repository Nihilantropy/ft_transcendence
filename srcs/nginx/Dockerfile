# ---------------------------------------------------------------------------- #
#                                  FRONTEND                                    #
# ---------------------------------------------------------------------------- #
# `frontend` is a named build context (docker-compose.yml: additional_contexts).
# Files are copied explicitly: a host node_modules must never reach the image.
FROM node:22-slim AS web
WORKDIR /web
COPY --from=frontend package.json package-lock.json ./
RUN npm ci
COPY --from=frontend index.html tsconfig.json vite.config.ts ./
COPY --from=frontend public ./public
COPY --from=frontend src ./src
# Unit tests gate the build: `make gate` builds this image, so it runs them.
RUN npm test && npm run build

# ---------------------------------------------------------------------------- #
#                                  RUNNER                                      #
# ---------------------------------------------------------------------------- #

FROM nginx:1.25-alpine

# Install required packages
RUN apk update && apk add --no-cache \
    curl \
    openssl \
    gettext \
    && rm -rf /var/cache/apk/*

# Create directory structure
RUN mkdir -p /etc/nginx/conf.d \
             /etc/nginx/ssl \
             /usr/share/nginx/html/error_pages \
             /var/log/nginx \
             /var/cache/nginx

# Copy nginx configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/default.conf.template /etc/nginx/conf.d/default.conf.template
COPY error_pages/ /usr/share/nginx/html/error_pages/
COPY --from=web /web/dist/ /usr/share/nginx/html/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set proper permissions
RUN chown -R nginx:nginx /var/log/nginx /var/cache/nginx /usr/share/nginx/html

# Use entrypoint script to configure nginx and start it
ENTRYPOINT ["/docker-entrypoint.sh"]