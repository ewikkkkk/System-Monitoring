import React, {useRef, useState} from 'react';
import {Copy, FileSpreadsheet, FileText} from 'lucide-react';
import {buildWeeklyTicketReport} from '../services/weekly-ticket-report.js';

function initialCoverage() {
  const manila = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23',
  });
  const {year, month, day, hour, minute} = Object.fromEntries(
    manila.formatToParts(new Date()).map(({type, value}) => [type, value]),
  );
  const today = `${year}-${month}-${day}`;
  const current = new Date(`${today}T00:00:00Z`);
  // METS reporting week closes on Friday at 08:00 Manila time.
  const daysSinceFriday = (current.getUTCDay() + 2) % 7 || (hour < '08' ? 7 : 0);
  current.setUTCDate(current.getUTCDate() - daysSinceFriday);
  const end = current.toISOString().slice(0, 10) + 'T07:59';
  current.setUTCDate(current.getUTCDate() - 7);
  return {start:current.toISOString().slice(0, 10) + 'T08:00', end, asOf:`${today}T${hour}:${minute}`};
}

export default function WeeklyTicketReportView() {
  const fileInput = useRef(null);
  const [coverage, setCoverage] = useState(initialCoverage);
  const [workbook, setWorkbook] = useState(null);
  const [sheet, setSheet] = useState('');
  const [source, setSource] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [manualCopy, setManualCopy] = useState(false);

  function resetPreview() {
    setReport(null);
    setError('');
    setCopyMessage('');
    setManualCopy(false);
  }

  async function importWorkbook(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    resetPreview();
    setWorkbook(null);
    setReading(true);
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose an .xlsx Excel workbook.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a workbook of 10 MB or less.');
      const {readTicketWorkbook} = await import('../services/ticket-import.js');
      const book = readTicketWorkbook(await file.arrayBuffer());
      setSheet(book.SheetNames.find(name => name.toLowerCase() === 'tickets') || book.SheetNames[0]);
      setSource(file.name);
      setWorkbook(book);
    } catch (error) {
      setError(error.message);
    } finally {
      setReading(false);
    }
  }

  async function generate(event) {
    event.preventDefault();
    resetPreview();
    setReading(true);
    try {
      const {weeklyTicketsFromWorksheet} = await import('../services/ticket-import.js');
      setReport(buildWeeklyTicketReport(weeklyTicketsFromWorksheet(workbook, sheet), coverage));
    } catch (error) {
      setError(error.message);
    } finally {
      setReading(false);
    }
  }

  async function copy() {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([report.html], {type:'text/html'}),
            'text/plain': new Blob([report.text], {type:'text/plain'}),
          })]);
          setCopyMessage('Formatted report copied for Teams.');
          return;
        } catch {}
      }
      await navigator.clipboard.writeText(report.text);
      setCopyMessage('Plain-text report copied.');
    } catch {
      setManualCopy(true);
      setCopyMessage('Select and copy the report text.');
    }
  }

  return <section className="sysmon-ticket-reports-view" aria-label="Weekly ticket report">
    <h1 className="sysmon-module-title">Weekly ticket report</h1>
    <p className="sysmon-panel-description">Import an all-status METS export. Dates and times use Asia/Manila.</p>
    <form onSubmit={generate}>
      <fieldset className="sysmon-ticket-options sysmon-weekly-options" disabled={reading}>
        <legend className="sysmon-panel-title">Report source and coverage</legend>
        <button type="button" className="sysmon-button sysmon-weekly-import" onClick={() => fileInput.current?.click()}>
          <FileSpreadsheet size={16}/>{reading ? 'Working…' : 'Import Excel'}
        </button>
        <input hidden ref={fileInput} type="file" accept=".xlsx" aria-label="Import weekly ticket Excel file" onChange={importWorkbook}/>
        {workbook && <label className="sysmon-field">Worksheet · {source}
          <select className="sysmon-input" value={sheet} onChange={event => {setSheet(event.target.value); resetPreview();}}>
            {workbook.SheetNames.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>}
        {[['start', 'Coverage start'], ['end', 'Coverage end'], ['asOf', 'Active tickets as of']].map(([key, label]) =>
          <label className="sysmon-field" key={key}>{label}
            <input className="sysmon-input" type="datetime-local" required value={coverage[key]}
              onChange={event => {setCoverage({...coverage, [key]:event.target.value}); resetPreview();}}/>
          </label>
        )}
        <p className="sysmon-report-note sysmon-ticket-options-note">Use the export’s snapshot time for the as-of field. Statuses come from the file, and ticket drivers are grouped by product or keywords in the exported fields.</p>
        <button className="sysmon-primary" disabled={!workbook || reading}><FileText size={16}/>Generate weekly report</button>
      </fieldset>
    </form>
    {error && <p className="sysmon-form-error" role="alert">{error}</p>}
    {report && <>
      <div className="sysmon-ticket-report-actions">
        <strong>Report preview</strong>
        <button className="sysmon-button" onClick={copy}><Copy size={15}/>Copy for Teams</button>
      </div>
      {copyMessage && <p className="sysmon-muted" role="status">{copyMessage}</p>}
      {manualCopy && <pre className="sysmon-ticket-manual-copy" tabIndex={0}>{report.text}</pre>}
      <article className="sysmon-ticket-report sysmon-weekly-report" aria-label="Generated weekly ticket report">
        <h2 className="sysmon-panel-title">{report.title}</h2>
        <p className="sysmon-panel-description">{report.subtitle}</p>
        <p>{report.coverage}<br/>{report.basis}</p>
        {report.sections.map(({title, rows}) => <section className="sysmon-ticket-status-section" key={title}>
          <h3 className="sysmon-ticket-status-title">{title}</h3>
          {!rows.length && <p>None</p>}
          {rows.map(({type, label, value}) => {
            if (type === 'heading') return <h4 className="sysmon-weekly-subheading" key={label}>{label}</h4>;
            return <p key={label} className={type === 'note' ? 'sysmon-report-note' : undefined}>
              {type === 'bullet' && '• '}{label}{type === 'metric' && <>: <strong>{value}</strong></>}
            </p>;
          })}
        </section>)}
        <p className="sysmon-report-note">{report.caveat}</p>
      </article>
    </>}
  </section>;
}
