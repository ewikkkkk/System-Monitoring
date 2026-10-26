import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDemoStore } from '../demo/store.js';
import { createDemoMonitoringRouter } from '../demo/router.js';
import { createTeamsService } from './graph.js';
import { buildTeamsPlan } from './plan.js';
import { createDemoTeamsRepository } from './repositories.js';
import { sendTeamsReport } from './delivery.js';
import { buildTicketReport } from '../../shared/ticket-report.js';

const target={id:'daily',name:'Monitoring group',chatId:'19:test-group@thread.v2'};
const members=[{userId:'11111111-1111-4111-8111-111111111111',displayName:'Alex Rivera',email:'alex@example.test'}];
function report(){return {id:1,...buildTicketReport({reportDate:'2026-10-24',asOfTime:'14:20',timeZone:'Asia/Manila',sourceName:'tickets.xlsx',sheetName:'Tickets',tickets:[{ticketId:'METS-1',subject:'Printer <error>',status:'Open',assignee:'Alex Rivera'},{ticketId:'METS-2',subject:'Network',status:'Pending',assignee:'Alex Rivera'}]})};}
async function repository(t){const dir=await mkdtemp(join(tmpdir(),'sysmon-teams-')),file=join(dir,'data.json'),store=await createDemoStore(file);t.after(()=>rm(dir,{recursive:true,force:true}));return {repo:createDemoTeamsRepository(store),store,file};}
function service(transport,extra={}){return createTeamsService({getAccessToken:async actor=>{assert.equal(actor,'trusted-host');return 'test-token';},destinations:[target],transport:input=>input.method!=='POST'&&!input.path.includes('/members')?Promise.resolve({chatType:'group',topic:target.name}):transport(input),...extra});}

test('Teams payload mentions every unique matched assignee once and escapes report and mention text',()=>{
  const r=report();r.tickets.push({ticketId:'METS-3',subject:'Other',status:'Internal Ticket',assignee:'A. Rivera'});
  const plan=buildTeamsPlan(r,target,members,{aliases:{'A. Rivera':'alex@example.test'}});
  assert.equal(plan.canSend,true);assert.equal(plan.assignees.length,2);assert.equal(plan.payload.mentions.length,1);
  assert.ok(plan.payload.body.content.includes('<at id="0">Alex Rivera</at>'));assert.ok(plan.payload.body.content.includes('Printer &lt;error&gt;'));
  assert.equal(plan.payload.mentions[0].mentioned.user.id,members[0].userId);
  assert.ok(!plan.payload.body.content.includes('test-token'));
});
test('missing, ambiguous and unassigned identities block sending and oversized reports are not truncated',()=>{
  assert.equal(buildTeamsPlan(report(),target,[]).canSend,false);
  assert.equal(buildTeamsPlan(report(),target,[...members,{...members[0],userId:'another'}]).unresolved[0].reason.includes('Multiple'),true);
  const r=report();r.tickets[0].assignee='Unassigned';assert.equal(buildTeamsPlan(r,target,members).canSend,false);
  const large=report();large.tickets=Array.from({length:100},(_,i)=>({ticketId:`METS-${i}`,subject:'A'.repeat(1000),status:'Open',assignee:'Alex Rivera'}));
  const plan=buildTeamsPlan(large,target,members);assert.equal(plan.canSend,false);assert.equal(plan.report.tickets.length,100);assert.ok(plan.issues.some(issue=>issue.includes('budget')));
});
test('concurrent sends post once, retain host actor and persist the provider receipt',async t=>{
  const {repo,file}=await repository(t);let posts=0;
  const integration=service(async input=>{if(input.method==='POST'){posts++;assert.equal(input.body.mentions.length,1);return{id:'message-123'};}return{value:members};});
  const r=report(),plan=await integration.prepare(r,'daily','trusted-host'),args={report:r,service:integration,repository:repo,destinationId:'daily',previewHash:plan.previewHash,actorId:'trusted-host'};
  const results=await Promise.all([sendTeamsReport(args),sendTeamsReport(args)]);assert.equal(posts,1);assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);
  const rows=await repo.list(1);assert.equal(rows[0].status,'Sent');assert.equal(rows[0].messageId,'message-123');assert.equal(rows[0].actorId,'trusted-host');
  const reloaded=await createDemoStore(file);assert.equal(reloaded.snapshot().teamsDeliveries[0].status,'Sent');
  assert.equal((await sendTeamsReport({...args,previewHash:'changed'})).status,409);assert.equal(posts,1);
});
test('ambiguous network delivery cannot be retried automatically, while definitive rejection permits a deliberate retry',async t=>{
  for(const ambiguous of [true,false]){
    const {repo}=await repository(t);let posts=0;
    const integration=service(async input=>{if(input.method==='POST'){posts++;if(posts===1)throw Object.assign(new Error('Test transport failed'),{ambiguous});return{id:'receipt'};}return{value:members};});
    const r=report(),plan=await integration.prepare(r,'daily','trusted-host'),args={report:r,service:integration,repository:repo,destinationId:'daily',previewHash:plan.previewHash,actorId:'trusted-host'};
    assert.equal((await sendTeamsReport(args)).deliveryStatus,ambiguous?'Unknown':'Failed');
    const retry=await sendTeamsReport(args);assert.equal(retry.status,ambiguous?409:201);assert.equal(posts,ambiguous?1:2);
  }
});
test('accepted message with audit failure is reported uncertain and blocked from duplicate posting',async t=>{
  const {repo}=await repository(t);let posts=0;const integration=service(async input=>input.method==='POST'?(posts++,{id:'accepted'}):{value:members});
  const r=report(),plan=await integration.prepare(r,'daily','trusted-host'),args={report:r,service:integration,repository:{...repo,finish:async()=>{throw new Error('Audit unavailable');}},destinationId:'daily',previewHash:plan.previewHash,actorId:'trusted-host'};
  assert.equal((await sendTeamsReport(args)).status,202);assert.equal((await sendTeamsReport(args)).status,409);assert.equal(posts,1);
});
test('Teams routes use a saved report, validate target/hash/identity and expose an honest disconnected state',async t=>{
  const {store}=await repository(t);await store.update(state=>{state.ticketReports=[{...report(),requestId:randomUUID(),actorId:'trusted-host',createdAt:new Date().toISOString()}];});
  let posts=0;const integration=service(async input=>input.method==='POST'?(posts++,{id:'route-receipt'}):{value:members});
  const app=express();app.use((req,res,next)=>{req.user={userId:'trusted-host'};next();});app.use(createDemoMonitoringRouter(store));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/ticket-reports/1/teams`,post=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
  assert.equal((await(await fetch(base)).json()).connection.configured,false);assert.equal((await post('/send',{})).status,503);
  app.locals.systemMonitoringTeams=integration;
  assert.equal((await post('/preview',{destinationId:'unknown'})).status,400);
  const prepared=await post('/preview',{destinationId:'daily'});assert.equal(prepared.status,200);assert.equal(prepared.body.plan.canSend,true);assert.equal(prepared.body.plan.payload,undefined);
  const sent=await post('/send',{destinationId:'daily',previewHash:prepared.body.plan.previewHash,actorId:'forged',html:'forged'});assert.equal(sent.status,201);assert.equal(sent.body.delivery.actorId,'trusted-host');assert.equal(posts,1);
  assert.equal((await post('/send',{destinationId:'daily',previewHash:prepared.body.plan.previewHash})).status,409);assert.equal(posts,1);
});
test('Graph member paging rejects unexpected hosts instead of disclosing the delegated token',async()=>{
  const integration=service(async()=>({value:[], '@odata.nextLink':'https://example.test/steal-token'}));
  await assert.rejects(integration.prepare(report(),'daily','trusted-host'),/Unexpected/);
});
test('configured destinations must resolve to actual group chats and token getter failures do not expose secrets',async()=>{
  const integration=createTeamsService({getAccessToken:async()=> 'test-token',destinations:[target],transport:async()=>({chatType:'oneOnOne'})});
  await assert.rejects(integration.prepare(report(),'daily','actor'),/not a Microsoft Teams group chat/);
  const badToken=createTeamsService({getAccessToken:async()=>{throw new Error('SECRET-TOKEN-VALUE');},destinations:[target],transport:async()=>{throw new Error('Must not call transport');}});
  await assert.rejects(badToken.prepare(report(),'daily','actor'),error=>!error.message.includes('SECRET')&&error.message.includes('unavailable'));
});
