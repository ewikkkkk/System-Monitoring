import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, RotateCcw, RefreshCw } from 'lucide-react';
import { getDeployments, logDeployment } from '../services/api.js';
import { taskReference } from '../task-utils.js';
import DeploymentSummaryModal from '../components/DeploymentSummaryModal.jsx';
import { localDayKey as dayKey } from '../services/deployment-report.js';

const localTime = date => `${dayKey(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
const timeLabel = value => new Intl.DateTimeFormat('en', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

function EventModal({ draft, setDraft, tasks, events, saving, error, onClose, onSubmit }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); dialog.current.querySelector('select')?.focus(); return () => dialog.current?.close(); }, []);
  const candidates = events.filter(event => event.action!=='Revert' && event.taskId===Number(draft.taskId) && !events.some(other=>other.revertsId===event.id));
  return <dialog ref={dialog} className="sysmon-task-dialog" aria-labelledby="sysmon-event-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
    <div className="sysmon-editor-heading"><div><div className="sysmon-eyebrow">PRODUCTION LOG</div><h2 id="sysmon-event-title" className="sysmon-editor-title">{draft.action==='Revert' ? 'Record revert' : 'Record production event'}</h2></div><button className="sysmon-button" disabled={saving} aria-label="Close production event" onClick={onClose}><X size={16}/></button></div>
    <p className="sysmon-panel-description">Record what happened in production. This log does not run deployments or rollbacks, or change task status.</p>
    <form className="sysmon-form" onSubmit={onSubmit}>
      <label className="sysmon-field">Task<select className="sysmon-input" required value={draft.taskId} onChange={event=>setDraft({...draft,taskId:event.target.value,revertsId:''})}><option value="">Choose a task</option>{tasks.map(task=><option key={task.id} value={task.id}>{taskReference(task)} · {task.title}</option>)}</select></label>
      <label className="sysmon-field">Event<select className="sysmon-input" value={draft.action} onChange={event=>setDraft({...draft,action:event.target.value,revertsId:''})}><option>Deployment</option><option>Fix</option><option>Revert</option></select></label>
      <label className="sysmon-field">Production date & time (local)<input className="sysmon-input" type="datetime-local" required value={draft.occurredAt} onChange={event=>setDraft({...draft,occurredAt:event.target.value})}/></label>
      <label className="sysmon-field">{draft.action==='Revert' ? 'Restored version / release' : 'Version / release'}<input className="sysmon-input" required maxLength={120} placeholder="Release tag or change reference" value={draft.version} onChange={event=>setDraft({...draft,version:event.target.value})}/></label>
      {draft.action==='Revert' && <label className="sysmon-field sysmon-event-wide">Original deployment / fix<select className="sysmon-input" required value={draft.revertsId} onChange={event=>setDraft({...draft,revertsId:event.target.value})}><option value="">Choose the event being reverted</option>{candidates.map(event=><option key={event.id} value={event.id}>#{event.id} · {event.version} · {timeLabel(event.occurredAt)}</option>)}</select></label>}
      <label className="sysmon-field sysmon-event-wide">{draft.action==='Revert' ? 'Reason & rollback result' : 'Deployment / fix notes'}<textarea className="sysmon-input sysmon-textarea" required maxLength={8000} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label>
      {error && <p className="sysmon-form-error" role="alert">{error}</p>}
      <div className="sysmon-form-actions"><button className="sysmon-primary" disabled={saving}>{saving?'Saving…':'Save event'}</button><button className="sysmon-button" type="button" disabled={saving} onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}

export default function CalendarView({ tasks, onOpenTask }) {
  const now = new Date();
  const [month,setMonth]=useState(new Date(now.getFullYear(),now.getMonth(),1));
  const [selected,setSelected]=useState(dayKey(now)),[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [draft,setDraft]=useState(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState('');
  const [reportDate, setReportDate] = useState(null);
  async function refresh(){setLoading(true);setError('');try{setEvents(await getDeployments());}catch(error){setError(error.message);}finally{setLoading(false);}}
  useEffect(()=>{refresh();},[]);
  // The page remains the single scroll container except while the modal is open.
  const modalHost=useRef(null);
  useEffect(()=>{const page=modalHost.current?.closest('.sysmon-page');if(draft || reportDate)page?.classList.add('sysmon-modal-open');return()=>page?.classList.remove('sysmon-modal-open');},[!!draft, !!reportDate]);
  function openEvent(original){
    setFormError('');
    const at=new Date();
    if(selected && !original) {const [year,m,d]=selected.split('-').map(Number);at.setFullYear(year,m-1,d);}
    setDraft({taskId:original?String(original.taskId):'',action:original?'Revert':'Deployment',occurredAt:localTime(at),version:'',notes:'',revertsId:original?String(original.id):''});
  }
  async function submit(event){
    event.preventDefault();setSaving(true);setFormError('');
    try{
      const occurred=new Date(draft.occurredAt);
      await logDeployment({...draft,taskId:Number(draft.taskId),revertsId:draft.action==='Revert'?Number(draft.revertsId):null,occurredAt:occurred.toISOString()});
      setMonth(new Date(occurred.getFullYear(),occurred.getMonth(),1));setSelected(dayKey(occurred));setDraft(null);await refresh();
    }catch(error){setFormError(error.message);}finally{setSaving(false);}
  }
  const monthEvents=events.filter(event=>{const date=new Date(event.occurredAt);return date.getFullYear()===month.getFullYear()&&date.getMonth()===month.getMonth();});
  const visible=monthEvents.filter(event=>!selected||dayKey(new Date(event.occurredAt))===selected);
  const first=new Date(month.getFullYear(),month.getMonth(),1), last=new Date(month.getFullYear(),month.getMonth()+1,0);
  const cells=Array.from({length:Math.ceil((first.getDay()+last.getDate())/7)*7},(_,index)=>index-first.getDay()+1);
  const reverted=new Set(events.filter(event=>event.action==='Revert').map(event=>event.revertsId));
  return <section ref={modalHost} aria-label="Production deployment calendar">
    <div className="sysmon-compact-toolbar sysmon-calendar-toolbar"><div><h1 className="sysmon-module-title">Production calendar</h1><p className="sysmon-popover-help">Deployment, fix, and revert history · Dates shown in your local time zone</p></div><div className="sysmon-tool-actions"><button className="sysmon-button" onClick={refresh} disabled={loading}><RefreshCw size={14}/>Refresh</button><button className="sysmon-primary" onClick={()=>openEvent()} disabled={loading||!!error||!tasks.length}><Plus size={14}/>Record event</button></div></div>
    {error?<p role="alert" className="sysmon-form-error">{error}</p>:loading?<p role="status" className="sysmon-muted">Loading production log…</p>:<>
      <div className="sysmon-calendar-monthbar"><div className="sysmon-tool-actions"><button className="sysmon-button" aria-label="Previous month" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()-1,1));setSelected(null);}}><ChevronLeft size={16}/></button><h2 className="sysmon-panel-title">{new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(month)}</h2><button className="sysmon-button" aria-label="Next month" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()+1,1));setSelected(null);}}><ChevronRight size={16}/></button></div><div className="sysmon-tool-actions"><span className="sysmon-muted">{monthEvents.length} events</span><button className="sysmon-button" onClick={()=>{setMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelected(dayKey(now));}}>Today</button><button className="sysmon-button" onClick={()=>setSelected(null)}>All month</button></div></div>
      <div className="sysmon-calendar-grid" aria-label="Month days">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div className="sysmon-calendar-weekday" key={day}>{day}</div>)}{cells.map((day,index)=>{
        if(day<1||day>last.getDate())return <div className="sysmon-calendar-blank" key={'blank'+index}/>;
        const key=dayKey(new Date(month.getFullYear(),month.getMonth(),day));
        const logs=monthEvents.filter(event=>dayKey(new Date(event.occurredAt))===key);
        return <button key={key} className={'sysmon-calendar-day'+(selected===key?' sysmon-calendar-day-selected':'')} aria-label={`${key}, ${logs.length} events`} aria-pressed={selected===key} aria-current={key===dayKey(now)?'date':undefined} aria-haspopup="dialog" onClick={()=>{setSelected(key);setReportDate(key);}}><span className="sysmon-calendar-day-number">{day}</span>{logs.length>0&&<span className="sysmon-calendar-day-count">{logs.length}<span className="sysmon-calendar-count-text"> {logs.length===1?'event':'events'}</span></span>}<span className="sysmon-calendar-dots">{['Deployment','Fix','Revert'].filter(action=>logs.some(event=>event.action===action)).map(action=><span key={action} className={'sysmon-dot sysmon-event-dot-'+action.toLowerCase()}/>)}</span></button>;
      })}</div>
      <div className="sysmon-calendar-legend">{['Deployment','Fix','Revert'].map(action=><span key={action}><span className={'sysmon-dot sysmon-event-dot-'+action.toLowerCase()}/>{action}</span>)}</div>
      <section className="sysmon-report-section"><h2 className="sysmon-panel-title"><CalendarDays size={16}/> {selected?new Intl.DateTimeFormat('en',{dateStyle:'long'}).format(new Date(selected+'T12:00:00')):'All events this month'} <span className="sysmon-count">{visible.length}</span></h2>
        {visible.length?visible.map(event=>{const task=tasks.find(task=>task.id===event.taskId);return <article className="sysmon-deployment-row" key={event.id}><div className="sysmon-deployment-heading"><span className={'sysmon-event-label sysmon-event-label-'+event.action.toLowerCase()}>{event.action}</span><span>{timeLabel(event.occurredAt)}</span><span className="sysmon-muted">#{event.id} · {event.version}</span></div><button className="sysmon-deployment-task" disabled={!task} onClick={()=>onOpenTask(task)}>{taskReference(event)} · {event.title}</button><p className="sysmon-helpdesk-reference">IT Help Desk: {event.reference || 'Not linked'}</p><p className="sysmon-detail-description">{event.notes}</p><div className="sysmon-deployment-footer"><span className="sysmon-muted">{event.type} · {event.system||'System not specified'} · Logged by {event.actorId} at {timeLabel(event.recordedAt)}</span>{event.action==='Revert'?<span className="sysmon-muted">Reverts event #{event.revertsId}</span>:reverted.has(event.id)?<span className="sysmon-muted">Revert recorded</span>:<button className="sysmon-button" onClick={()=>openEvent(event)}><RotateCcw size={13}/>Record revert</button>}</div></article>;}):<p className="sysmon-muted">No production events logged for this {selected?'date':'month'}. Use Record event to add one.</p>}
      </section>
    </>}
    {draft&&<EventModal draft={draft} setDraft={setDraft} tasks={tasks} events={events} saving={saving} error={formError} onClose={()=>setDraft(null)} onSubmit={submit}/>}
    {reportDate&&<DeploymentSummaryModal date={reportDate} events={events} onClose={()=>setReportDate(null)} canRecord={tasks.length>0} onRecord={()=>{setReportDate(null);openEvent();}}/>}
  </section>;
}
