// Versioned, deterministic report rules shared by the browser, demo and SQL adapters.
export const ticketReportVersion = 1;
export const ticketStatuses = ['Open', 'Waiting on Customer', 'Pending', 'Internal Ticket', 'Resolved', 'Closed'];
const completed = status => ['Resolved', 'Closed'].includes(status);
const clean = value => typeof value === 'string' ? value.trim().replace(/[\r\n\t]+/g, ' ') : '';
export function validReportDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01';
}
export function validWallTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value) && validReportDate(value.slice(0,10));
}
export function safeTicketLink(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2000) throw new Error('Ticket links must be HTTP or HTTPS URLs.');
  try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch {}
  throw new Error('Ticket links must be HTTP or HTTPS URLs without credentials.');
}
export function normalizeReportInput(body) {
  if (!body || !validReportDate(body.reportDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.asOfTime || '')) throw new Error('Choose a valid report date and time.');
  try { new Intl.DateTimeFormat('en', {timeZone:body.timeZone}).format(); } catch { throw new Error('Choose a valid time zone.'); }
  if (typeof body.timeZone !== 'string' || !body.timeZone || body.timeZone.length > 80) throw new Error('A time zone is required.');
  if (!clean(body.sourceName) || clean(body.sourceName).length > 200 || !clean(body.sheetName) || clean(body.sheetName).length > 100) throw new Error('Source file and worksheet names are required.');
  if (!Array.isArray(body.tickets) || !body.tickets.length || body.tickets.length > 5000) throw new Error('Import between 1 and 5,000 ticket rows.');
  const seen = new Set();
  const tickets = body.tickets.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Ticket row ${index+1} is invalid.`);
    const ticketId=clean(row.ticketId),subject=clean(row.subject),rawStatus=clean(row.status),assignee=clean(row.assignee)||'Unassigned';
    if (!ticketId || ticketId.length>80 || !subject || subject.length>1000 || !rawStatus || rawStatus.length>80 || assignee.length>200) throw new Error(`Ticket row ${index+1}: ID, subject and status are required and must fit their limits.`);
    const key=ticketId.toUpperCase(); if(seen.has(key))throw new Error(`Duplicate ticket ID: ${ticketId}. Remove duplicate rows before importing.`); seen.add(key);
    if(row.dueAt!=null && row.dueAt!=='' && !validWallTime(row.dueAt))throw new Error(`Invalid due date for ${ticketId}.`);
    const status=ticketStatuses.find(value=>value.toLowerCase()===rawStatus.toLowerCase())||rawStatus;
    return {ticketId,subject,status,assignee,dueAt:row.dueAt||null,url:safeTicketLink(row.url)};
  });
  return {reportDate:body.reportDate,asOfTime:body.asOfTime,timeZone:body.timeZone,sourceName:clean(body.sourceName),sheetName:clean(body.sheetName),tickets};
}
const dateLabel = value => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T00:00:00Z`));
export const reportDateLabel = value => new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function buildTicketReport(body) {
  const input=normalizeReportInput(body),asOf=`${input.reportDate}T${input.asOfTime}:00`,counts=Object.create(null);
  for(const row of input.tickets)counts[row.status]=(counts[row.status]||0)+1;
  const unfinished=input.tickets.filter(row=>!completed(row.status));
  const totals={total:input.tickets.length,unfinished:unfinished.length,open:counts.Open||0,waiting:counts['Waiting on Customer']||0,pending:counts.Pending||0,internal:counts['Internal Ticket']||0,resolved:counts.Resolved||0,closed:counts.Closed||0,overdue:unfinished.filter(row=>['Open','Waiting on Customer'].includes(row.status)&&row.dueAt&&row.dueAt<asOf).length};
  const statusOrder=[...ticketStatuses.filter(status=>!completed(status)),...Object.keys(counts).filter(status=>!ticketStatuses.includes(status)).sort()];
  const groups=statusOrder.map(status=>({status,count:counts[status]||0,assignees:[...new Set(unfinished.filter(row=>row.status===status).map(row=>row.assignee))].sort((a,b)=>a.localeCompare(b)).map(assignee=>({assignee,tickets:unfinished.filter(row=>row.status===status&&row.assignee===assignee).sort((a,b)=>b.ticketId.localeCompare(a.ticketId,undefined,{numeric:true}))}))}));
  const time=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'UTC'}).format(new Date(`${asOf}Z`));
  const subtitle=`As of ${reportDateLabel(input.reportDate)} | ${time}`;
  const summary=`Total imported: ${totals.total} | Unfinished: ${totals.unfinished} | Resolved: ${totals.resolved} | Closed: ${totals.closed} | Overdue: ${totals.overdue}`;
  const text=['DAILY TICKET MONITORING REPORT',subtitle,`Time zone: ${input.timeZone}`,summary],html=['<h2>DAILY TICKET MONITORING REPORT</h2>',`<p>${escapeHtml(subtitle)}<br>Time zone: ${escapeHtml(input.timeZone)}</p>`,`<p>${escapeHtml(summary)}</p>`];
  for(const group of groups){
    const heading=(new Map([['Open','OPEN TICKETS'],['Pending','PENDING TICKETS'],['Internal Ticket','INTERNAL TICKETS']]).get(group.status)||group.status.toUpperCase())+` (${group.count})`;
    text.push('',heading);html.push(`<h3>${escapeHtml(heading)}</h3>`);
    if(!group.count){text.push('None');html.push('<p>None</p>');}
    for(const person of group.assignees){text.push(person.assignee);html.push(`<p><strong>${escapeHtml(person.assignee)}</strong></p><ul>`);
      for(const row of person.tickets){const due=group.status==='Internal Ticket'?'':` | Due: ${row.dueAt?dateLabel(row.dueAt):'Not supplied'}`;
        text.push(`- ${row.ticketId}${row.url?` (${row.url})`:''} – ${row.subject}${due}`);
        html.push(`<li>${row.url?`<a href="${escapeHtml(row.url)}">${escapeHtml(row.ticketId)}</a>`:escapeHtml(row.ticketId)} – ${escapeHtml(row.subject+due)}</li>`);
      }html.push('</ul>');
    }
    if(group.status==='Pending'){const note='Pending tickets are excluded from overdue calculations under the specified monitoring rules.';text.push(note);html.push(`<p>${note}</p>`);}
  }
  const notes=[`Source: ${input.sourceName} / ${input.sheetName}.`,`Statuses are a snapshot of the imported export; changing the report date does not reconstruct historical statuses.`,`Overdue uses Due by Time before the as-of time for Open and Waiting on Customer only. Internal tickets are excluded.`,`Ticket dates are interpreted as wall-clock times in ${input.timeZone}.`,...(unfinished.some(row=>!row.url)?['Some ticket links are not configured; ticket numbers are shown as text.']:[])];
  text.push('',...notes);html.push(...notes.map(note=>`<p>${escapeHtml(note)}</p>`));
  return {...input,version:ticketReportVersion,totals,counts,groups,text:text.join('\n'),html:html.join('\n')};
}
// One data point per saved day; latest as-of time wins, then latest saved revision.
export function dailyTicketTotals(reports) {
  const days=new Map();
  for(const report of reports){const old=days.get(report.reportDate);if(!old||report.asOfTime>old.asOfTime||(report.asOfTime===old.asOfTime&&report.id>old.id))days.set(report.reportDate,report);}
  return [...days.values()].sort((a,b)=>a.reportDate.localeCompare(b.reportDate));
}
