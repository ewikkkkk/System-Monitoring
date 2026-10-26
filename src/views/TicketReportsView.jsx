import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, RefreshCw, Copy, Save, FileText, History, Link2, Send } from 'lucide-react';
import TeamsSendModal from '../components/TeamsSendModal.jsx';
import { getTicketReports, getTicketReport, saveTicketReport, getReportTicketUrl, getReportTicketLinkTemplate } from '../services/api.js';
import { buildTicketReport, dailyTicketTotals } from '../../shared/ticket-report.js';

const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const initialOptions = () => ({reportDate:localDate(new Date()),asOfTime:new Date().toTimeString().slice(0,5),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,linkTemplate:getReportTicketLinkTemplate()});
const statusHeading = status => new Map([['Open','Open tickets'],['Pending','Pending tickets'],['Internal Ticket','Internal tickets']]).get(status)||status;

function ReportPreview({report}) {
  return <article className="sysmon-ticket-report" aria-label="Generated daily ticket report">
    <h2 className="sysmon-panel-title">DAILY TICKET MONITORING REPORT</h2>
    <p className="sysmon-panel-description">{report.text.split('\n')[1]} · {report.timeZone}</p>
    <p className="sysmon-report-note">Total imported {report.totals.total} · Unfinished {report.totals.unfinished} · Resolved {report.totals.resolved} · Closed {report.totals.closed} · Overdue {report.totals.overdue}</p>
    {report.groups.map(group=><section className="sysmon-ticket-status-section" key={group.status}>
      <h3 className="sysmon-ticket-status-title">{statusHeading(group.status)} <span className="sysmon-count">{group.count}</span></h3>
      {!group.count&&<p className="sysmon-muted">None</p>}
      {group.assignees.map(person=><div className="sysmon-ticket-assignee" key={person.assignee}>
        <h4 className="sysmon-ticket-assignee-title">{person.assignee}</h4><ul className="sysmon-ticket-lines">{person.tickets.map(ticket=><li className="sysmon-ticket-line" key={ticket.ticketId}>
          {ticket.url?<a className="sysmon-ticket-link" href={ticket.url} target="_blank" rel="noopener noreferrer">{ticket.ticketId}</a>:<strong className="sysmon-ticket-number">{ticket.ticketId}</strong>} – {ticket.subject}
          {ticket.status!=='Internal Ticket'&&<span className="sysmon-muted"> | Due: {ticket.dueAt?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${ticket.dueAt.slice(0,10)}T00:00:00Z`)):'Not supplied'}</span>}
        </li>)}</ul>
      </div>)}
      {group.status==='Pending'&&<p className="sysmon-report-note">Pending tickets are excluded from overdue calculations under the specified monitoring rules.</p>}
    </section>)}
    <p className="sysmon-report-note">Source: {report.sourceName} / {report.sheetName}. Statuses reflect the imported export. Changing the report date does not reconstruct past statuses. Overdue uses Due by Time for Open and Waiting on Customer only, interpreted in {report.timeZone}.</p>
  </article>;
}

function DailyTotals({reports,onOpen}) {
  const days=dailyTicketTotals(reports),recent=days.slice(-30),max=Math.max(1,...recent.map(day=>day.total));
  return <section className="sysmon-report-section" aria-label="Daily ticket totals">
    <div className="sysmon-report-heading"><div><h2 className="sysmon-panel-title">Daily ticket totals</h2><p className="sysmon-panel-description">Latest as-of report per saved day · Days without reports have no data · Totals are snapshots, not tickets created that day.</p></div></div>
    {recent.length>0?<>
      <div className="sysmon-daily-total-bars" role="group" aria-label="Last 30 saved reporting days">{recent.map(day=><button key={day.reportDate} className="sysmon-daily-total-day" onClick={()=>onOpen(day.id)} aria-label={`${day.reportDate}: ${day.total} imported, ${day.unfinished} unfinished tickets`}>
        <span className="sysmon-daily-total-number">{day.total}</span><span className="sysmon-daily-total-track"><span className="sysmon-daily-total-fill" style={{height:`${day.total/max*100}%`}}/><span className="sysmon-daily-total-pending" style={{height:`${day.unfinished/max*100}%`}}/></span><span className="sysmon-daily-total-label">{day.reportDate.slice(5)}</span>
      </button>)}</div><p className="sysmon-report-note">Purple: all imported tickets. Green: unfinished tickets. Select a day to open its report.</p>
      <div className="sysmon-daily-total-rows">{[...days].reverse().map(day=><button className="sysmon-daily-total-row" key={day.reportDate} onClick={()=>onOpen(day.id)}><strong>{day.reportDate}</strong><span>Total {day.total}</span><span>Unfinished {day.unfinished}</span><span>Open {day.open}</span><span>Waiting {day.waiting}</span><span>Pending {day.pending}</span><span>Internal {day.internal}</span><span>Resolved {day.resolved}</span><span>Closed {day.closed}</span></button>)}</div>
    </>:<p className="sysmon-muted">Save your first report to begin the daily record.</p>}
  </section>;
}

export default function TicketReportsView() {
  const [tab,setTab]=useState('generate'),[options,setOptions]=useState(initialOptions),[book,setBook]=useState(null),[sheet,setSheet]=useState(''),[source,setSource]=useState(''),[tickets,setTickets]=useState([]);
  const [preview,setPreview]=useState(null),[reports,setReports]=useState([]),[report,setReport]=useState(null),[historyDate,setHistoryDate]=useState('');
  const [reading,setReading]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[opening,setOpening]=useState(false),[error,setError]=useState(''),[historyError,setHistoryError]=useState(''),[copyMessage,setCopyMessage]=useState(''),[manualCopy,setManualCopy]=useState(false);
  const requestId=useRef(null),fileInput=useRef(null),openSequence=useRef(0);
  const [teamsReport,setTeamsReport]=useState(null);
  async function load(){setLoading(true);setHistoryError('');try{setReports(await getTicketReports());}catch(error){setHistoryError(error.message);}finally{setLoading(false);}}
  useEffect(()=>{load();return()=>{openSequence.current++;};},[]);
  const clearPreview=()=>{setPreview(null);requestId.current=null;setError('');setCopyMessage('');setManualCopy(false);};
  function changeOption(name,value){setOptions(current=>({...current,[name]:value}));clearPreview();}
  async function importFile(event){
    const file=event.target.files?.[0];if(!file)return;
    clearPreview();setBook(null);setTickets([]);setSource('');setReading(true);
    try{
      if(!/\.xlsx$/i.test(file.name))throw new Error('Choose an .xlsx Excel workbook.');
      if(file.size>10*1024*1024)throw new Error('Choose a workbook of 10 MB or less.');
      const {readTicketWorkbook,ticketsFromWorksheet}=await import('../services/ticket-import.js');
      const imported=readTicketWorkbook(await file.arrayBuffer()),name=imported.SheetNames.find(name=>name.toLowerCase()==='tickets')||imported.SheetNames[0];
      setBook(imported);setSheet(name);setSource(file.name);setTickets(ticketsFromWorksheet(imported,name));
    }catch(error){setError(error.message);}finally{setReading(false);event.target.value='';}
  }
  async function selectSheet(name){clearPreview();setTickets([]);setSheet(name);try{const {ticketsFromWorksheet}=await import('../services/ticket-import.js');setTickets(ticketsFromWorksheet(book,name));}catch(error){setError(error.message);}}
  function generate(){
    setError('');setCopyMessage('');setManualCopy(false);
    try{const report=buildTicketReport({...options,sourceName:source,sheetName:sheet,tickets:tickets.map(ticket=>({...ticket,url:getReportTicketUrl(ticket.ticketId,options.linkTemplate)}))});setPreview(report);requestId.current=crypto.randomUUID();}catch(error){setError(error.message);}
  }
  async function save(){
    if(!preview||preview.id||saving)return;
    setSaving(true);setError('');try{const saved=await saveTicketReport({...preview,requestId:requestId.current});setPreview(saved);await load();}catch(error){setError(error.message);}finally{setSaving(false);}
  }
  async function openReport(id){
    const sequence=++openSequence.current;setOpening(true);setHistoryError('');setCopyMessage('');setManualCopy(false);setReport(null);setTab('history');
    try{const saved=await getTicketReport(id);if(sequence===openSequence.current)setReport(saved);}catch(error){if(sequence===openSequence.current)setHistoryError(error.message);}finally{if(sequence===openSequence.current)setOpening(false);}
  }
  const displayed=tab==='generate'?preview:report;
  async function copy(){
    if(!displayed)return;setCopyMessage('');setManualCopy(false);
    try{
      if(typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write){try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([displayed.html],{type:'text/html'}),'text/plain':new Blob([displayed.text],{type:'text/plain'})})]);setCopyMessage('Formatted report copied. Paste it into the Teams message editor.');return;}catch{}}
      await navigator.clipboard.writeText(displayed.text);setCopyMessage('Plain-text report copied with ticket URLs.');
    }catch{setManualCopy(true);setCopyMessage('Clipboard access is unavailable. Select and copy the report text below.');}
  }
  const filteredReports=reports.filter(report=>!historyDate||report.reportDate===historyDate);
  return <section className="sysmon-ticket-reports-view" aria-label="Daily ticket reports">
    <div className="sysmon-report-heading"><div><h1 className="sysmon-module-title">Daily ticket reports</h1><p className="sysmon-panel-description">Import the Help Desk export, generate your Teams report, and keep a daily record.</p></div><button className="sysmon-button" aria-label="Refresh report history" onClick={load} disabled={loading||saving}><RefreshCw size={15}/></button></div>
    <div className="sysmon-report-tabs" role="group" aria-label="Report workspace"><button className={'sysmon-tool-pill'+(tab==='generate'?' sysmon-tool-active':'')} aria-pressed={tab==='generate'} onClick={()=>{setTab('generate');setCopyMessage('');setManualCopy(false);}}><FileText size={15}/>Generate report</button><button className={'sysmon-tool-pill'+(tab==='history'?' sysmon-tool-active':'')} aria-pressed={tab==='history'} onClick={()=>{setTab('history');setCopyMessage('');setManualCopy(false);}}><History size={15}/>Report history <span className="sysmon-count">{reports.length}</span></button></div>
    {tab==='generate'&&<>
      <div className="sysmon-ticket-import-section">
        <div className="sysmon-report-heading"><div><h2 className="sysmon-panel-title">1. Import ticket export</h2><p className="sysmon-panel-description">Excel (.xlsx) · Up to 10 MB / 5,000 tickets · Assigned To takes precedence over Agent.</p></div><button className="sysmon-button" onClick={()=>fileInput.current?.click()} disabled={reading||saving}><FileSpreadsheet size={16}/>{reading?'Reading workbook…':'Import Excel'}</button><input ref={fileInput} className="sysmon-file-input" type="file" accept=".xlsx" aria-label="Import ticket Excel file" onChange={importFile} disabled={reading||saving}/></div>
        {book&&<div className="sysmon-ticket-source"><span className="sysmon-muted">{source}</span><label className="sysmon-field">Worksheet<select className="sysmon-input" value={sheet} onChange={event=>selectSheet(event.target.value)} disabled={saving}>{book.SheetNames.map(name=><option key={name}>{name}</option>)}</select></label><strong role="status">{tickets.length} ticket rows ready</strong></div>}
      </div>
      <fieldset className="sysmon-ticket-options" disabled={saving||reading}><legend className="sysmon-panel-title">2. Set report details</legend>
        <label className="sysmon-field">Report date<input className="sysmon-input" type="date" value={options.reportDate} onInput={event=>changeOption('reportDate',event.currentTarget.value)} onChange={event=>changeOption('reportDate',event.target.value)}/></label>
        <label className="sysmon-field">As-of time<input className="sysmon-input" type="time" value={options.asOfTime} onInput={event=>changeOption('asOfTime',event.currentTarget.value)} onChange={event=>changeOption('asOfTime',event.target.value)}/></label>
        <label className="sysmon-field">Export time zone<select className="sysmon-input" value={options.timeZone} onChange={event=>changeOption('timeZone',event.target.value)}>{[...new Set([options.timeZone,'Asia/Manila','Asia/Taipei','UTC'])].map(zone=><option key={zone}>{zone}</option>)}</select></label>
        <label className="sysmon-field sysmon-ticket-link-template"><span><Link2 size={13}/> Help Desk ticket link template (optional)</span><input className="sysmon-input" value={options.linkTemplate} placeholder="Paste your Help Desk URL with {ticket}" onChange={event=>changeOption('linkTemplate',event.target.value)} autoComplete="off"/><span className="sysmon-report-note">Replace the ticket number in your actual URL with {'{ticket}'}. Leave blank to show ticket numbers without inventing links.</span></label>
        <p className="sysmon-report-note sysmon-ticket-options-note">This is a snapshot of the imported export. Backdating the report does not recover past statuses. Overdue applies only to Open and Waiting on Customer; Pending and Internal are excluded.</p>
        <button className="sysmon-primary" disabled={!tickets.length||reading} onClick={generate}><FileText size={16}/>Generate report</button>
      </fieldset>
      {error&&<p className="sysmon-form-error" role="alert">{error}</p>}
    </>}
    {historyError&&<p className="sysmon-form-error" role="alert">{historyError} <button className="sysmon-button" onClick={load}>Retry history</button></p>}
    {tab==='history'&&<>
      {loading?<p className="sysmon-muted" role="status">Loading saved reports…</p>:<DailyTotals reports={reports} onOpen={openReport}/>}
      <section className="sysmon-report-section"><div className="sysmon-report-heading"><div><h2 className="sysmon-panel-title">Saved report versions</h2><p className="sysmon-panel-description">Every save is retained. No previous report is overwritten.</p></div><label className="sysmon-field">Filter report date<input className="sysmon-input" type="date" value={historyDate} onChange={event=>setHistoryDate(event.target.value)}/></label>{historyDate&&<button className="sysmon-button" onClick={()=>setHistoryDate('')}>All dates</button>}</div>
        {!loading&&!filteredReports.length&&<p className="sysmon-muted">No saved reports for this selection.</p>}
        {filteredReports.map(row=><button key={row.id} className={'sysmon-ticket-history-row'+(report?.id===row.id?' sysmon-ticket-history-selected':'')} onClick={()=>openReport(row.id)} aria-label={`Open report ${row.id} for ${row.reportDate} at ${row.asOfTime}`}><strong>{row.reportDate} · {row.asOfTime}</strong><span>#{row.id} · {row.sourceName}</span><span>{row.total} imported · {row.unfinished} unfinished</span><span className="sysmon-muted">Saved {new Date(row.createdAt).toLocaleString()} · {row.actorId}</span></button>)}
      </section>
      {opening&&<p className="sysmon-muted" role="status">Opening saved report…</p>}
    </>}
    {displayed&&<>
      <div className="sysmon-ticket-report-actions"><div><strong>{displayed.id?`Saved report #${displayed.id}`:'Report preview'}</strong><p className="sysmon-report-note">{displayed.id?'This saved snapshot is read-only.':'Review the report, then save it to the daily record.'} Copy formatted text for Teams; no message is sent automatically.</p></div><button className="sysmon-button" onClick={copy}><Copy size={15}/>Copy for Teams</button>{tab==='generate'&&<button className="sysmon-primary" onClick={save} disabled={saving||!!preview.id}><Save size={15}/>{saving?'Saving…':preview.id?'Saved':'Save daily report'}</button>}</div>
      <div className="sysmon-teams-launch"><button className="sysmon-button" onClick={()=>setTeamsReport(displayed)} disabled={!displayed.id||saving}><Send size={15}/>Send to Teams</button>{!displayed.id&&<span className="sysmon-report-note">Save the daily report before sending it.</span>}</div>
      {copyMessage&&<p className="sysmon-muted" role="status">{copyMessage}</p>}
      {manualCopy&&<pre className="sysmon-ticket-manual-copy" tabIndex={0} aria-label="Report text for manual copying">{displayed.text}</pre>}
      {displayed.tickets.some(ticket=>!ticket.url)&&<p className="sysmon-report-note">Ticket links are not configured for every ticket. Add the actual Help Desk link template before generating to include clickable links.</p>}
      <ReportPreview report={displayed}/>
    </>}
    {tab==='generate'&&!preview&&!loading&&reports.length>0&&<p className="sysmon-report-note">{dailyTicketTotals(reports).length} reporting days saved · Open Report history to review daily totals and previous versions.</p>}
    {teamsReport&&<TeamsSendModal report={teamsReport} onClose={()=>setTeamsReport(null)} renderReport={report=><ReportPreview report={report}/>}/>}
  </section>;
}
