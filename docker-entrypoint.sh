#!/bin/sh

# Exit on error
set -e

# Default values
DATASET_URL="${DATASET_URL:-https://www.opennutrition.app/static/datasets/opennutrition-dataset-2025.1.zip}"
DB_PATH="${DB_PATH:-/data/opennutrition_foods.db}"
DATA_DIR="/data"
TEMP_DIR="/tmp/opennutrition_data"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Function to download dataset
download_dataset() {
    echo "Downloading OpenNutrition dataset from $DATASET_URL..."
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Download the dataset
    wget -O dataset.zip "$DATASET_URL" || {
        echo "Failed to download dataset from $DATASET_URL"
        exit 1
    }
    
    echo "Dataset downloaded successfully"
}

# Function to extract and process dataset
process_dataset() {
    echo "Processing dataset..."
    cd "$TEMP_DIR"
    
    # Extract the dataset
    unzip -q dataset.zip || {
        echo "Failed to extract dataset"
        exit 1
    }
    
    # Move to the original app directory to run the scripts
    cd /app
    
    # Create temporary directory for the app
    mkdir -p /tmp/app_data
    mv "$TEMP_DIR"/*.zip /tmp/app_data/
    
    # Run the decompression script
    echo "Decompressing dataset..."
    npx tsx scripts/decompress-dataset.ts
    
    # Run the TSV to SQLite conversion
    echo "Converting TSV to SQLite..."
    npx tsx scripts/tsv-to-sqlite.ts
    
    # Move the database to the data directory
    if [ -f "data_local/opennutrition_foods.db" ]; then
        mv "data_local/opennutrition_foods.db" "$DB_PATH"
        echo "Database created at $DB_PATH"
    else
        echo "Failed to create database"
        exit 1
    fi
    
    # Clean up temporary files
    rm -rf /tmp/app_data data_local_temp
}

# Function to check if database exists and is valid
check_database() {
    if [ -f "$DB_PATH" ]; then
        # Check if database is readable and has the foods table
        sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='foods';" | grep -q "foods"
        if [ $? -eq 0 ]; then
            echo "Database exists and is valid"
            return 0
        fi
    fi
    return 1
}

# Function to start a simple HTTP server for health checks (only for stdio mode)
start_health_server() {
    # Only start health server if not using HTTP transport
    if [ "$TRANSPORT_TYPE" = "http" ]; then
        echo "HTTP transport enabled, MCP server will handle health checks"
        return 0
    fi
    
    # Create a simple health check endpoint
    cat > /tmp/health-server.js << 'EOF'
const http = require('http');
const { execSync } = require('child_process');

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        try {
            // Check if database is accessible
            const dbPath = process.env.DB_PATH || '/data/opennutrition_foods.db';
            execSync(`sqlite3 ${dbPath} "SELECT COUNT(*) FROM foods LIMIT 1;"`, { stdio: 'ignore' });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', database: 'accessible', transport: 'stdio' }));
        } catch (error) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'unhealthy', error: 'database not accessible' }));
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3000, () => {
    console.log('Health check server listening on port 3000');
});
EOF
    
    # Start the health server in the background
    node /tmp/health-server.js &
    HEALTH_SERVER_PID=$!
    echo "Started health check server with PID $HEALTH_SERVER_PID"
}

# Main execution
echo "Starting MCP OpenNutrition container..."

# Check if database exists and is valid
if ! check_database; then
    echo "Database not found or invalid. Downloading and processing dataset..."
    download_dataset
    process_dataset
else
    echo "Using existing database at $DB_PATH"
fi

# Start health check server
start_health_server

# Set the database path environment variable for the application
export DB_PATH

# Execute the main application
echo "Starting MCP OpenNutrition server..."
exec "$@"