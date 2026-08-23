FROM oven/bun:1.4-slim
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application source code
COPY . .

RUN bun run build

EXPOSE 3000

# Push schema changes and start Next.js
CMD ["sh", "-c", "bun db:deploy && bun start"]