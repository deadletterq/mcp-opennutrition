import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SQLiteDBAdapter } from "./SQLiteDBAdapter.js";
import { MCPServer } from "./MCPServer.js";
import { randomUUID } from "node:crypto";
import express from 'express';


async function main() {
  const db = new SQLiteDBAdapter();
  const transportType = process.env.TRANSPORT_TYPE || "stdio";
  
  if (transportType === "http") {
    // HTTP/SSE mode - using Express
    const app = express();
    app.use(express.json());
    
    const port = parseInt(process.env.PORT || "3000");
    const host = process.env.HOST || "0.0.0.0";
    
    // Add logging for debugging
    app.use((req, res, next) => {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.url} - Headers:`, req.headers);
      next();
    });
    
    // Add health check endpoint
    app.get('/health', (req, res) => {
      try {
        // Check if database is accessible
        db.getAll(1, 1); // Simple test query
        res.status(200).json({
          status: 'healthy',
          database: 'accessible',
          transport: 'http',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: 'database not accessible',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    app.post('/mcp', async (req, res) => {
      console.error(`[${new Date().toISOString()}] POST /mcp - Body:`, req.body);

      try {
        // Create a new transport for each request to prevent request ID collisions
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        });
        
        res.on('close', () => {
          console.error(`[${new Date().toISOString()}] Response closed, cleaning up transport`);
          transport.close();
        });
        
        // Create a new server instance for this transport
        const mcpServerInstance = new MCPServer(transport, db);
        await mcpServerInstance.connect();
        
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error'
                },
                id: null
            });
        }
      }
    });
    
    // Add GET endpoint for SSE streaming
    app.get('/mcp', async (req, res) => {
      console.error(`[${new Date().toISOString()}] GET /mcp - Starting SSE stream`);
      
      // Create a new transport for SSE
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: false
      });
      
      res.on('close', () => {
        console.error(`[${new Date().toISOString()}] SSE connection closed, cleaning up transport`);
        transport.close();
      });
      
      // Create a new server instance for this transport
      const mcpServerInstance = new MCPServer(transport, db);
      await mcpServerInstance.connect();
      
      // Handle SSE request - let the transport handle headers
      await transport.handleRequest(req, res, null);
    });
    
    app.listen(port, host, () => {
      console.log(`OpenNutrition MCP Server running on HTTP at http://${host}:${port}/mcp`);
    }).on('error', error => {
      console.error('Server error:', error);
      process.exit(1);
    });
  } else {
    // Stdio mode (default)
    const transport = new StdioServerTransport();
    const server = new MCPServer(transport, db);
    await server.connect();
    console.error("OpenNutrition MCP Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
