import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDemoStore } from './store.js';
import { createDemoMonitoringRouter } from './router.js';
import { zapierReportDate } from '../zapier-report.js';
test('daily reports persist immutable versions, recompute totals and ignore caller identity',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'sysmon-reports-')),file=join(dir,'demo.json'),store=await createDemoStore(file),app=express();
  app.use((req,res,next)=>{req.user={userId:'trusted-host'};next();});app.use(createDemoMonitoringRouter(store));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const body={requestId:randomUUID(),reportDate:'2026-10-23',asOfTime:'14:20',timeZone:'Asia/Manila',sourceName:'tickets.xlsx',sheetName:'Tickets',actorId:'forged',totals:{total:999},html:'<script>bad</script>',tickets:[{ticketId:'METS-1',subject:'Test',assignee:'Alex',status:'Open'}]};
  const post=async value=>{const response=await fetch(base+'/ticket-reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});return{status:response.status,body:await response.json()};};
  const saved=await post(body);assert.equal(saved.status,201);assert.equal(saved.body.totals.total,1);assert.equal(saved.body.actorId,'trusted-host');assert.ok(!saved.body.html.includes('<script>'));
  assert.equal((await post(body)).body.id,saved.body.id);
  const second=await post({...body,requestId:randomUUID(),asOfTime:'15:00',tickets:[{...body.tickets[0],status:'Closed'}]});assert.notEqual(second.body.id,saved.body.id);
  const list=await(await fetch(base+'/ticket-reports')).json();assert.equal(list.length,2);assert.equal(list[0].unfinished,0);assert.equal(list[1].unfinished,1);
  assert.ok(!Object.hasOwn(list[0],'tickets'));
  const reloaded=await createDemoStore(file);assert.equal(reloaded.snapshot().ticketReports[0].totals.unfinished,1);assert.equal(reloaded.snapshot().ticketReports.length,2);
  const original=await(await fetch(base+`/ticket-reports/${saved.body.id}`)).json();assert.equal(original.totals.unfinished,1);
  assert.equal((await post({...body,requestId:randomUUID(),tickets:[{ticketId:'METS-1'}]})).status,400);
  const untrusted=express();untrusted.use(createDemoMonitoringRouter(store));const noUser=untrusted.listen(0,'127.0.0.1');await new Promise(resolve=>noUser.once('listening',resolve));t.after(()=>new Promise(resolve=>noUser.close(resolve)));
  assert.equal((await fetch(`http://127.0.0.1:${noUser.address().port}/ticket-reports`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,401);
});

test('Zapier skips stale snapshots and exports the latest same-day version with ordered clickable parts', async t => {
  const date = zapierReportDate();
  const app = express();
  const reports = [{id: 1, reportDate: '2000-01-01', asOfTime: '14:00'}];
  let user = null;
  app.use((req, res, next) => { req.user = user; next(); });
  app.use(createDemoMonitoringRouter({snapshot: () => ({ticketReports: reports})}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/ticket-reports/zapier/daily`;
  assert.equal((await fetch(url)).status, 401);
  user = {userId: 'zapier-service'};
  const skipped = await fetch(url);
  assert.equal(skipped.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await skipped.json(), {ready: false, report_date: date, part_count: 0});

  const savedReport = {reportDate: date, asOfTime: '14:00', timeZone: 'Asia/Manila',
    sourceName: 'test.xlsx', sheetName: 'Tickets', totals: {total: 40, unfinished: 40, resolved: 0, closed: 0, overdue: 0},
    tickets: Array.from({length: 40}, (_, i) => ({
      ticketId: `METS-${i + 1}`, subject: 'A & B '.repeat(125), status: 'Open', assignee: 'Alex',
    })),
  };
  reports.push({...savedReport, id: 2}, {...savedReport, id: 3}, {...savedReport, id: 4, asOfTime: '13:00'});
  const payload = await (await fetch(url)).json();
  assert.equal(payload.report_id, 3);
  assert.equal(payload.total_imported, 40);
  const parts = JSON.parse(payload.messages_json);
  assert.ok(parts.length > 1);
  assert.equal(payload.part_count, parts.length);
  for (const part of parts) {
    assert.ok(Buffer.byteLength(JSON.stringify({body: {contentType: 'html', content: part}})) <= 20_000);
    assert.equal((part.match(/<ul>/g) || []).length, (part.match(/<\/ul>/g) || []).length);
  }
  const html = parts.join('');
  assert.deepEqual([...html.matchAll(/href="[^"]+\/tickets\/METS-(\d+)"/g)].map(match => Number(match[1])),
    Array.from({length: 40}, (_, i) => 40 - i));
  assert.match(html, /A &amp; B/);
});
