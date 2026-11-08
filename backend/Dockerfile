FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
FROM node:22-bookworm-slim
# Chromium renders the «así debería verse» captures of web pages in guides; DejaVu Mono draws terminal captures.
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node src/database/schema.sql ./src/database/schema.sql
COPY --chown=node:node assets ./assets
USER node
EXPOSE 4000
# Creates or updates the tables (idempotent) before starting, so a fresh database works on first deploy.
CMD ["sh","-c","node dist/database/migrate.js && exec node dist/main.js"]
