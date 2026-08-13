# ===================================
# Stage 1: Build the SPA with Node
# ===================================
FROM node:26-alpine AS builder
RUN apk add --no-cache --upgrade zlib libcrypto3 libssl3 nghttp2-libs

# Build-time configuration (same conditional-bake pattern as the customer
# SPA's Dockerfile): leave an ARG UNSET and the in-code default applies
# (local-stack dev values — see src/lib/auth.ts and src/lib/api.ts).
#   API_BASE_URL        unset -> http://localhost:8080 (local edge)
#   KEYCLOAK_URL        unset -> http://localhost:8081
#   KEYCLOAK_REALM      unset -> the realm src/lib/auth.ts defaults to
#   KEYCLOAK_CLIENT_ID  unset -> admin-portal
ARG API_BASE_URL
ARG KEYCLOAK_URL
ARG KEYCLOAK_REALM
ARG KEYCLOAK_CLIENT_ID

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Bake each VITE_* var only when its build-arg was provided: a blanket ENV
# would turn "no arg" into an explicit empty string and shadow the in-code
# defaults (the exact trap the customer SPA hit at login).
RUN if [ -n "${API_BASE_URL+x}" ]; then export VITE_API_BASE_URL="$API_BASE_URL"; fi \
    && if [ -n "${KEYCLOAK_URL+x}" ]; then export VITE_KEYCLOAK_URL="$KEYCLOAK_URL"; fi \
    && if [ -n "${KEYCLOAK_REALM+x}" ]; then export VITE_KEYCLOAK_REALM="$KEYCLOAK_REALM"; fi \
    && if [ -n "${KEYCLOAK_CLIENT_ID+x}" ]; then export VITE_KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID"; fi \
    && npm run build

RUN ls -la /app/dist

# ===================================
# Stage 2: Serve with nginx
# ===================================
FROM nginx:alpine
# Upgrade all OS packages to clear known Alpine CVEs in the runtime image
# (this is the image Trivy scans).
RUN apk -U --no-cache upgrade

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
