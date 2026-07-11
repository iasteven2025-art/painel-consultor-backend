/**
 * Aplica as migrações SQL (pasta migrations/) no banco apontado por POSTGRES_URL.
 * Uso: npm run migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('Defina POSTGRES_URL no .env antes de rodar as migrações.');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  const dir = path.join(__dirname, '..', 'migrations');
  const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const arquivo of arquivos) {
    console.log(`Aplicando ${arquivo}...`);
    const sql = fs.readFileSync(path.join(dir, arquivo), 'utf8');
    await pool.query(sql);
  }

  console.log('Migrações aplicadas com sucesso.');
  await pool.end();
}

main().catch(err => {
  console.error('Erro ao migrar:', err);
  process.exit(1);
});
