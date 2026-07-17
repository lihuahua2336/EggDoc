FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG EGGDOC_SITE_URL=https://eggdoc.pages.dev
ARG PUBLIC_EGGAI_BASE_URL=https://api.eggai.icu/v1
ARG PUBLIC_INSTALLER_ORIGIN=https://eggdoc.pages.dev

ENV EGGDOC_DEPLOY_TARGET=node
ENV EGGDOC_SITE_URL=$EGGDOC_SITE_URL
ENV PUBLIC_EGGAI_BASE_URL=$PUBLIC_EGGAI_BASE_URL
ENV PUBLIC_INSTALLER_ORIGIN=$PUBLIC_INSTALLER_ORIGIN

RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4321/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "dist/server/entry.mjs"]
