/**
 * Conexão com o Postgres. Funciona tanto com Vercel Postgres (Neon) quanto
 * com qualquer Postgres padrão — basta apontar POSTGRES_URL no ambiente.
 *
 * Em ambiente serverless (Vercel), reaproveita o Pool entre invocações
 * "quentes" da função para não abrir uma conexão nova a cada requisição.
 */
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL não definida nas variáveis de ambiente.');
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

module.exports = { getPool, query };
