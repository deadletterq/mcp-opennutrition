import Database from 'better-sqlite3';

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

export class SQLiteDBAdapter {
  private readonly db: Database.Database;

  constructor() {
    this.db = new Database('data_local/opennutrition_foods.db', { readonly: true });
  }

  private getFoodItemSelectClause(): string {
    return `id, name, type, ean_13,
            json_extract(labels, '$') as labels,
            json_extract(nutrition_100g, '$') as nutrition_100g,
            json_extract(alternate_names, '$') as alternate_names,
            json_extract(source, '$') as source,
            json_extract(serving, '$') as serving,
            json_extract(package_size, '$') as package_size,
            json_extract(ingredient_analysis, '$') as ingredient_analysis`;
  }

  async getAll(page: number, pageSize: number): Promise<FoodItem[]> {
    const offset = (page - 1) * pageSize;
    const selectClause = this.getFoodItemSelectClause();
    const rows = this.db.prepare(`SELECT ${selectClause} FROM foods LIMIT ? OFFSET ?`).all(pageSize, offset);
    return rows.map(this.deserializeRow);
  }

  async getById(id: string): Promise<FoodItem | null> {
    const selectClause = this.getFoodItemSelectClause();
    const row = this.db.prepare(`SELECT ${selectClause} FROM foods WHERE id = ?`).get(id);
    return row ? this.deserializeRow(row) : null;
  }

  async getByEan13(ean_13: string): Promise<FoodItem | null> {
    const selectClause = this.getFoodItemSelectClause();
    const row = this.db.prepare(`SELECT ${selectClause} FROM foods WHERE ean_13 = ?`).get(ean_13);
    return row ? this.deserializeRow(row) : null;
  }

  private deserializeRow(row: any): FoodItem {
    const jsonColumns = [
      'alternate_names',
      'source',
      'serving',
      'nutrition_100g',
      'labels',
      'package_size',
      'ingredient_analysis',
    ];
    for (const col of jsonColumns) {
      if (typeof row[col] === 'string' && row[col]) {
        try {
          row[col] = JSON.parse(row[col]);
        } catch {
          row[col] = undefined;
        }
      }
    }
    return row;
  }
}
