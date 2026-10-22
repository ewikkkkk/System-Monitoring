import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { getTaskHistory } from '../services/api.js';
import { taskReference } from '../task-utils.js';

export default function ActivityHistoryModal({ task, onClose }) {
  const dialog = useRef(null);
  const [history, setHistory] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current, page = element.closest('.sysmon-page');
    page?.classList.add('sysmon-modal-open');
    element.showModal();
    return () => { element.close(); page?.classList.remove('sysmon-modal-open'); };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getTaskHistory(task.id).then(items => { if (active) setHistory(items); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [task.id, task.updatedAt, retry]);
  return <dialog ref={dialog} className="sysmon-task-dialog sysmon-history-dialog" aria-labelledby="sysmon-history-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="sysmon-history-modal-heading"><div><h2 id="sysmon-history-title" className="sysmon-editor-title">Activity history</h2><p className="sysmon-popover-help">{taskReference(task)}</p></div><button className="sysmon-tool-icon" aria-label="Close activity history" onClick={onClose}><X size={16}/></button></div>
    {loading ? <p className="sysmon-muted" role="status">Loading activity…</p> : error ? <div><p className="sysmon-form-error" role="alert">{error}</p><button className="sysmon-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={13}/>Retry</button></div> : history.length ? <ol className="sysmon-history-log">{history.map(item => <li className="sysmon-history-entry" key={item.id}><div className="sysmon-history-entry-heading"><strong className="sysmon-history-status">{item.status}</strong><time className="sysmon-muted" dateTime={item.changedAt}>{new Intl.DateTimeFormat('en', {dateStyle:'medium',timeStyle:'short'}).format(new Date(item.changedAt))}</time></div><span className="sysmon-history-actor">{item.actorId}</span><p className="sysmon-history-note">{item.notes || 'Task details saved.'}</p></li>)}</ol> : <p className="sysmon-muted">No activity recorded.</p>}
  </dialog>;
}
