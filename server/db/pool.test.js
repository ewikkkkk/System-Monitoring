import test from 'node:test';
import assert from 'node:assert/strict';
import { query, sql, withPool } from './pool.js';

test('SQL seam binds malicious-looking values as typed parameters', async () => {
  const inputs = [];
  const statement = 'SELECT @title AS title';
  const value = "x'; DROP TABLE monitoring.Tasks;--";
  const pool = { request: () => ({ input(...args) { inputs.push(args); return this; }, async query(text) { assert.equal(text, statement); return { recordset: [{ title: value }] }; } }) };
  const result = await withPool(() => pool, () => query(statement, { title: { type: sql.NVarChar(240), value } }));
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0][0], 'title');
  assert.equal(inputs[0][2], value);
  assert.equal(result.recordset[0].title, value);
});

test('concurrent router contexts keep independent pool getters', async () => {
  const makePool = name => ({ request: () => ({ query: async () => name }) });
  const results = await Promise.all(['a', 'b'].map(name => withPool(async () => {
    await new Promise(resolve => setTimeout(resolve, name === 'a' ? 15 : 1));
    return makePool(name);
  }, () => query('SELECT 1'))));
  assert.deepEqual(results, ['a', 'b']);
});

test('query without router context fails closed', async () => {
  await assert.rejects(query('SELECT 1'), /pool context is missing/);
});
