import { withReportTicketLinks } from '../src/services/api.js';

const manila = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function zapierReportDate(now = new Date()) {
  const parts = Object.fromEntries(manila.formatToParts(now).map(({type, value}) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const messageBudget = 20_000;
const fits = html => Buffer.byteLength(JSON.stringify({body: {contentType: 'html', content: html}})) <= messageBudget;

function splitReportHtml(html) {
  if (fits(html)) return [html];

  // buildTicketReport emits a section heading, an assignee heading and list,
  // then one escaped ticket per line. Close each list before a message boundary.
  const parts = [];
  let part = '', section = '', assignee = '', listOpen = false;
  const closeList = () => {
    if (listOpen) part += '</ul>';
    listOpen = false;
  };
  for (const line of html.split('\n')) {
    if (line === '</ul>') {
      closeList();
      assignee = '';
      continue;
    }
    const item = line.startsWith('<li>');
    if (line.startsWith('<h3>')) section = line;
    if (line.endsWith('</strong></p><ul>')) {
      assignee = line;
      continue;
    }
    let block = item && !listOpen ? assignee + line : line;
    const closingTag = item ? '</ul>' : '';
    if (!fits(part + block + closingTag)) {
      closeList();
      if (part) parts.push(part);
      part = line === section ? '' : section;
      block = item ? assignee + line : line;
      if (!fits(part + block + closingTag)) throw new Error('A report section exceeds the Teams message limit.');
    }
    part += block;
    if (item) listOpen = true;
  }
  closeList();
  if (part) parts.push(part);
  return parts;
}

export function zapierReportPayload(report, date) {
  if (!report) return {ready: false, report_date: date, part_count: 0};
  const {html, totals} = withReportTicketLinks(report);
  const parts = splitReportHtml(html);
  return {
    ready: true,
    report_id: report.id,
    report_date: date,
    as_of_time: report.asOfTime,
    total_imported: totals.total,
    unfinished: totals.unfinished,
    resolved: totals.resolved,
    closed: totals.closed,
    overdue: totals.overdue,
    part_count: parts.length,
    message_html: parts.length === 1 ? parts[0] : '',
    messages_json: JSON.stringify(parts),
  };
}
