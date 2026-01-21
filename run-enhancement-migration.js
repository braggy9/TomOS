const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const migrationPath = path.join(__dirname, 'prisma/migrations/20260121_add_note_enhancements/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Running note enhancements migration...\n');

  // Split SQL into individual statements
  // Remove all comment lines first, then split
  const cleanedSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanedSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (const statement of statements) {
    if (statement) {
      console.log(`Executing: ${statement.substring(0, 70)}...`);
      await prisma.$executeRawUnsafe(statement);
    }
  }

  console.log('\n✅ Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
