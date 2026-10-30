import React,{useEffect,useRef,useState} from 'react';
import {CircleDot,CalendarDays,Users,Flag,Layers,FileText,MessageSquare,History,Save,PanelRightClose} from 'lucide-react';
import ActivityHistoryModal from '../components/ActivityHistoryModal.jsx';
import BugRecurrences from '../components/BugRecurrences.jsx';
import ConversationMessage from '../components/ConversationMessage.jsx';
import InlineTaskField from '../components/InlineTaskField.jsx';
import {getTaskComments} from '../services/api.js';
import {formatDate,taskReference,statuses} from '../task-utils.js';
import {taskSystems} from '../../shared/task-fields.js';
import {parseRelatedTickets} from '../../shared/related-tickets.js';
const editable = task=>({...task,remarks:task.remarks||'',targetDeploymentDate:task.targetDeploymentDate?.slice(0,10)||'',developerId:task.developerId||'',testerId:task.testerId||'',estimateHours:task.estimateHours??'',relatedTicketsText:(task.relatedTickets||[]).join('\n')});
const stamp=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function Property({icon:Icon,label,children}){return <div className="sysmon-detail-property"><dt className="sysmon-detail-label"><Icon size={16}/>{label}</dt><dd className="sysmon-detail-value">{children}</dd></div>;}
export default function TaskDetailView({task,people,onSave,onRefresh,onBusyChange,onDirtyChange,canManageDeploymentDates=false}){
 const [draft,setDraft]=useState(()=>editable(task)),[comments,setComments]=useState([]),[commentEdits,setCommentEdits]=useState({}),[newText,setNewText]=useState(''),[requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [saving,setSaving]=useState(false),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[commentError,setCommentError]=useState(''),[commentsLoading,setCommentsLoading]=useState(true),[historyOpen,setHistoryOpen]=useState(false);
 const [conversationOpen,setConversationOpen]=useState(true);
 const heading=useRef(null),conversationToggle=useRef(null),mounted=useRef(true);
 function toggleConversation(){setConversationOpen(current=>!current);if(conversationOpen)conversationToggle.current?.focus();}
 useEffect(()=>{heading.current?.focus();mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function loadComments(){setCommentsLoading(true);setCommentError('');try{const rows=await getTaskComments(task.id);if(mounted.current)setComments(rows);}catch(error){if(mounted.current)setCommentError(error.message);}finally{if(mounted.current)setCommentsLoading(false);}}
 useEffect(()=>{loadComments();},[task.id]);
 const set=(key,value)=>{setDraft(current=>({...current,[key]:value}));setFeedback('');};
 const changedKeys=['title','targetDeploymentDate','remarks','type','status','priority','system','moduleName','reference','description','developerId','testerId','estimateHours','relatedTicketsText'];
 const dirty=changedKeys.some(key=>String(draft[key]??'')!==String(editable(task)[key]??''))||Object.keys(commentEdits).length>0||newText.length>0;
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 const select=(key,label,options)=><select aria-label={label} className="sysmon-input sysmon-detail-select" value={draft[key]} disabled={saving} onChange={event=>set(key,event.target.value)}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>;
 const inline=(key,label,options={})=><InlineTaskField key={`${task.id}-${key}`} label={label} resetKey={task.updatedAt} value={draft[key]} disabled={saving} onChange={value=>set(key,value)} {...options}/>;
 async function save(){
  setSaving(true);onBusyChange?.(true);setFeedback('');setError('');
  try{
   const savedTask=await onSave(task.id,{...draft,estimateHours:draft.estimateHours===''?null:Number(draft.estimateHours),relatedTickets:parseRelatedTickets(draft.relatedTicketsText),commentEdits:Object.entries(commentEdits).map(([id,text])=>({id:Number(id),text})),newComment:newText.trim()?{requestId,text:newText}:null});
   if(!mounted.current)return;
   if(savedTask)setDraft(editable(savedTask));
   setCommentEdits({});setNewText('');setRequestId(crypto.randomUUID());setFeedback('Changes saved');await loadComments();
  }catch(error){if(mounted.current)setError(error.message);}finally{if(mounted.current)setSaving(false);onBusyChange?.(false);}
 }
 return <article className="sysmon-task-detail sysmon-split-task" aria-label="Task detail">
  <div className={`sysmon-task-split${conversationOpen?'':' sysmon-conversation-minimized'}`}>
  <section className="sysmon-detail-pane" aria-label="Bug and enhancement details" tabIndex={0}>
  <div className="sysmon-detail-heading"><div><span className="sysmon-task-kind"><CircleDot size={13}/>{draft.type}</span><h1 ref={heading} tabIndex={-1} className="sysmon-detail-reference">{taskReference({...task,type:draft.type})}</h1><div className="sysmon-detail-subtitle">{inline('title','Task title',{maxLength:240})}</div></div><div className="sysmon-task-actions"><button ref={conversationToggle} type="button" className={`sysmon-tool-icon sysmon-conversation-toggle${conversationOpen?' sysmon-tool-active':''}`} aria-label="Conversation" title={`Conversation${comments.length?` (${comments.length})`:''}${newText.length>0||Object.keys(commentEdits).length?' · Unsaved changes':''}`} aria-description={newText.length>0||Object.keys(commentEdits).length?'Unsaved comment changes':undefined} aria-expanded={conversationOpen} aria-controls={`sysmon-conversation-pane-${task.id}`} onClick={toggleConversation}><MessageSquare size={17}/>{(newText.length>0||Object.keys(commentEdits).length>0)&&<span className="sysmon-conversation-draft-dot" aria-hidden="true"/>}</button><button className="sysmon-history-trigger" aria-label="View activity history" title="Activity history" aria-haspopup="dialog" onClick={()=>setHistoryOpen(true)}><History size={18}/></button></div></div>
  <p className="sysmon-muted">Click text to edit. Changes and conversation updates are saved together.</p>
  <section className="sysmon-detail-section sysmon-task-remarks"><h2 className="sysmon-detail-section-title"><FileText size={16}/>Remarks</h2>{inline('remarks','Remarks',{multiline:true,previewLimit:240,maxLength:1000})}<p className="sysmon-muted">Current handoff note, e.g. Back to tech, Good for test, or Awaiting feedback.</p></section>
  <dl className="sysmon-detail-properties">
   <Property icon={CircleDot} label="Status">{select('status','Task status',statuses.map(value=>[value,value]))}</Property>
   <Property icon={Users} label="Developer">{select('developerId','Developer',[['','Unassigned'],...people.filter(person=>['developer','both'].includes(person.assignmentRole)||person.userId===draft.developerId).map(person=>[person.userId,person.displayName])])}</Property>
   <Property icon={CalendarDays} label="Target deployment">{canManageDeploymentDates?<>{inline('targetDeploymentDate','Target deployment date',{type:'date'})}<span className="sysmon-muted">Admin controlled</span></>:<span>{formatDate(task.targetDeploymentDate)} <span className="sysmon-muted">(Set by admin)</span></span>}</Property>
   <Property icon={Flag} label="Priority">{select('priority','Priority',['Low','Normal','High','Urgent'].map(value=>[value,value]))}</Property>
   <Property icon={FileText} label="Task type">{select('type','Task type',['Bug','Enhancement'].map(value=>[value,value]))}</Property>
   <Property icon={Layers} label="System">{select('system','System',[...new Set([...taskSystems,task.system])].filter(Boolean).map(value=>[value,value]))}</Property>
   <Property icon={FileText} label="Module">{inline('moduleName','Module',{maxLength:120})}</Property>
   <Property icon={FileText} label="Time estimate (hours)">{inline('estimateHours','Time estimate',{type:'number'})}</Property>
   <Property icon={Users} label="Tester">{select('testerId','Tester',[['','Unassigned'],...people.filter(person=>['tester','both'].includes(person.assignmentRole)||person.userId===draft.testerId).map(person=>[person.userId,person.displayName])])}</Property>
   <Property icon={FileText} label="Help Desk ticket">{inline('reference','Help Desk ticket',{maxLength:80})}</Property>
   <Property icon={CalendarDays} label="Created">{formatDate(task.createdAt)}</Property>
   <Property icon={CalendarDays} label="Completed">{task.completedAt?formatDate(task.completedAt):'Not completed'}</Property>
  </dl>

  <section className="sysmon-detail-section"><h2 className="sysmon-detail-section-title"><FileText size={16}/>Other related tickets</h2>{inline('relatedTicketsText','Related tickets',{multiline:true,maxLength:1700})}<p className="sysmon-muted">One ticket per line, or separate with commas.</p></section>
  <section className="sysmon-detail-section"><h2 className="sysmon-detail-section-title"><FileText size={16}/>{draft.type==='Bug'?'Bug report':'System enhancement request'}</h2>{inline('description','Description',{multiline:true,maxLength:8000})}</section>
  {task.type==='Bug'&&<BugRecurrences task={task} onRefresh={onRefresh}/>}
  </section>
  <section className="sysmon-conversation-pane" id={`sysmon-conversation-pane-${task.id}`} hidden={!conversationOpen} aria-label="Task conversation"><div className="sysmon-conversation-heading"><h2 className="sysmon-detail-section-title"><MessageSquare size={16}/>Conversation <span className="sysmon-count">{comments.length}</span></h2><button type="button" className="sysmon-tool-icon" aria-label="Minimize conversation" title="Hide conversation" aria-expanded={conversationOpen} aria-controls={`sysmon-conversation-pane-${task.id}`} onClick={toggleConversation}><PanelRightClose size={17}/></button></div>{!conversationOpen&&<p className="sysmon-muted">Conversation minimized.{newText.length>0||Object.keys(commentEdits).length?' Unsaved comment changes are kept.':''}</p>}<div className="sysmon-conversation-body" id={`sysmon-conversation-${task.id}`} hidden={!conversationOpen}>
   <div className="sysmon-conversation-scroll" role="region" aria-label="Conversation messages" tabIndex={0}>
   {task.notes&&<div className="sysmon-legacy-note"><span className="sysmon-muted">Previous progress notes · author/date unavailable</span><ConversationMessage text={task.notes} label="previous progress notes"/></div>}
   {commentsLoading?<p role="status" className="sysmon-muted">Loading conversation…</p>:commentError?<div role="alert"><p>{commentError}</p><button className="sysmon-button" onClick={loadComments}>Retry conversation</button></div>:<>
    {!comments.length&&<p className="sysmon-muted">No comments yet. Add an update below.</p>}
    <ol className="sysmon-conversation">{comments.map(comment=><li key={comment.id} className="sysmon-conversation-item"><div className="sysmon-conversation-author"><strong>{comment.authorName}</strong><span aria-hidden="true">|</span><time dateTime={comment.createdAt}>{stamp(comment.createdAt)}</time>{comment.editedAt&&<span className="sysmon-muted" title={stamp(comment.editedAt)}>edited</span>}</div>{comment.canEdit?<InlineTaskField label={`Comment ${comment.id}`} resetKey={comment.editedAt||comment.createdAt} value={commentEdits[comment.id]??comment.text} multiline previewLimit={240} maxLength={4000} disabled={saving} onChange={value=>{setCommentEdits(current=>{const next={...current};if(value===comment.text)delete next[comment.id];else next[comment.id]=value;return next;});setFeedback('');}}/>:<ConversationMessage text={comment.text} label={`comment ${comment.id}`}/>}</li>)}</ol>
   </>}
   </div>
   {!commentsLoading&&!commentError&&<div className="sysmon-conversation-composer">
    <label className="sysmon-field">Add a comment<textarea className="sysmon-input sysmon-inline-textarea" maxLength={4000} value={newText} disabled={saving} onChange={event=>{setNewText(event.target.value);setFeedback('');}} placeholder="Share an update or testing notes…"/></label><p className="sysmon-muted">Your account and the date are recorded when you save.</p>
   </div>}
   </div>
  </section>
  </div>
  <div className="sysmon-detail-save"><span className="sysmon-muted" role="status">{saving?'Saving…':feedback|| (dirty?'Unsaved changes':'No unsaved changes')}</span><button className="sysmon-primary" disabled={saving||!dirty} onClick={save}><Save size={15}/>{saving?'Saving…':'Save changes'}</button>{error&&<p className="sysmon-form-error" role="alert">{error}</p>}</div>
  {historyOpen&&<ActivityHistoryModal task={task} onClose={()=>setHistoryOpen(false)}/>}
 </article>;
}
