import test from 'node:test';
import assert from 'node:assert/strict';
import { utils, write } from 'xlsx';
import { readTicketWorkbook, ticketsFromWorksheet } from './ticket-import.js';
import { getReportTicketUrl, withReportTicketLinks } from './api.js';
import { buildTicketReport } from '../../shared/ticket-report.js';
function workbook(rows){const book=utils.book_new();utils.book_append_sheet(book,utils.aoa_to_sheet(rows),'Tickets');return readTicketWorkbook(write(book,{type:'array',bookType:'xlsx'}));}
test('Excel parser maps Assigned To before Agent and preserves Excel wall-clock dates',()=>{
  const book=workbook([['Ticket ID','Subject','Status','Agent','Assigned To','Due by Time'],['METS-1','Test','Open','Fallback','Assigned',46318.5],['METS-2','Other','Pending','Fallback','','2026-10-23 14:30:00']]);
  const rows=ticketsFromWorksheet(book,'Tickets');assert.equal(rows.length,2);assert.equal(rows[0].assignee,'Assigned');assert.equal(rows[1].assignee,'Fallback');assert.equal(rows[0].dueAt,'2026-10-23T12:00:00');assert.equal(rows[1].dueAt,'2026-10-23T14:30:00');
});
test('Excel parser fails on malformed, duplicate and formula-derived report fields',()=>{
  assert.throws(()=>ticketsFromWorksheet(workbook([['Ticket ID','Subject'],['METS-1','Missing status']]),'Tickets'),/Required columns/);
  assert.throws(()=>ticketsFromWorksheet(workbook([['Ticket ID','Subject','Status','Agent'],['METS-1','A','Open','A'],['METS-1','B','Open','B']]),'Tickets'),/Duplicate/);
  const book=workbook([['Ticket ID','Subject','Status','Agent'],['METS-1','A','Open','A']]);book.Sheets.Tickets.B2.f='CONCAT("A")';assert.throws(()=>ticketsFromWorksheet(book,'Tickets'),/formulas/);
});
test('Excel rows retain physical offsets when the header starts below or beside blank cells',()=>{
  const book=workbook([[],[],['','Ticket ID','Subject','Status','Agent','Due by Time'],['','METS-1','Shifted','Open','Alex',46318.5]]);
  const rows=ticketsFromWorksheet(book,'Tickets');assert.equal(rows[0].dueAt,'2026-10-23T12:00:00');assert.equal(rows[0].ticketId,'METS-1');
});
test('confirmed Help Desk hash links encode ticket references and appear in old report copy without changing saved data',()=>{
  assert.equal(getReportTicketUrl('METS-1625'),'https://www.mcssi.ph:3001/#/tickets/METS-1625');
  assert.equal(getReportTicketUrl('METS-1625/other?x=1'),'https://www.mcssi.ph:3001/#/tickets/METS-1625%2Fother%3Fx%3D1');
  const saved={id:2,...buildTicketReport({reportDate:'2026-10-23',asOfTime:'14:20',timeZone:'Asia/Manila',sourceName:'tickets.xlsx',sheetName:'Tickets',tickets:[{ticketId:'METS-1625',subject:'Test',status:'Open',assignee:'Alex',url:''}]})};
  const linked=withReportTicketLinks(saved);
  assert.equal(saved.tickets[0].url,'');assert.equal(linked.id,2);assert.deepEqual(linked.totals,saved.totals);
  assert.ok(linked.html.includes('href="https://www.mcssi.ph:3001/#/tickets/METS-1625"'));assert.ok(linked.text.includes(getReportTicketUrl('METS-1625')));
  assert.ok(!linked.text.includes('Some ticket links are not configured'));
  assert.equal(withReportTicketLinks(linked),linked);
});
