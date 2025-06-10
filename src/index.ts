import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {InMemoryDBAdapter} from "./InMemoryDBAdapter.js";
import {z} from "zod";

const GetFoodsRequestSchema = z.object({
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().optional().default(25),
})

class MCPServer {
  private readonly server = new McpServer({
    name: "mcp-opennutrition",
    version: "1.0.0",
  });

  constructor(
      private readonly transport: StdioServerTransport,
      private readonly db: InMemoryDBAdapter,
  ) {
    this.server.tool("get-foods", "Get a list of foods", GetFoodsRequestSchema.shape, {
      title: "Get a list of foods",
      readOnlyHint: true,
    }, async (args, extra) => {
      const foods = await this.db.getAll(args.page, args.pageSize);
      return {
        content: [],
        structuredContent: {
          foods,
        },
      }
    })
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
