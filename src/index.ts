import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {InMemoryDBAdapter} from "./InMemoryDBAdapter.js";

class MCPServer {
  private readonly server = new McpServer({
    name: "mcp-opennutrition",
    version: "1.0.0",
  });

  constructor(
      private readonly transport: StdioServerTransport,
      private readonly db: InMemoryDBAdapter,
  ) {
    // this.server.resource(
    //     "list-foods",
    //     new ResourceTemplate("foods://list", {list: undefined}),
    //     async () => {
    //       const page = 1;
    //       const pageSize = 25;
    //       const start = (page - 1) * pageSize;
    //       const end = start + pageSize;
    //       const foods = FOODS.slice(start, end);
    //       return {
    //         contents: [
    //           {
    //             uri: `foods://list?page=${page}&pageSize=${pageSize}`,
    //             text: JSON.stringify(foods),
    //             mimeType: "application/json"
    //           }
    //         ],
    //         _meta: {
    //           page,
    //           pageSize,
    //           total: FOODS.length,
    //           attribution: ATTRIBUTION
    //         }
    //       };
    //     }
    // );
  }

  async connect(): Promise<void> {
    return this.server.connect(this.transport)
  }
}

async function main() {
  const db = new InMemoryDBAdapter()
  await db.load()
  const transport = new StdioServerTransport();
  const server = new MCPServer(transport, db)
  await server.connect();
  console.error("OpenNutrition MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
