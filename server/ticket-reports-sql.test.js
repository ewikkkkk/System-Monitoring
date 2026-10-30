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

test('SQL workflow routes bind precise and compatibility statuses; read old rows canonically',async t=>{
 const calls=[];const pool={request:()=>{const params={};return{input(name,type,value){params[name]=value;return this;},async query(text){calls.push({text,params});return{recordset:params.workflowStatus?[{id:1,status:params.workflowStatus}]:[{id:1,type:'Bug',status:'Closed',workflowStatus:null}]};}};}};
 const app=express();app.use((req,res,next)=>{req.user={userId:'host-user'};next();});app.use(createSystemMonitoringRouter(()=>pool));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const list=await(await fetch(base+'/tasks')).json();assert.equal(list[0].status,'COMPLETE');
 for(const [status,legacy] of [['DEV LIVE','Ready for release'],['MALFUNCTIONING (PL)','In progress'],['PROD LIVE (HYPERCARE)','Prod live'],['COMPLETE','Closed']]){
   const response=await fetch(base+'/tasks/1/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,actor:'forged'})});
   assert.equal(response.status,200);assert.equal((await response.json()).status,status);
   const call=calls.at(-1);assert.equal(call.params.status,legacy);assert.equal(call.params.workflowStatus,status);assert.equal(call.params.actor,'host-user');assert.ok(call.text.includes('workflowStatus=@workflowStatus'));assert.ok(call.text.includes('VALUES(@id,@actor,@workflowStatus,@note)'));
 }
});

test('SQL task save binds conversation text and host author inside the task transaction',async t=>{
 const calls=[],pool={request:()=>{const params={};return{input(name,type,value){params[name]=value;return this;},async query(text){calls.push({text,params});return{recordset:[{id:1}]};}};}};
 const app=express();app.use((req,res,next)=>{req.user={userId:'host-author'};next();});app.use(createSystemMonitoringRouter(()=>pool));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const text="x'; DROP TABLE monitoring.TaskComments;--",body={title:'Inline edit',targetDeploymentDate:'2026-11-05',remarks:"Good for test '; --",type:'Bug',status:'OPEN',priority:'Normal',system:'WMS',moduleName:'Picking',reference:'METS-1',description:'Details',notes:'Legacy notes',newComment:{requestId:randomUUID(),text,actorId:'forged'},commentEdits:[{id:2,text:'Own comment correction'}]};
 const response=await fetch(`http://127.0.0.1:${server.address().port}/tasks/1`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal(response.status,200);const call=calls.at(-1);assert.equal(call.params.actor,'host-author');assert.equal(call.params.commentText,text);assert.equal(call.params.remarks,body.remarks);assert.equal(call.params.targetDeploymentDate,'2026-11-05');assert.equal(call.params.targetDateProvided,true);assert.ok(!call.text.includes(body.remarks));assert.equal(call.params.commentRequest,body.newComment.requestId);assert.ok(!call.text.includes(text));assert.deepEqual(JSON.parse(call.params.commentEdits),body.commentEdits);
 assert.ok(call.text.includes('c.actorId<>@actor'));assert.ok(call.text.indexOf('INSERT monitoring.TaskComments')<call.text.indexOf('COMMIT;'));assert.ok(call.text.includes('IF @@TRANCOUNT > 0 ROLLBACK'));
});

test('personal task query binds host account and ignores browser-selected identity',async t=>{
 const calls=[];let actor="host'; --";
 const pool={request:()=>{const params={};return{input(name,type,value){params[name]=value;return this;},async query(text){calls.push({text,params});return{recordset:[{id:1,type:'Bug',status:'Open',workflowStatus:'ONGOING DEV'}]};}};}};
 const app=express();app.use((req,res,next)=>{req.user=actor?{userId:actor}:null;next();});app.use(createSystemMonitoringRouter(()=>pool));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}/my-tasks?userId=forged`;
 const response=await fetch(url);assert.equal(response.status,200);assert.equal((await response.json())[0].status,'ONGOING DEV');
 assert.equal(calls[0].params.actor,actor);assert.ok(!calls[0].text.includes(actor));assert.match(calls[0].text,/WHERE t.developerId=@actor OR t.testerId=@actor/);
 actor=null;assert.equal((await fetch(url)).status,401);assert.equal(calls.length,1);
});
