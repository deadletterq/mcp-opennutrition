# Docker Guide for MCP OpenNutrition

This guide explains how to use Docker with the MCP OpenNutrition application for both development and production environments.

## Overview

The MCP OpenNutrition application has been fully containerized with Docker support. The containerization includes:

- Multi-stage Docker builds for optimized image size
- Automatic dataset download and processing at container startup
- Persistent database storage using Docker volumes
- Health checks for monitoring container status
- Separate configurations for development and production

## Prerequisites

- Docker 20.10 or later
- Docker Compose 2.0 or later

## Quick Start

### Development Environment

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mcp-opennutrition
   ```

2. Start the development environment:
   ```bash
   npm run docker:dev
   ```

3. View logs:
   ```bash
   npm run docker:logs
   ```

4. Stop the development environment:
   ```bash
   npm run docker:dev:down
   ```

### Production Environment

1. Start the production environment:
   ```bash
   npm run docker:prod
   ```

2. View logs:
   ```bash
   npm run docker:prod:logs
   ```

3. Stop the production environment:
   ```bash
   npm run docker:prod:down
   ```

## Docker Commands

### Building Images

- Build the Docker image:
  ```bash
  npm run docker:build
  ```

- Build and run a container:
  ```bash
  npm run docker:run
  ```

### Development Commands

- Start development environment with rebuild:
  ```bash
  npm run docker:dev
  ```

- Stop development environment:
  ```bash
  npm run docker:dev:down
  ```

- Follow development logs:
  ```bash
  npm run docker:logs
  ```

### Production Commands

- Start production environment (detached):
  ```bash
  npm run docker:prod
  ```

- Stop production environment:
  ```bash
  npm run docker:prod:down
  ```

- Follow production logs:
  ```bash
  npm run docker:prod:logs
  ```

### Maintenance Commands

- Clean up unused Docker resources:
  ```bash
  npm run docker:clean
  ```

## Configuration

### Environment Variables

The application can be configured using environment variables. See `.env.example` for available options:

- `NODE_ENV`: Set to `development` or `production`
- `DB_PATH`: Path to the SQLite database file (default: `/data/opennutrition_foods.db`)
- `DATASET_URL`: URL to download the OpenNutrition dataset
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`)

### Custom Configuration

To use custom configuration:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your desired values

3. Use the environment file with Docker Compose:
   ```bash
   docker-compose --env-file .env up
   ```

## Data Persistence

The SQLite database is stored in a Docker volume named `opennutrition-data`. This ensures:

- Data persists across container restarts
- Database is not lost when updating the container
- Easy backup and restore capabilities

### Backup Database

To backup the database:

```bash
docker run --rm -v opennutrition-data:/data -v $(pwd):/backup alpine \
  cp /data/opennutrition_foods.db /backup/opennutrition_foods.db
```

### Restore Database

To restore the database:

```bash
docker run --rm -v opennutrition-data:/data -v $(pwd):/backup alpine \
  cp /backup/opennutrition_foods.db /data/opennutrition_foods.db
```

## Health Checks

The container includes a health check that verifies:

- The HTTP server is responding on port 3000
- The SQLite database is accessible
- The foods table exists and contains data

Health check status can be viewed with:

```bash
docker ps
```

Or for detailed health information:

```bash
docker inspect mcp-opennutrition-dev | jq '.[0].State.Health'
```

## Troubleshooting

### Container Won't Start

1. Check the logs:
   ```bash
   docker-compose logs mcp-opennutrition
   ```

2. Verify the dataset URL is accessible:
   ```bash
   curl -I https://www.opennutrition.app/static/datasets/opennutrition-dataset-2025.1.zip
   ```

3. Check if there's enough disk space:
   ```bash
   df -h
   ```

### Database Issues

1. Check if the database file exists:
   ```bash
   docker run --rm -v opennutrition-data:/data alpine ls -la /data/
   ```

2. Verify database integrity:
   ```bash
   docker run --rm -v opennutrition-data:/data alpine \
     sqlite3 /data/opennutrition_foods.db "SELECT COUNT(*) FROM foods;"
   ```

### Performance Issues

1. Monitor resource usage:
   ```bash
   docker stats mcp-opennutrition-dev
   ```

2. Check database size:
   ```bash
   docker run --rm -v opennutrition-data:/data alpine du -h /data/opennutrition_foods.db
   ```

## Development Workflow

### Making Changes

1. Make changes to your source code
2. The development container will automatically rebuild
3. Check logs to verify the changes

### Debugging

1. Attach to the running container:
   ```bash
   docker exec -it mcp-opennutrition-dev sh
   ```

2. View application logs:
   ```bash
   docker logs -f mcp-opennutrition-dev
   ```

## Production Deployment

### Security Considerations

- The container runs as a non-root user (`mcpuser`)
- Only necessary ports are exposed
- Health checks are configured for monitoring

### Scaling

To scale the application (if needed):

```bash
docker-compose -f docker-compose.prod.yml up --scale mcp-opennutrition=3 -d
```

Note: Each instance will have its own database volume. For true scaling, consider using an external database.

## Integration with Claude/Cline

To use the Docker container with Claude/Cline:

1. Ensure the container is running:
   ```bash
   npm run docker:prod
   ```

2. Add the following to your Claude/Cline MCP configuration:
   ```json
   "mcp-opennutrition": {
       "command": "docker",
       "args": [
           "exec",
           "mcp-opennutrition-prod",
           "node",
           "build/index.js"
       ]
   }
   ```

## Advanced Usage

### Custom Dockerfile

If you need to customize the Dockerfile, create a new file and reference it in docker-compose.yml:

```yaml
services:
  mcp-opennutrition:
    build:
      context: .
      dockerfile: Dockerfile.custom
```

### External Database

To use an external SQLite database:

1. Mount the database file:
   ```yaml
   volumes:
     - /path/to/your/database.db:/data/opennutrition_foods.db
   ```

2. Set the DB_PATH environment variable:
   ```yaml
   environment:
     - DB_PATH=/data/opennutrition_foods.db
   ```

### Network Configuration

To connect to other services:

```yaml
networks:
  default:
    external:
      name: my-network
```

## Support

For issues related to:

- Docker: Check Docker documentation
- The application: Create an issue in the repository
- Dataset: Refer to OpenNutrition documentation