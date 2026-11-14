# ---- Stage 1: Angular Optimized Production Builder ----
FROM node:20-alpine AS builder
WORKDIR /workspace

ARG BUILD_CONFIG=core-production

COPY package.json ./package.json
COPY apps/web/package*.json ./apps/web/
WORKDIR /workspace/apps/web
RUN npm ci --workspaces=false

COPY apps/web ./
RUN node ./node_modules/@angular/cli/bin/ng.js build --configuration=${BUILD_CONFIG}

# ---- Stage 2: Nginx Static + API Reverse Proxy ----
FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/web/dist/web/browser /usr/share/nginx/html

EXPOSE 80
