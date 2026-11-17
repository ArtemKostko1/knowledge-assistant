
# syntax=docker/dockerfile:1.7

# ============================================================
# BASE
# ============================================================

FROM node:24.22.2-bookworm-slim AS base

WORKDIR /workspace

# ============================================================
# DEPENDENCIES
# ============================================================

FROM base AS deps

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global pnpm@12.16.1

COPY . .

RUN --mount=type=cache,id=ka-pnpm,target=/pnpm/store \
    pnpm install \
      --frozen-lockfile \
      --store-dir=/pnpm/store

# ============================================================
# CLIENT BUILD
# ============================================================

FROM deps AS build-client

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN pnpm exec turbo run build \
    --filter=@knowledge-assistant/web

# Requires output: "standalone" and monorepo tracing root.
RUN test -f apps/web/.next/standalone/apps/web/server.js

RUN mkdir -p apps/web/public

# ============================================================
# API BUILD + PRODUCTION PACKAGE
# ============================================================

FROM deps AS build-api

RUN pnpm exec turbo run build \
    --filter=@knowledge-assistant/api

RUN pnpm --filter=@knowledge-assistant/api \
    --prod deploy /out/api

# Verify the expected compiled entrypoint.
RUN test -f /out/api/dist/main.js

# ============================================================
# WORKER BUILD + PRODUCTION PACKAGE
# ============================================================

FROM deps AS build-worker

RUN pnpm exec turbo run build \
    --filter=@knowledge-assistant/worker

RUN pnpm --filter=@knowledge-assistant/worker \
    --prod deploy /out/worker

RUN test -f /out/worker/dist/main.js

# ============================================================
# CLIENT RUNTIME
# ============================================================

FROM base AS client-runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build-client --chown=node:node \
    /workspace/apps/web/.next/standalone/ ./

COPY --from=build-client --chown=node:node \
    /workspace/apps/web/.next/static \
    ./apps/web/.next/static

COPY --from=build-client --chown=node:node \
    /workspace/apps/web/public \
    ./apps/web/public

RUN mkdir -p /app/apps/web/.next/cache \
    && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

# ============================================================
# SHARED NODE RUNTIME FOR API + WORKER
# ============================================================

FROM base AS server-runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# ============================================================
# API RUNTIME
# ============================================================

FROM server-runtime AS api-runtime

COPY --from=build-api --chown=node:node \
    /out/api/ ./

USER node

EXPOSE 3001

CMD ["node", "dist/main.js"]

# ============================================================
# WORKER RUNTIME
# ============================================================

FROM server-runtime AS worker-runtime

COPY --from=build-worker --chown=node:node \
    /out/worker/ ./

USER node

CMD ["node", "dist/main.js"]
