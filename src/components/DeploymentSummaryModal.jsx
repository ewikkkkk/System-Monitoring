import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import {taskReference} from '../task-utils.js';
import { buildDeploymentReport } from '../services/deployment-report.js';
import { isMonitoringDemo } from '../services/api.js';

export default function DeploymentSummaryModal({ date, events, onClose, plannedTasks=[] }) {
  const dialog = useRef(null), text = useRef(null);
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  const report = buildDeploymentReport(date, events, { demo: isMonitoringDemo() })+(plannedTasks.length?'\n\nPLANNED DEPLOYMENTS (target dates, not actual logs)\n'+plannedTasks.map(task=>`${taskReference(task)} · ${task.title} · ${task.status}`).join('\n'):'');
  useEffect(() => {
    const element = dialog.current;
    element.showModal(); element.querySelector('button')?.focus();
    return () => element.close();
  }, []);
  async function copy() {
    setError(''); setCopied(false);
    try { await navigator.clipboard.writeText(report); setCopied(true); }
    catch {
      const range = document.createRange(); range.selectNodeContents(text.current);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      setError('Clipboard access is unavailable. The report is selected; press Ctrl+C or copy it manually.');
    }
  }
  return <dialog ref={dialog} className="sysmon-task-dialog sysmon-summary-dialog" aria-labelledby="sysmon-summary-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="sysmon-editor-heading"><div><div className="sysmon-eyebrow">DAILY PRODUCTION REPORT</div><h2 id="sysmon-summary-title" className="sysmon-editor-title">Deployment summary</h2><p className="sysmon-popover-help">{new Intl.DateTimeFormat('en', { dateStyle:'full' }).format(new Date(date+'T12:00:00'))}</p></div><button className="sysmon-button" aria-label="Close deployment summary" onClick={onClose}><X size={16}/></button></div>
    <div className="sysmon-summary-actions"><button className="sysmon-primary" onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'Copied':'Copy report'}</button><span className="sysmon-muted" role="status">{copied?'Report copied to clipboard':''}</span></div>
    {error && <p className="sysmon-form-error" role="alert">{error}</p>}
    <pre ref={text} className="sysmon-deployment-report" aria-label="Generated deployment report" tabIndex={0}>{report}</pre>
  </dialog>;
}
