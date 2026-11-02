FROM node:24.22.2-bookworm-slim
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.16.1
COPY . .
RUN pnpm install --frozen-lockfile
ARG APP
RUN pnpm --filter @knowledge-assistant/${APP} build
ENV APP=${APP}
ENV NODE_ENV=production
CMD ["sh", "-c", "pnpm --filter @knowledge-assistant/${APP} start"]
