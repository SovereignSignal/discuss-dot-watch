# syntax=docker/dockerfile:1
# Official Docker Hub image via AWS's public mirror (same digest). Railway's shared
# builders pull Docker Hub anonymously and hit its rate limit: two deploys of #102
# failed on 429 Too Many Requests (2026-10-09).
FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS deps
WORKDIR /app
RUN npm install --global npm@11
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci

FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Only traced runtime files enter the final image. Developer dependencies never
# appear in its layers. All real credentials are provided at process startup.
FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Preserve Railway's existing npm-start override without requiring next CLI.
RUN node -e "const fs=require('fs');const p=require('./package.json');p.scripts={start:'node server.js'};fs.writeFileSync('package.json',JSON.stringify(p));" && chown nextjs:nodejs package.json
USER nextjs
EXPOSE 8080
CMD ["node","server.js"]
