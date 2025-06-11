#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const TSV_FILE_PATH = path.join(process.cwd(), 'data_local_temp', 'opennutrition_foods.tsv');
const DB_FILE_PATH = path.join(process.cwd(), 'data_local', 'opennutrition_foods.db');

function convertTsvToSqlite() {
  try {
    if (!fs.existsSync(TSV_FILE_PATH)) {
      throw new Error(`TSV file not found: ${TSV_FILE_PATH}`);
    }
    
    console.log('Reading TSV file...');
    const tsvContent = fs.readFileSync(TSV_FILE_PATH, 'utf-8');
    const lines = tsvContent.trim().split('\n');
    
    if (lines.length === 0) {
      throw new Error('TSV file is empty');
    }
    
    const headers = lines[0].split('\t');
    const dataRows = lines.slice(1).map(line => line.split('\t'));
    
    console.log(`Found ${headers.length} columns and ${dataRows.length} data rows`);
    
    // Ensure the database directory exists
    const dbDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created directory: ${dbDir}`);
    }
    
    if (fs.existsSync(DB_FILE_PATH)) {
      fs.unlinkSync(DB_FILE_PATH);
      console.log('Removed existing database file');
    }
    
    const db = createDatabase();
    createTable(db, headers);
    insertData(db, headers, dataRows);
    
    db.close();
    console.log('Database connection closed');
    console.log(`Successfully converted ${TSV_FILE_PATH} to ${DB_FILE_PATH}`);
    
  } catch (error) {
    console.error('Error converting TSV to SQLite:', error);
    process.exit(1);
  }
}

function createDatabase(): Database.Database {
  console.log('Connected to SQLite database');
  return new Database(DB_FILE_PATH);
}

function createTable(db: Database.Database, columns: string[]): void {
  const columnDefinitions = columns.map(col => `"${col}" TEXT`).join(', ');
  const createTableSQL = `CREATE TABLE IF NOT EXISTS foods (${columnDefinitions})`;
  
  db.exec(createTableSQL);
  console.log('Created foods table');
}

function insertData(db: Database.Database, columns: string[], rows: string[][]): void {
  const jsonColumns = [
    'alternate_names',
    'labels',
    'source',
    'nutrition_100g',
    'serving',
    'package_size',
    'ingredient_analysis',
  ];
  
  const columnSql = columns.map(col => {
    if (jsonColumns.includes(col)) {
      return `json(?) AS "${col}"`;
    } else {
      return `? AS "${col}"`;
    }
  }).join(', ');
  
  const insertSQL = `INSERT INTO foods SELECT ${columnSql}`;
  const stmt = db.prepare(insertSQL);
  
  const insertMany = db.transaction((rows: string[][]) => {
    for (const row of rows) {
      const rowToInsert: any[] = [...row];
      
      for (const jsonCol of jsonColumns) {
        const colIndex = columns.indexOf(jsonCol);
        if (colIndex !== -1 && rowToInsert[colIndex] !== undefined && rowToInsert[colIndex] !== '') {
          try {
            // Parse and stringify to ensure valid JSON format
            const parsed = JSON.parse(rowToInsert[colIndex]);
            rowToInsert[colIndex] = JSON.stringify(parsed);
          } catch (e) {
            console.warn(`Warning: Could not parse JSON for column '${jsonCol}' with value '${rowToInsert[colIndex]}'. Setting to NULL.`);
            rowToInsert[colIndex] = null;
          }
        }
      }
      
      stmt.run(rowToInsert);
    }
  });

  insertMany(rows);
  console.log(`Inserted ${rows.length} rows into database`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  convertTsvToSqlite();
}

export { convertTsvToSqlite };