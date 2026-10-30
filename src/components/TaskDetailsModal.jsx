import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import TaskDetailView from '../views/TaskDetailView.jsx';
import {taskReference} from '../task-utils.js';
function DiscardEditsDialog({onKeep,onDiscard}){
 const dialog=useRef(null);
 useEffect(()=>{const node=dialog.current,trigger=document.activeElement;node.showModal();node.querySelector('[data-keep-editing]')?.focus();return()=>{node.close();if(trigger?.isConnected)trigger.focus();};},[]);
 return <dialog ref={dialog} className="sysmon-task-dialog sysmon-discard-dialog" aria-labelledby="sysmon-discard-title" aria-describedby="sysmon-discard-description" onCancel={event=>{event.preventDefault();event.stopPropagation();onKeep();}}><h2 id="sysmon-discard-title" className="sysmon-panel-title">Discard unsaved edits?</h2><p id="sysmon-discard-description" className="sysmon-muted">Your task details and comment changes have not been saved. Keep editing to continue, or discard them to close this task.</p><div className="sysmon-discard-actions"><button type="button" className="sysmon-button sysmon-discard-button" onClick={onDiscard}>Discard edits</button><button type="button" className="sysmon-primary" data-keep-editing onClick={onKeep}>Keep editing</button></div></dialog>;
}
export default function TaskDetailsModal({task,people,onClose,onSave,onRefresh,canManageDeploymentDates=false}){
 const dialog=useRef(null),outsidePress=useRef(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[confirmClose,setConfirmClose]=useState(false);
 useEffect(()=>{const node=dialog.current,trigger=document.activeElement;node.showModal();return()=>{node.close();if(trigger?.isConnected)trigger.focus();};},[]);
 function requestClose(){if(busy||confirmClose)return;if(dirty)setConfirmClose(true);else onClose();}
 function isOutside(event){const box=dialog.current.getBoundingClientRect();return event.target===dialog.current&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom);}
 return <dialog ref={dialog} className="sysmon-task-dialog sysmon-kanban-detail-dialog sysmon-split-detail-dialog" aria-label={`${taskReference(task)} task details`} onPointerDown={event=>{outsidePress.current=isOutside(event);}} onPointerCancel={()=>{outsidePress.current=false;}} onClick={event=>{const outside=outsidePress.current&&isOutside(event);outsidePress.current=false;if(outside)requestClose();}} onCancel={event=>{event.preventDefault();requestClose();}}><div className="sysmon-kanban-modal-heading"><span className="sysmon-muted">Task details</span><button className="sysmon-button" aria-label="Close task details" disabled={busy} onClick={requestClose}><X size={17}/></button></div><TaskDetailView canManageDeploymentDates={canManageDeploymentDates} task={task} people={people} onSave={onSave} onRefresh={onRefresh} onBusyChange={setBusy} onDirtyChange={setDirty}/>{confirmClose&&<DiscardEditsDialog onKeep={()=>setConfirmClose(false)} onDiscard={onClose}/>}</dialog>;
}
