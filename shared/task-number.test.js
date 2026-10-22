import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTaskNumber } from './task-number.js';

test('generated concern number never uses help desk reference', () => {
  assert.equal(formatTaskNumber({id:1234,type:'Bug',reference:'T-155441'}),'BUG-1234');
  assert.equal(formatTaskNumber({id:7,type:'Enhancement',reference:'T-999999'}),'ENH-0007');
  assert.equal(formatTaskNumber({id:12345,type:'Bug'}),'BUG-12345');
});
test('type changes preserve numeric identity and event numbers use task identity', () => {
  assert.equal(formatTaskNumber({id:17,type:'Bug'}),'BUG-0017');
  assert.equal(formatTaskNumber({id:17,type:'Enhancement'}),'ENH-0017');
  assert.equal(formatTaskNumber({id:900,taskId:17,type:'Bug'}),'BUG-0017');
});
test('unsaved tasks show an explicit placeholder instead of a made-up ID', () => {
  assert.equal(formatTaskNumber({type:'Bug'}),'BUG (assigned on save)');
  assert.equal(formatTaskNumber({type:'Enhancement'}),'ENH (assigned on save)');
});
