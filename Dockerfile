# Use Node LTS version (v20.x matches your local)
FROM node:lts-slim

# Set working directory
WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the project
COPY . .

# Build the project
RUN npm run build

# Expose port if your MCP server listens on a port
EXPOSE 3000

# Run the built project
CMD ["node", "build/index.js"]
