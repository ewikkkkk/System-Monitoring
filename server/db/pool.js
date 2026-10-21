import mssql from 'mssql';
import { AsyncLocalStorage } from 'node:async_hooks';

export const sql = mssql;
const pools = new AsyncLocalStorage();
export function withPool(getPool, next) { return pools.run(getPool, next); }
export async function query(text, params = {}) {
  const getPool = pools.getStore();
  if (!getPool) throw new Error('Database pool context is missing');
  const pool = await getPool();
  const request = pool.request();
  for (const [name, { type, value }] of Object.entries(params)) request.input(name, type, value);
  return request.query(text);
}
// Local development only; driver access stays in this file.
export async function createDevPool(config) { return new mssql.ConnectionPool(config).connect(); }
