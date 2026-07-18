# Freehold API — build from the repo root:  docker build -f apps/api/Dockerfile .
# Also used by docker-compose's one-shot migrate service (it has prisma + the schema).
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @freehold/db build
RUN pnpm --filter @freehold/api build
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
