# ── Registry — single image serving the Bun API + the built React SPA ─────
# Build context = repo root. Two stages: build the web app, then assemble the
# API image with web/dist baked in; Hono serves the SPA from the same origin
# in production (see api/src/app.ts), so no nginx / static server is needed.
#
# The image runs the app only. Migrations are NEVER auto-run at container
# start — run `bun run db:migrate` against the target database in the deploy
# flow, then start the container with DATABASE_URL injected as an env var.

# ── Stage 1: build the React SPA ───────────────────────────────────────────
FROM oven/bun:1 AS web-build
WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN bun install
COPY web/ ./
RUN bun run build

# ── Stage 2: API image ─────────────────────────────────────────────────────
FROM oven/bun:1 AS base

# Optional proxy build-args (used by `bun install` behind restricted networks):
#   docker build --build-arg HTTP_PROXY=http://proxy:port --build-arg HTTPS_PROXY=http://proxy:port .
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

WORKDIR /app

# Timezone + tzdata
ENV TZ=Asia/Shanghai
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -r app && useradd -r -g app -u 10001 app

# Install production dependencies first (cached layer). --ignore-scripts:
# the api package's `prepare` runs husky for git hooks, which is meaningless
# (and fails) inside the image with dev deps omitted.
COPY api/package.json api/bun.lock ./
RUN bun install --omit=dev --ignore-scripts

# Bundle the rest of the source
COPY api/ ./
RUN bun run build

# Bake the built SPA into the image (served from /app/web-dist by Hono).
COPY --from=web-build /app/web/dist ./web-dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["bun", "run", "start"]