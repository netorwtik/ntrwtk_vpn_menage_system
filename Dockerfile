FROM node:24-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM dependencies AS migrate

COPY prisma ./prisma
CMD ["npm", "run", "db:deploy"]

FROM base AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system nodejs && useradd --system --gid nodejs appuser

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER appuser

CMD ["node", "dist/app.js"]
