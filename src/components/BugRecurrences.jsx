import React, { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { getBugOccurrences, getDeployments, logBugOccurrence, getHelpDeskTicketUrl } from '../services/api.js';
import { isComplete } from '../task-utils.js';

const localTime = () => {const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,-1);};
const labelTime = value => new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function RecurrenceModal({task,deployments,onClose,onSaved}) {
  const dialog=useRef(null);
  const [draft,setDraft]=useState({occurredAt:localTime(),reference:'',notes:'',deploymentId:'',reopen:isComplete(task)}),[saving,setSaving]=useState(false),[error,setError]=useState('');
  useEffect(()=>{dialog.current.showModal();return()=>dialog.current?.close();},[]);
  const change=key=>event=>setDraft({...draft,[key]:event.target.value});
  const events=deployments.filter(event=>Date.parse(event.occurredAt)<=Date.parse(draft.occurredAt));
  async function submit(event){event.preventDefault();setSaving(true);setError('');try{await logBugOccurrence(task.id,{...draft,occurredAt:new Date(draft.occurredAt).toISOString(),deploymentId:draft.deploymentId?Number(draft.deploymentId):null});onSaved();}catch(error){setError(error.message);}finally{setSaving(false);}}
  return <dialog ref={dialog} className="sysmon-task-dialog" aria-labelledby="sysmon-recurrence-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
    <div className="sysmon-editor-heading"><h2 className="sysmon-editor-title" id="sysmon-recurrence-title">Report bug recurrence</h2><button className="sysmon-button" aria-label="Close recurrence report" disabled={saving} onClick={onClose}><X size={17}/></button></div>
    <p className="sysmon-panel-description">Record a new occurrence of this same bug. This adds one report to the daily graph; related-ticket links alone do not affect counts.</p>
    <form className="sysmon-form" onSubmit={submit}>
      <label className="sysmon-field">Occurrence date & time (local)<input className="sysmon-input" type="datetime-local" step="0.001" required value={draft.occurredAt} onChange={change('occurredAt')}/></label>
      <label className="sysmon-field">Recurrence ticket reference<input className="sysmon-input" maxLength={80} value={draft.reference} onChange={change('reference')} placeholder="Help Desk reference (optional)"/></label>
      <label className="sysmon-field sysmon-event-wide">Related production event (optional)<select className="sysmon-input" value={draft.deploymentId} onChange={change('deploymentId')}><option value="">No event linked</option>{events.map(event=><option key={event.id} value={event.id}>{event.action} · {event.version} · {event.system||'Unspecified'} · {labelTime(event.occurredAt)}</option>)}</select><span className="sysmon-field-help">An explicit reference for investigation; it does not prove deployment causality.</span></label>
      <label className="sysmon-field sysmon-event-wide">Findings / recurrence details<textarea className="sysmon-input sysmon-textarea" required maxLength={4000} value={draft.notes} onChange={change('notes')}/></label>
      {isComplete(task)&&<label className="sysmon-recurrence-check sysmon-event-wide"><input type="checkbox" checked={draft.reopen} onChange={event=>setDraft({...draft,reopen:event.target.checked})}/>Reopen this concern as Open</label>}
      {error&&<p className="sysmon-form-error" role="alert">{error}</p>}
      <div className="sysmon-form-actions"><button className="sysmon-primary" disabled={saving}>{saving?'Saving…':'Save recurrence'}</button><button className="sysmon-button" type="button" disabled={saving} onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}

export default function BugRecurrences({task,onRefresh}) {
  const [entries,setEntries]=useState([]),[deployments,setDeployments]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[open,setOpen]=useState(false);
  const host=useRef(null);
  async function load(){setLoading(true);setError('');try{const [entries,deployments]=await Promise.all([getBugOccurrences(),getDeployments()]);setEntries(entries.filter(event=>event.taskId===task.id));setDeployments(deployments);}catch(error){setError(error.message);}finally{setLoading(false);}}
  useEffect(()=>{load();setOpen(false);},[task.id]);
  useEffect(()=>{const page=host.current?.closest('.sysmon-page');if(open)page?.classList.add('sysmon-modal-open');return()=>page?.classList.remove('sysmon-modal-open');},[open]);
  return <section ref={host} className="sysmon-detail-section"><div className="sysmon-report-heading"><h2 className="sysmon-detail-section-title"><RotateCcw size={16}/> Bug recurrences <span className="sysmon-count">{entries.length}</span></h2><button className="sysmon-button" disabled={loading||!!error} onClick={()=>setOpen(true)}><Plus size={14}/>Report recurrence</button></div>
    {loading?<p className="sysmon-muted">Loading recurrences…</p>:error?<p role="alert" className="sysmon-form-error">{error} <button className="sysmon-button" onClick={load}>Retry</button></p>:entries.length?entries.map(entry=><div className="sysmon-history-item" key={entry.id}><div className="sysmon-trend-day-heading"><strong>{labelTime(entry.occurredAt)}</strong>{entry.reference&&<a className="sysmon-ticket-link" target="_blank" rel="noopener noreferrer" href={getHelpDeskTicketUrl(entry.reference)}>{entry.reference}</a>}</div><p className="sysmon-note">{entry.notes}</p><span className="sysmon-muted">Recorded by {entry.actorId}{entry.deploymentId?` · Linked production event #${entry.deploymentId}`:''}</span></div>):<p className="sysmon-muted">No recurrences recorded. The initial task creation is counted separately in the graph.</p>}
    {open&&<RecurrenceModal task={task} deployments={deployments} onClose={()=>setOpen(false)} onSaved={()=>{setOpen(false);load();onRefresh?.();}}/>}
  </section>;
}
