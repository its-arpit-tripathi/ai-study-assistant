import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAllMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`\n========================================`);
  console.log(`📦 Running Database Migrations (${files.length} files found)`);
  console.log(`========================================\n`);

  const db = getPool();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');

    // Strip comment lines properly handling CRLF
    const lines = sql
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith('--'));

    const cleanedSql = lines.join('\n');
    const statements = cleanedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Executing migration: ${file} (${statements.length} statements)...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
      try {
        await db.query(stmt);
        console.log(`  [${i + 1}/${statements.length}] ✓ ${preview}...`);
      } catch (err) {
        console.error(`  [${i + 1}/${statements.length}] ✗ Error:`, err.message);
        throw err;
      }
    }
    console.log(`  ✓ ${file} applied.\n`);
  }

  // Display summary of tables & indexes
  const tables = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log('Current Tables in Public Schema:');
  for (const row of tables.rows) {
    console.log(`  - ${row.tablename}`);
  }

  const indexes = await db.query(
    "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname"
  );
  console.log('\nVerified Indexes:');
  for (const row of indexes.rows) {
    console.log(`  - [${row.tablename}] ${row.indexname}`);
  }

  console.log('\n✅ All migrations executed successfully.\n');
  process.exit(0);
}

runAllMigrations().catch((err) => {
  console.error('\n❌ Migration execution failed:', err);
  process.exit(1);
});
