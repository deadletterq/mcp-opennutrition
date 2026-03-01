# Dockerfile
FROM node:20-bullseye

WORKDIR /app

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Rebuild native modules for the container's architecture
RUN npm rebuild better-sqlite3

# Build project if needed
RUN npm run build

EXPOSE 3000

ENTRYPOINT ["node", "build/index.js"]
CMD ["--http"]
