// Windows-compatible wrapper to run the data setup scripts
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';

const DATASET_ZIP = path.join(process.cwd(), 'data', 'opennutrition-dataset-2025.1.zip');
const TEMP_DIR = path.join(process.cwd(), 'data_local_temp');
const DB_DIR = path.join(process.cwd(), 'data_local');
const TSV_FILE = path.join(TEMP_DIR, 'opennutrition_foods.tsv');
const DB_FILE = path.join(DB_DIR, 'opennutrition_foods.db');

async function decompressDataset() {
  console.log('Decompressing dataset from:', DATASET_ZIP);
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    yauzl.open(DATASET_ZIP, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      if (!zipfile) return reject(new Error('Failed to open zip'));

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
        } else {
          const outputPath = path.join(TEMP_DIR, entry.fileName);
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            if (!readStream) return reject(new Error('No read stream'));
            const writeStream = createWriteStream(outputPath);
            pipeline(readStream, writeStream)
              .then(() => { console.log('Extracted:', entry.fileName); zipfile.readEntry(); })
              .catch(reject);
          });
        }
      });
      zipfile.on('end', () => { console.log('Decompressed!'); resolve(); });
      zipfile.on('error', reject);
    });
  });
}

function convertToSqlite() {
  console.log('Converting TSV to SQLite...');
  if (!fs.existsSync(TSV_FILE)) throw new Error('TSV not found: ' + TSV_FILE);

  const lines = fs.readFileSync(TSV_FILE, 'utf-8').trim().split('\n');
  const headers = lines[0].split('\t');
  const rows = lines.slice(1).map(l => l.split('\t'));
  console.log(`${headers.length} columns, ${rows.length} rows`);

  fs.mkdirSync(DB_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

  const db = new Database(DB_FILE);
  const colDefs = headers.map(c => `"${c}" TEXT`).join(', ');
  db.exec(`CREATE TABLE IF NOT EXISTS foods (${colDefs})`);
  console.log('Table created');

  const jsonCols = ['alternate_names','labels','source','nutrition_100g','serving','package_size','ingredient_analysis'];
  const colSql = headers.map(c => jsonCols.includes(c) ? `json(?) AS "${c}"` : `? AS "${c}"`).join(', ');
  const stmt = db.prepare(`INSERT INTO foods SELECT ${colSql}`);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const r = [...row];
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
  console.log('Database created:', DB_FILE);
}

async function main() {
  await decompressDataset();
  convertToSqlite();
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('Setup complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
