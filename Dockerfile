# syntax=docker/dockerfile:1

# Yarn 1 (lockfile v1). HUSKY=0 skips the prepare hook, which needs a git checkout.
FROM node:22-alpine AS deps

WORKDIR /app

ENV HUSKY=0

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

FROM node:22-alpine AS build

WORKDIR /app

ENV HUSKY=0

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn build

FROM node:22-alpine AS prod-deps

WORKDIR /app

ENV HUSKY=0

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --network-timeout 600000 \
    && yarn cache clean

FROM node:22-alpine AS runner

RUN apk add --no-cache tzdata

ENV NODE_ENV=production \
    PORT=8082 \
    BIND_HOST=0.0.0.0 \
    UPDATE_DIR=updates \
    TZ=Asia/Ho_Chi_Minh

WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/updates ./updates

USER node

EXPOSE 8082

# /health is 503 when HIS Postgres is unreachable. That marks the container
# unhealthy; restart policy does not recycle it for that.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8082/health >/dev/null || exit 1

CMD ["node", "dist/server.js"]
