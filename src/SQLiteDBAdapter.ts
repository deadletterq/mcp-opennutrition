import Database from 'better-sqlite3';
import path from 'path';
import {fileURLToPath} from 'url';

interface FoodItem {
  id: string;
  name: string;
  description?: string;
  type?: 'everyday' | 'grocery' | 'prepared' | 'restaurant';
  labels?: string[];
  nutrition_100g?: Record<string, number>;
  alternate_names?: string[];
  source?: Record<string, any>[];
  serving?: Record<string, any>;
  package_size?: Record<string, any>;
  ingredient_analysis?: Record<string, any>;
  ean_13?: string;
  ingredients?: string;
}

export class SQLiteDBAdapter {
  private readonly db: Database.Database;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dbPath = path.join(__dirname, '..', 'data_local', 'opennutrition_foods.db');
    this.db = new Database(dbPath, {readonly: true});
  }

  /**
   * Search foods by name or any alternate name (case-insensitive, partial match)
   */
  async searchByName(query: string, page: number = 1, pageSize: number = 25): Promise<FoodItem[]> {
    const offset = (page - 1) * pageSize;
    const selectClause = this.getFoodItemSelectClause();
    // Fuzzy search: split query into words and match all with LIKE
    const terms = query.trim().split(/\s+/).map(t => `%${t}%`);
    let whereClauses = terms.map(() => "(LOWER(foods.name) LIKE LOWER(?) OR LOWER(alt.value) LIKE LOWER(?))").join(" AND ");
    let args: string[] = [];
    for (const t of terms) args.push(t, t);
    args.push(pageSize.toString(), offset.toString());
    const rows = this.db.prepare(`
        SELECT DISTINCT ${selectClause}
        FROM foods
                 LEFT JOIN json_each(foods.alternate_names) AS alt ON 1 = 1
        WHERE ${whereClauses} LIMIT ?
        OFFSET ?
    `).all(...args);
    return rows.map(this.deserializeRow);
  }

  private getFoodItemSelectClause(): string {
    return `foods.id, foods.name, foods.type, foods.ean_13,
            json_extract(foods.labels, '$') as labels,
            json_extract(foods.nutrition_100g, '$') as nutrition_100g,
            json_extract(foods.alternate_names, '$') as alternate_names,
            json_extract(foods.source, '$') as source,
            json_extract(foods.serving, '$') as serving,
            json_extract(foods.package_size, '$') as package_size,
            json_extract(foods.ingredient_analysis, '$') as ingredient_analysis`;
  }

  async getAll(page: number, pageSize: number): Promise<FoodItem[]> {
    const offset = (page - 1) * pageSize;
    const selectClause = this.getFoodItemSelectClause();
    const rows = this.db.prepare(`SELECT ${selectClause}
                                  FROM foods LIMIT ?
                                  OFFSET ?`).all(pageSize, offset);
    return rows.map(this.deserializeRow);
  }

  async getById(id: string): Promise<FoodItem | null> {
    const selectClause = this.getFoodItemSelectClause();
    const row = this.db.prepare(`SELECT ${selectClause}
                                 FROM foods
                                 WHERE id = ?`).get(id);
    return row ? this.deserializeRow(row) : null;
  }

  async getByEan13(ean_13: string): Promise<FoodItem | null> {
    const selectClause = this.getFoodItemSelectClause();
    const row = this.db.prepare(`SELECT ${selectClause}
                                 FROM foods
                                 WHERE ean_13 = ?`).get(ean_13);
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
