import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {InMemoryDBAdapter} from "./InMemoryDBAdapter.js";
import {z} from "zod";
import {ToolAnnotations} from "@modelcontextprotocol/sdk/types.js";
import {ToolCallback} from "@modelcontextprotocol/sdk/server/mcp.js";

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
    const getFoodsAnnotation: ToolAnnotations = {
      title: "Get a list of foods",
      readOnlyHint: true,
    }
    const cb: ToolCallback<typeof GetFoodsRequestSchema.shape> = async (args, extra) => {
      const page = args.page
      const pageSize = args.pageSize
      const foods = await this.db.getAll(page, pageSize);
      return {
        content: [],
        structuredContent: {
          foods,
        },
      }
    }
    this.server.tool("get-foods", "Get a list of foods", GetFoodsRequestSchema.shape, getFoodsAnnotation, cb)
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
