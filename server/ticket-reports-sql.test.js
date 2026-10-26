// SQL routing/binding contract only. This does not certify SQL Server execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createSystemMonitoringRouter } from './index.js';
test('SQL report router binds snapshot values and derives totals and actor on the server',async t=>{
  const statements=[];let inserted;
  const pool={request:()=>{const params={};return {input(name,type,value){params[name]=value;return this;},async query(text){
    statements.push({text,params});
    if(params.snapshot){inserted={id:1,snapshotJson:params.snapshot,actorId:params.actor,createdAt:new Date().toISOString()};return {recordset:[inserted]};}
    if(params.id)return{recordset:params.id===1?[inserted]:[]};
    return{recordset:[]};
  }};}};
  const app=express();app.use((req,res,next)=>{req.user={userId:'host-reporter'};next();});app.use(createSystemMonitoringRouter(()=>pool));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,subject="x'; DROP TABLE monitoring.Tasks;--";
  const body={requestId:randomUUID(),reportDate:'2026-10-23',asOfTime:'14:20',timeZone:'Asia/Manila',sourceName:'tickets.xlsx',sheetName:'Tickets',actorId:'forged',totals:{total:999},tickets:[{ticketId:'METS-1',subject,status:'Open',assignee:'Alex'}]};
  const response=await fetch(base+'/ticket-reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(response.status,201);const report=await response.json();assert.equal(report.totals.total,1);assert.equal(report.actorId,'host-reporter');assert.equal(report.tickets[0].subject,subject);
  assert.ok(!statements[0].text.includes(subject));assert.equal(statements[0].params.total,1);assert.equal(statements[0].params.actor,'host-reporter');assert.ok(statements[0].params.snapshot.includes(subject));
  assert.equal((await fetch(base+'/ticket-reports/1')).status,200);assert.equal((await fetch(base+'/ticket-reports/2')).status,404);assert.equal((await fetch(base+'/ticket-reports/bad')).status,400);
});
