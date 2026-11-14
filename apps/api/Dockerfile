# ---- Stage 1: Monorepo Packages & NestJS API Builder ----
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /workspace

# Install API dependencies using lockfile
COPY apps/api/package*.json ./apps/api/
RUN npm ci --prefix apps/api \
 && ln -s /workspace/apps/api/node_modules /workspace/node_modules

# Copy & build internal @lemon/* packages in dependency order
COPY packages ./packages
RUN /workspace/apps/api/node_modules/.bin/tsc -p packages/core-combinator/tsconfig.json \
 && /workspace/apps/api/node_modules/.bin/tsc -p packages/core-combinator-sdk/tsconfig.json \
 && /workspace/apps/api/node_modules/.bin/tsc -p packages/lemon-app-registrar/tsconfig.json \
 && /workspace/apps/api/node_modules/.bin/tsc -p packages/lemon-projectarium/tsconfig.json \
 && /workspace/apps/api/node_modules/.bin/tsc -p packages/lemon-seasons-neurons/tsconfig.json

# Populate @lemon/* inside apps/api/node_modules for runtime resolution
RUN mkdir -p /workspace/apps/api/node_modules/@lemon/core-combinator \
             /workspace/apps/api/node_modules/@lemon/core-combinator-sdk \
             /workspace/apps/api/node_modules/@lemon/app-registrar \
             /workspace/apps/api/node_modules/@lemon/projectarium \
             /workspace/apps/api/node_modules/@lemon/seasons-neurons \
 && cp -r packages/core-combinator/package.json packages/core-combinator/dist /workspace/apps/api/node_modules/@lemon/core-combinator/ \
 && cp -r packages/core-combinator-sdk/package.json packages/core-combinator-sdk/dist /workspace/apps/api/node_modules/@lemon/core-combinator-sdk/ \
 && cp -r packages/lemon-app-registrar/package.json packages/lemon-app-registrar/dist /workspace/apps/api/node_modules/@lemon/app-registrar/ \
 && cp -r packages/lemon-projectarium/package.json packages/lemon-projectarium/dist /workspace/apps/api/node_modules/@lemon/projectarium/ \
 && cp -r packages/lemon-seasons-neurons/package.json packages/lemon-seasons-neurons/dist /workspace/apps/api/node_modules/@lemon/seasons-neurons/

# Generate Prisma Client, compile NestJS API & compile standalone seed script
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/tsconfig*.json apps/api/nest-cli.json ./apps/api/
COPY apps/api/src ./apps/api/src

WORKDIR /workspace/apps/api
RUN npx prisma generate \
 && npm run build \
 && npx tsc prisma/seed.ts --outDir dist-seed --module commonjs --target ES2021 --esModuleInterop --skipLibCheck --resolveJsonModule

# ---- Stage 2: Production Runner ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

COPY apps/api/package*.json ./
RUN npm ci --omit=dev \
 && npm install --no-save prisma@5.22.0 \
 && npm cache clean --force

COPY --from=builder /workspace/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /workspace/apps/api/node_modules/@lemon ./node_modules/@lemon
COPY --from=builder /workspace/apps/api/dist ./dist
COPY --from=builder /workspace/apps/api/dist-seed ./dist-seed
COPY --from=builder /workspace/apps/api/prisma ./prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
