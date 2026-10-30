// Local demo only. Stop the demo server before running; restart it afterwards.
// Appends labeled fixtures once and never changes existing tasks or SQL data.
import {fileURLToPath} from 'node:url';
import {copyFile} from 'node:fs/promises';
import {createDemoStore} from './store.js';
import {isCompletedStatus} from '../../shared/task-statuses.js';

const file=fileURLToPath(new URL('../../.local/monitoring-demo.json',import.meta.url));
const store=await createDemoStore(file),fixture='planning-preview-v1';
if(store.snapshot().tasks.some(task=>task.demoFixture===fixture)){
 console.log('Planning samples already exist; no data changed.');
}else{
 await copyFile(file,`${file}.before-planning-samples-${Date.now()}.bak`);
 const date=offset=>{const value=new Date();value.setHours(12,0,0,0);value.setDate(value.getDate()+offset);return value;};
 const day=offset=>{const value=date(offset);return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;};
 // title, type, workflow, system, module, dev start (days ago), target offset, tester role
 const examples=[
  ['Investigate duplicate receiving entries','Bug','OPEN','WMS','Receiving',null,null,false],
  ['Add customer shipment notifications','Enhancement','OPEN','Client Portal','Notifications',null,null,true],
  ['Fix intermittent scanner disconnect','Bug','ONGOING DEV','RF Barcoding','Device connection',-3,null,false],
  ['Recheck equipment work-order validation','Bug','BACK TO TECH (DL)','CMMS','Work orders',-6,null,true],
  ['Add inventory aging export','Enhancement','FOR TESTING (DL)','WMS','Reports',-8,6,false],
  ['Verify gate transaction rounding','Bug','ONGOING TEST (DL)','TOLL','Gate transactions',-5,6,true],
  ['Fix outbound allocation duplicates','Bug','FOR DEPLOYMENT (PL)','WMS','Outbound allocation',-11,3,false],
  ['Add purchase approval tracking','Enhancement','READY','PISA','Approvals',-9,3,false],
  ['Deploy customer delivery tracking','Enhancement','FOR DEPLOYMENT (PL)','Client Portal','Delivery tracking',-6,3,true],
  ['Monitor barcode retry improvement','Bug','PROD LIVE (HYPERCARE)','RF Barcoding','Scanning',-14,-2,false],
  ['Monitor preventive maintenance reminders','Enhancement','FOR MONITORING','CMMS','Maintenance schedule',-10,10,false],
  ['Resolve inventory report timezone','Bug','COMPLETE','WMS','Inventory reports',-16,-4,false]
 ];
 await store.update(state=>{
  let id=Math.max(0,...state.tasks.map(task=>task.id)),historyId=Math.max(0,...state.history.map(row=>row.id));
  for(const [index,[title,type,status,system,moduleName,start,target,asTester]] of examples.entries()){
   const taskId=++id,createdAt=date((start??-1)-2).toISOString(),changedAt=target!=null&&target<0?date(target).toISOString():new Date().toISOString();
   state.tasks.push({id:taskId,demoFixture:fixture,title:`[Sample] ${title}`,type,status,system,moduleName,
    reference:`DEMO-PLAN-${String(index+1).padStart(3,'0')}`,relatedTickets:[],priority:index%3===0?'High':'Normal',
    developerId:asTester?'demo-jamie':'demo-local-user',testerId:asTester?'demo-local-user':'demo-sam',
    description:'Fictional planning sample for exploring Kanban and Gantt. No real help desk ticket or production deployment is represented.',
    remarks:status==='BACK TO TECH (DL)'?'Back to tech: correct the validation message before retesting.':status==='FOR TESTING (DL)'?'Good for test: verify export totals and date filters.':status==='FOR DEPLOYMENT (PL)'?'Release package prepared; waiting for the target deployment date.':'',
    notes:'Demo sample only.',estimateHours:4+index*2,dueDate:target==null?null:day(target),targetDeploymentDate:target==null?null:day(target),
    createdBy:'demo-local-user',updatedBy:'demo-local-user',createdAt,updatedAt:changedAt,completedAt:isCompletedStatus(status)?changedAt:null});
   const event=(stage,when,notes)=>state.history.push({id:++historyId,taskId,actorId:'demo-local-user',status:stage,changedAt:when,notes});
   event('OPEN',createdAt,'Fictional sample created.');
   if(start!=null)event('ONGOING DEV',date(start).toISOString(),'Fictional development start for timeline preview.');
   if(status!=='OPEN'&&status!=='ONGOING DEV')event(status,changedAt,'Fictional workflow progress for preview.');
  }
 });
 console.log(`Added ${examples.length} labeled planning samples assigned to the local demo account. Existing records preserved; backup saved beside the demo database.`);
}
