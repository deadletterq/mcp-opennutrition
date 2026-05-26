import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const TSV = path.join(process.cwd(), 'data_local_temp', 'opennutrition_foods.tsv');
const DB_DIR = path.join(process.cwd(), 'data_local');
const DB = path.join(DB_DIR, 'opennutrition_foods.db');

console.log('Reading TSV from:', TSV);
const lines = fs.readFileSync(TSV, 'utf-8').trim().split('\n');
const headers = lines[0].split('\t');
const rows = lines.slice(1).map(l => l.split('\t'));
console.log(`${headers.length} columns, ${rows.length} rows`);

fs.mkdirSync(DB_DIR, { recursive: true });
if (fs.existsSync(DB)) fs.unlinkSync(DB);

const db = new Database(DB);
db.exec('CREATE TABLE foods (' + headers.map(c => `"${c}" TEXT`).join(', ') + ')');
console.log('Table created');

const jsonCols = ['alternate_names','labels','source','nutrition_100g','serving','package_size','ingredient_analysis'];
const colSql = headers.map(c => jsonCols.includes(c) ? `json(?) AS "${c}"` : `? AS "${c}"`).join(', ');
const stmt = db.prepare(`INSERT INTO foods SELECT ${colSql}`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    const r = [...row];
    // Pad to header length if row is shorter
    while (r.length < headers.length) r.push(null);
    for (const jc of jsonCols) {
      const i = headers.indexOf(jc);
      if (i !== -1 && r[i]) {
        try { r[i] = JSON.stringify(JSON.parse(r[i])); } catch { r[i] = null; }
      }
    }
    stmt.run(r);
  }
});

insertMany(rows);
db.close();
console.log('Database created:', DB);

// Cleanup temp
fs.rmSync(path.join(process.cwd(), 'data_local_temp'), { recursive: true, force: true });
console.log('Temp files cleaned up. Setup complete!');
