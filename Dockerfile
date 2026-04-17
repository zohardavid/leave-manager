FROM node:20-slim

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@10.33.0

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/ ./lib/
COPY scripts/package.json ./scripts/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend then API server
RUN pnpm --filter @workspace/mockup-sandbox run build
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "artifacts/api-server/dist/index.mjs"]
