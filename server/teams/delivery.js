import { publicTeamsPlan, reportAssignees } from './plan.js';
export function teamsConnection(service){return {configured:!!service,destinations:service?.destinations||[],reason:service?'':'Teams is not connected. The host must supply an approved group and a delegated Microsoft 365 connection.'};}
export async function teamsStatus(report,service,repository){return {connection:teamsConnection(service),assignees:reportAssignees(report),deliveries:await repository.list(report.id)};}
export async function prepareTeamsReport(report,service,destinationId,actorId){
  if(!service)return {status:503,error:teamsConnection(service).reason};
  try{return {status:200,plan:publicTeamsPlan(await service.prepare(report,destinationId,actorId))};}catch(error){return {status:400,error:error.message};}
}
export async function sendTeamsReport({report,service,repository,destinationId,previewHash,actorId}){
  if(!service)return {status:503,error:teamsConnection(service).reason};
  let plan;try{plan=await service.prepare(report,destinationId,actorId);}catch(error){return {status:400,error:error.message};}
  if(!plan.canSend)return {status:400,error:plan.issues.join(' ')};
  if(typeof previewHash!=='string'||plan.previewHash!==previewHash)return {status:409,error:'The report or recipients changed. Prepare a fresh preview before sending.'};
  const reservation=await repository.reserve({reportId:report.id,destinationKey:plan.targetKey,destinationName:plan.destination.name,previewHash,actorId});
  if(!reservation.acquired)return {status:409,error:reservation.delivery.status==='Sent'?'This report has already been sent to this group.':'Delivery is in progress or its result is uncertain. Check the group before trying again.',delivery:reservation.delivery};
  let receipt;
  try{receipt=await service.send(plan,destinationId,actorId);}catch(error){
    const status=error.ambiguous?'Unknown':'Failed';
    try{await repository.finish(reservation.delivery.id,{status,error:error.message,messageId:null});}catch{return {status:502,error:'Delivery could not be verified or recorded. Check Teams before retrying.'};}
    return {status:502,error:error.message,deliveryStatus:status};
  }
  try{const delivery=await repository.finish(reservation.delivery.id,{status:'Sent',messageId:receipt.messageId,error:''});return {status:201,delivery};}
  catch{return {status:202,error:'Microsoft accepted the report, but the delivery log could not be updated. Check Teams; do not send it again automatically.',deliveryStatus:'Unknown'};}
}
