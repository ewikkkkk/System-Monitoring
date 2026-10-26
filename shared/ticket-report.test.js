import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTicketReport, dailyTicketTotals, validReportDate } from './ticket-report.js';
const input=()=>({reportDate:'2026-10-23',asOfTime:'14:20',timeZone:'Asia/Manila',sourceName:'tickets.xlsx',sheetName:'Tickets',tickets:[
  {ticketId:'METS-1',subject:'Printer <error>',status:'Open',assignee:'Alex',dueAt:'2026-10-23T14:19:59',url:'https://example.test/tickets/1'},
  {ticketId:'METS-2',subject:'Waiting',status:'Waiting on Customer',assignee:'Jamie',dueAt:'2026-10-23T14:20:00'},
  {ticketId:'METS-3',subject:'Pending',status:'Pending',assignee:'Jamie',dueAt:'2026-10-01T00:00:00'},
  {ticketId:'METS-4',subject:'Internal',status:'Internal Ticket',assignee:'Alex',dueAt:'2026-10-01T00:00:00'},
  {ticketId:'METS-5',subject:'Completed',status:'Closed',assignee:'Jamie'},
  {ticketId:'METS-6',subject:'Resolved',status:'Resolved',assignee:'Jamie'},
  {ticketId:'METS-7',subject:'Unusual status',status:'Escalated',assignee:''}
]});
test('ticket reports reconcile totals and assignees without including completed ticket detail',()=>{
  const report=buildTicketReport(input());
  assert.equal(report.totals.total,7);assert.equal(report.totals.unfinished,5);assert.equal(report.totals.overdue,1);
  assert.equal(report.groups.reduce((n,group)=>n+group.count,0),5);
  assert.equal(report.groups.find(group=>group.status==='Escalated').assignees[0].assignee,'Unassigned');
  assert.ok(report.text.includes('As of October 23, 2026 | 2:20 PM'));
  assert.ok(!report.text.includes('METS-5'));assert.ok(!report.text.includes('METS-6'));
  assert.ok(report.html.includes('Printer &lt;error&gt;'));assert.ok(report.html.includes('<a href="https://example.test/tickets/1">METS-1</a>'));
  assert.ok(report.text.includes('Pending tickets are excluded'));
});
test('ticket report validation rejects bad dates, duplicate IDs, unsafe links and missing rows',()=>{
  assert.equal(validReportDate('2026-02-30'),false);
  assert.throws(()=>buildTicketReport({...input(),reportDate:'2026-02-30'}),/date/);
  assert.throws(()=>buildTicketReport({...input(),tickets:[]}),/1 and 5,000/);
  const duplicate=input();duplicate.tickets.push({...duplicate.tickets[0],ticketId:'mets-1'});assert.throws(()=>buildTicketReport(duplicate),/Duplicate/);
  const unsafe=input();unsafe.tickets[0].url='javascript:alert(1)';assert.throws(()=>buildTicketReport(unsafe),/HTTP/);
  const invalid=input();invalid.tickets[0].dueAt='2026-02-30T00:00:00';assert.throws(()=>buildTicketReport(invalid),/due date/);
  const missing=input();missing.tickets[0].subject='';assert.throws(()=>buildTicketReport(missing),/required/);
});
test('same-day report versions do not inflate daily totals or replace a later as-of snapshot',()=>{
  const reports=[{id:1,reportDate:'2026-10-23',asOfTime:'14:20',total:524},{id:2,reportDate:'2026-10-23',asOfTime:'15:00',total:526},{id:3,reportDate:'2026-10-23',asOfTime:'13:00',total:600},{id:4,reportDate:'2026-10-24',asOfTime:'14:00',total:530},{id:5,reportDate:'2026-10-23',asOfTime:'15:00',total:525}];
  assert.deepEqual(dailyTicketTotals(reports).map(report=>report.id),[5,4]);
});
