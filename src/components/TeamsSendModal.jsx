import React, { useEffect, useRef, useState } from 'react';
import { Send, Users, RefreshCw, X } from 'lucide-react';
import { getReportTeamsStatus, prepareReportTeams, sendReportTeams } from '../services/api.js';

export default function TeamsSendModal({report,onClose,renderReport}) {
  const dialog=useRef(null),[context,setContext]=useState(null),[destination,setDestination]=useState(''),[plan,setPlan]=useState(null);
  const [loading,setLoading]=useState(true),[preparing,setPreparing]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
  const busy=loading||preparing||sending;
  async function load(){setLoading(true);setError('');try{const value=await getReportTeamsStatus(report.id);setContext(value);setDestination(current=>value.connection.destinations.some(item=>item.id===current)?current:value.connection.destinations[0]?.id||'');}catch(error){setError(error.message);}finally{setLoading(false);}}
  useEffect(()=>{
    const node=dialog.current,page=node.closest('.sysmon-page');page?.classList.add('sysmon-modal-open');node.showModal();load();
    return()=>{node.close();page?.classList.remove('sysmon-modal-open');};
  },[report.id]);
  async function prepare(){setPreparing(true);setPlan(null);setResult(null);setError('');try{setPlan((await prepareReportTeams(report.id,destination)).plan);}catch(error){setError(error.message);}finally{setPreparing(false);}}
  async function send(){
    if(!plan?.canSend||sending||result)return;
    setSending(true);setError('');
    try{const value=await sendReportTeams(report.id,{destinationId:destination,previewHash:plan.previewHash});setResult(value);setPlan(current=>({...current,canSend:false}));await load();}
    catch(error){setError(error.message);setPlan(null);await load();setError(error.message);}
    finally{setSending(false);}
  }
  const names=plan?[...plan.assignees.map(person=>({...person,matched:true})),...plan.unresolved.map(person=>({...person,matched:false}))]:context?.assignees||[];
  return <dialog ref={dialog} className="sysmon-task-dialog sysmon-teams-dialog" aria-labelledby="sysmon-teams-title" onCancel={event=>{event.preventDefault();if(!sending)onClose();}}>
    <div className="sysmon-editor-heading"><div><div className="sysmon-eyebrow">DAILY REPORT DELIVERY</div><h2 id="sysmon-teams-title" className="sysmon-editor-title">Send to Microsoft Teams</h2></div><button className="sysmon-button" aria-label="Close Teams delivery" onClick={onClose} disabled={sending}><X size={17}/></button></div>
    <p className="sysmon-panel-description">Report #{report.id} · {report.reportDate} at {report.asOfTime} · {report.totals.unfinished} unfinished tickets</p>
    {loading&&<p role="status" className="sysmon-muted">Loading Teams connection and delivery history…</p>}
    {context&&!context.connection.configured&&<div className="sysmon-teams-connection" role="status"><strong>Teams connection required</strong><p className="sysmon-note">{context.connection.reason}</p><p className="sysmon-report-note">Real mentions need the assignees’ Microsoft 365 identities. Names typed with @ in copied text do not create Teams notifications.</p></div>}
    {error&&<p className="sysmon-form-error" role="alert">{error}</p>}
    {result&&<p className={result.delivery?.status==='Sent'?'sysmon-teams-success':'sysmon-form-error'} role="status">{result.delivery?.status==='Sent'?`Report sent to ${result.delivery.destinationName}. Microsoft message ID: ${result.delivery.messageId}`:result.error}</p>}
    <div className="sysmon-teams-controls"><label className="sysmon-field">Destination group<select className="sysmon-input" aria-label="Teams destination group" value={destination} disabled={busy||!context?.connection.configured||!!result} onChange={event=>{setDestination(event.target.value);setPlan(null);setResult(null);setError('');}}><option value="">{context?.connection.configured?'Choose a group':'No Teams group configured'}</option>{context?.connection.destinations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button className="sysmon-button" onClick={prepare} disabled={busy||!destination||!!result}><Users size={15}/>{preparing?'Matching assignees…':'Prepare mentions'}</button><button className="sysmon-button" aria-label="Refresh Teams connection" onClick={()=>{setPlan(null);setResult(null);load();}} disabled={busy}><RefreshCw size={15}/></button>
    </div>
    <section className="sysmon-teams-assignees" aria-label="Report assignees"><h3 className="sysmon-panel-title">Assignees to mention <span className="sysmon-count">{names.length}</span></h3><p className="sysmon-report-note">Every assignee of unfinished work must match one group member. The same Microsoft 365 user is mentioned once across all status sections.</p>
      {names.map(person=><div className="sysmon-teams-assignee" key={person.name}><div><strong>{person.matched?`@${person.displayName}`:person.name}</strong>{person.matched&&person.name!==person.displayName&&<span className="sysmon-muted">Export: {person.name}</span>}<span className="sysmon-muted">{person.ticketCount} unfinished ticket{person.ticketCount===1?'':'s'}</span></div><span className={person.matched?'sysmon-teams-success':person.reason?'sysmon-form-error':'sysmon-muted'}>{person.matched?'Matched':person.reason||'Not matched yet'}</span></div>)}
    </section>
    {plan?.issues.length>0&&<ul className="sysmon-teams-issues">{plan.issues.map(issue=><li className="sysmon-form-error" key={issue}>{issue}</li>)}</ul>}
    {plan&&<section aria-label="Teams message preview" className="sysmon-teams-message-preview"><h3 className="sysmon-panel-title">Message preview · {plan.destination.name}</h3><p className="sysmon-report-note">The following report and matched mentions will be sent to this group.</p><div className="sysmon-teams-mention-chips">{[...new Map(plan.assignees.map(person=>[person.userId,person])).values()].map(person=><span className="sysmon-teams-mention" key={person.userId}>@{person.displayName}</span>)}</div>{renderReport(plan.report)}</section>}
    {context?.deliveries.length>0&&<section className="sysmon-teams-deliveries" aria-label="Teams delivery history"><h3 className="sysmon-panel-title">Delivery history</h3>{context.deliveries.map(delivery=><div className="sysmon-teams-delivery" key={delivery.id}><strong>{delivery.destinationName} · {delivery.status}</strong><span className="sysmon-muted">{new Date(delivery.completedAt||delivery.createdAt).toLocaleString()} · {delivery.actorId} · Attempt {delivery.attempts}</span>{delivery.error&&<span className="sysmon-form-error">{delivery.error}</span>}</div>)}</section>}
    <div className="sysmon-teams-send-actions"><p className="sysmon-report-note">Sending posts the report to the selected group and notifies the matched assignees. Sent or uncertain deliveries are blocked from automatic resending.</p><button className="sysmon-button" onClick={onClose} disabled={sending}>Close</button><button className="sysmon-primary" onClick={send} disabled={busy||!plan?.canSend||!!result}><Send size={15}/>{sending?'Sending report…':result?.delivery?.status==='Sent'?'Sent':`Send report${plan?` to ${plan.destination.name}`:''}`}</button></div>
  </dialog>;
}
