import { createHash } from 'node:crypto';
import { buildTicketReport } from '../../shared/ticket-report.js';

const key=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const teamsTargetKey = target => createHash('sha256').update(target.chatId).digest('hex');
export function reportAssignees(report) {
  const names=new Map();
  for(const ticket of report.tickets){if(['Closed','Resolved'].includes(ticket.status))continue;const name=ticket.assignee||'Unassigned';names.set(name,(names.get(name)||0)+1);}
  return [...names].sort(([a],[b])=>a.localeCompare(b)).map(([name,ticketCount])=>({name,ticketCount}));
}
export function buildTeamsPlan(report,target,members,{aliases={},resolveTicketUrl=()=>''}={}) {
  const normalized=buildTicketReport({...report,tickets:report.tickets.map(ticket=>({...ticket,url:ticket.url||resolveTicketUrl(ticket.ticketId)}))});
  const assignees=reportAssignees(normalized),unresolved=[],matched=[],mentions=[],ids=new Map();
  for(const assignee of assignees){
    const alias=Object.hasOwn(aliases,assignee.name)?aliases[assignee.name]:null;
    const matches=members.filter(member=>member.userId&&(alias?(key(member.userId)===key(alias)||key(member.email)===key(alias)):key(member.displayName)===key(assignee.name)));
    if(assignee.name==='Unassigned'||matches.length!==1){unresolved.push({...assignee,reason:matches.length>1?'Multiple Microsoft 365 members match. Add an explicit mapping.':'No unique Microsoft 365 member matches this assignee.'});continue;}
    const member=matches[0];let id=ids.get(member.userId);
    if(id===undefined){id=mentions.length;ids.set(member.userId,id);mentions.push({id,mentionText:member.displayName,mentioned:{user:{id:member.userId,displayName:member.displayName,userIdentityType:'aadUser'}}});}
    matched.push({...assignee,displayName:member.displayName,userId:member.userId,mentionId:id});
  }
  const tags=mentions.map(mention=>`<at id="${mention.id}">${escape(mention.mentionText)}</at>`).join(', ');
  const payload={body:{contentType:'html',content:`<p>Assigned to: ${tags||'None'}</p>\n${normalized.html}`},mentions};
  const issues=[];
  if(!assignees.length)issues.push('This report has no assigned unfinished tickets to mention.');
  if(unresolved.length)issues.push('Match every assignee to one member of the destination group before sending.');
  // Stay under Microsoft's recommended 80 KB message budget, including mention metadata.
  if(Math.max(Buffer.byteLength(JSON.stringify(payload),'utf8'),JSON.stringify(payload).length*2)>80000)issues.push('This report exceeds the single-message budget. Use a smaller ticket export; no tickets will be silently omitted.');
  const previewHash=createHash('sha256').update(JSON.stringify({reportId:report.id,target:teamsTargetKey(target),label:target.name,payload})).digest('hex');
  return {report:{...normalized,id:report.id},destination:{id:target.id,name:target.name},targetKey:teamsTargetKey(target),assignees:matched,unresolved,issues,canSend:!issues.length,previewHash,payload};
}
export function publicTeamsPlan(plan){const {payload,targetKey,...view}=plan;return view;}
