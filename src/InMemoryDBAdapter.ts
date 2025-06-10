import {fileURLToPath} from "url";
import path from "path";
import fs from "fs/promises";
import Papa from "papaparse";

interface FoodItem {
  id: string;
  name: string;
  type?: string;
  labels?: string[];
  nutrition_100g?: Record<string, number>;
  alternate_names?: string[];
  source?: string;
  serving?: string;
  package_size?: string;
  ingredient_analysis?: Record<string, any>;
  ean_13?: string;
}

const ATTRIBUTION =
    'Data: OpenNutrition (https://www.opennutrition.app). If present: (c) Open Food Facts contributors (https://world.openfoodfacts.org). Subject to ODbL.';

export class InMemoryDBAdapter {
  private FOODS: FoodItem[] = [];

  async load() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const DATA_PATH = path.join(__dirname, "./opennutrition_foods.tsv");
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = Papa.parse<FoodItem>(raw, {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true
    });
    type JsonColumn =
        "alternate_names"
        | "source"
        | "serving"
        | "nutrition_100g"
        | "labels"
        | "package_size"
        | "ingredient_analysis";
    const JSON_COLUMNS: JsonColumn[] = [
      "alternate_names",
      "source",
      "serving",
      "nutrition_100g",
      "labels",
      "package_size",
      "ingredient_analysis",
    ];
    this.FOODS = parsed.data.map(row => {
      for (const col of JSON_COLUMNS) {
        if (typeof row[col] === "string" && row[col]) {
          try {
            row[col] = JSON.parse(row[col]);
          } catch {
            // @ts-ignore
            row[col] = undefined;
          }
        }
      }
      return row;
    });
  }

  async getAll(page: number, pageSize: number): Promise<FoodItem[]> {
    return this.FOODS.slice(page, pageSize);
  }

  async getById(id: string): Promise<FoodItem | null> {
    return this.FOODS.find(food => food.id === id) || null;
  }

  async getByEan13(ean_13: string): Promise<FoodItem | null> {
    return this.FOODS.find(food => food.ean_13 === ean_13) || null;
  }
}