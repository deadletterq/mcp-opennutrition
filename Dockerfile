# Multi-stage build for MCP OpenNutrition

# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build the application (without data conversion)
RUN npm run build:skip-data || (npm run build && npm run convert-data)

# Stage 2: Runtime
FROM node:20-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache curl sqlite

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Copy scripts from builder stage
COPY --from=builder /app/scripts ./scripts

# Create data directory
RUN mkdir -p /data && chown -R mcpuser:nodejs /data

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER mcpuser

# Expose port (if needed for health checks)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/data/opennutrition_foods.db
ENV DATASET_URL=https://downloads.opennutrition.app/opennutrition-dataset-2025.1.zip

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Run the application
CMD ["node", "build/index.js"]