import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVoucherCodes, voucherTextFromItems } from './voucher-import.js';

test('UniFi sheet parsing preserves leading zeros, fixes sample-font glyphs and skips printed limits', () => {
  const result = extractVoucherCodes('Valid for 8h 01234-00001 Download speed: 20.0 Mbps Data Limit: 1000 MB\n01234-00001\n\ue06b1234\ue088\ue06b\ue06b\ue06b\ue06b2 12345 - 67890');
  assert.deepEqual(result, {codes:['01234-00001','01234-00002','12345-67890'],duplicates:1});
  assert.deepEqual(extractVoucherCodes('123456-12345 X12345-67890 12345-678901 12345-67890X'),{codes:[],duplicates:0});
  assert.deepEqual(extractVoucherCodes(voucherTextFromItems([{str:'Valid for 8h',hasEOL:true},{str:'\ue06b'},{str:'1234'},{str:'\ue088'},{str:'\ue06b\ue06b\ue06b\ue06b1'},{str:'',hasEOL:true},{str:'Download speed: 20 Mbps'}])).codes,['01234-00001']);
});
