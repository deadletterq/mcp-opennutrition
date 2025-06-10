import {McpServer,} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {SQLiteDBAdapter} from "./SQLiteDBAdapter.js";
import {z} from "zod";

const GetFoodsRequestSchema = z.object({
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().optional().default(25),
});

const GetFoodByIdRequestSchema = z.object({
  id: z.string().startsWith("fd_", "Food ID must start with 'fd_'"),
});

const GetFoodByEan13RequestSchema = z.object({
  ean_13: z.string().length(13, "EAN-13 must be exactly 13 characters long")
});

class MCPServer {
  private readonly server = new McpServer({
    name: "mcp-opennutrition",
    version: "1.0.0",
  });

  constructor(
      private readonly transport: StdioServerTransport,
      private readonly db: SQLiteDBAdapter,
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
      };
    });

    this.server.tool("get-food-by-id", "Get a food by its unique id", GetFoodByIdRequestSchema.shape, {
      title: "Get a food by id",
      readOnlyHint: true,
    }, async (args, extra) => {
      const food = await this.db.getById(args.id);
      return {
        content: [],
        structuredContent: {
          food: food,
        },
      };
    });

    this.server.tool("get-food-by-ean13", "Get a food by its EAN-13 barcode", GetFoodByEan13RequestSchema.shape, {
      title: "Get a food by EAN-13",
      readOnlyHint: true,
    }, async (args, extra) => {
      const food = await this.db.getByEan13(args.ean_13);
      return {
        content: [],
        structuredContent: {
          food: food,
        },
      };
    });
  }

  async connect(): Promise<void> {
    return this.server.connect(this.transport)
  }
}

async function main() {
  const db = new SQLiteDBAdapter()
  const transport = new StdioServerTransport();
  const server = new MCPServer(transport, db);
  await server.connect();
  console.error("OpenNutrition MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
