import {ticketStatuses, validWallTime} from '../../shared/ticket-report.js';

const customerStatuses = ['Closed', 'Resolved', 'Open', 'Waiting on Customer', 'Pending'];
const statusKey = value => value.trim().toLowerCase().replace(/\s+/g, ' ');
const drivers = [
  ['GEARS WMS', /\bgears\b/i],
  ['INFRA', /\b(?:infra|infrastructure)\b/i],
  ['GWL PISA', /\bpisa\b/i],
  ['Orca', /\borca\b/i],
  ['Client Portal', /\b(?:client\s+)?portal\b/i],
  ['WAMAS', /\bwamas\b/i],
  ['INFOR WMS', /\binfor\b/i],
  ['METS One', /\bmets[\s-]*(?:one|1)\b/i],
];
const themes = [
  ['Inbound, inventory, and transaction processing', /\b(?:inbound|inventory|transactions?|receiving|outbound|picking)\b/i],
  ['Billing, pallet quantity, and system concerns', /\b(?:billing|pallets?|quantity|system|errors?)\b/i],
  ['Email, Outlook, and network connectivity', /\b(?:e-?mail|outlook|network|connectivity|wi-?fi|internet)\b/i],
  ['Equipment, account access, and technical assistance', /\b(?:printers?|laptops?|desktop|equipment|accounts?|access|password|installation|technical)\b/i],
];

function driverFor(ticket) {
  for (const value of [ticket.product, ticket.category, ticket.module, ticket.supportType, ticket.group, ticket.subject]) {
    const match = drivers.find(([, pattern]) => pattern.test(value || ''));
    if (match) return match[0];
  }
  return 'Uncategorized';
}

function rankDrivers(tickets) {
  const grouped = new Map();
  for (const ticket of tickets) {
    const name = driverFor(ticket);
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push(ticket);
  }
  return [...grouped].map(([name, rows]) => ({
    name, count: rows.length,
    themes: themes.map(([label, pattern]) => ({label, count: rows.filter(row => pattern.test(row.subject)).length}))
      .filter(theme => theme.count > 0).sort((a, b) => b.count - a.count).slice(0, 2).map(theme => theme.label),
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const dateFormat = new Intl.DateTimeFormat('en-US', {month:'long', day:'numeric', year:'numeric', timeZone:'UTC'});
const timeFormat = new Intl.DateTimeFormat('en-US', {hour:'numeric', minute:'2-digit', timeZone:'UTC'});
const calendarDate = value => new Date(value + ':00Z');
const timestamp = value => `${dateFormat.format(calendarDate(value))}, ${timeFormat.format(calendarDate(value))}`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function buildWeeklyTicketReport(tickets, {start, end, asOf}) {
  if (![start, end, asOf].every(value => validWallTime(`${value}:00`)) || end < start || asOf < end) {
    throw new Error('Choose a valid coverage range and an as-of time on or after coverage ends.');
  }
  const created = tickets.filter(ticket => ticket.createdAt >= `${start}:00` && ticket.createdAt <= `${end}:59`);
  const customer = created.filter(ticket => !['internal ticket', 'internal'].includes(statusKey(ticket.status)));
  const statusCounts = new Map();
  for (const ticket of customer) {
    const status = ticketStatuses.find(value => statusKey(value) === statusKey(ticket.status)) || ticket.status;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  const extra = [...statusCounts.keys()].filter(status => !customerStatuses.includes(status)).sort();
  const closed = customer.filter(ticket => ['closed', 'resolved'].includes(statusKey(ticket.status)));
  const verified = closed.filter(ticket => ticket.resolvedAt && ticket.dueAt &&
    ticket.resolvedAt >= ticket.createdAt && ticket.resolvedAt <= `${asOf}:59`);
  const overdue = verified.filter(ticket => ticket.resolvedAt > ticket.dueAt).length;
  const onTime = verified.length - overdue;
  const compliance = verified.length ? `${Number((onTime / verified.length * 100).toFixed(1))}%` : 'Unavailable';
  const active = customer.filter(ticket => !['closed', 'resolved'].includes(statusKey(ticket.status)));
  const activeWithDue = active.filter(ticket => ticket.dueAt);
  const overdueActive = activeWithDue.filter(ticket => ticket.dueAt < `${asOf}:00`).length;
  const ranked = rankDrivers(customer);
  const topDrivers = ranked.filter(driver => driver.name !== 'Uncategorized').slice(0, 2);
  const otherDrivers = ranked.filter(driver => !topDrivers.includes(driver));
  const breakdown = statuses => statuses.map(status => [status, statusCounts.get(status) || 0]);
  const metrics = entries => entries.map(([label, value]) => ({type:'metric', label, value}));
  const heading = label => ({type:'heading', label});
  const note = label => ({type:'note', label});
  const sections = [
    {title:'WEEKLY TICKET SUMMARY', rows:[
      ...metrics([['Total Tickets Created', created.length], ['Customer-Facing Tickets', customer.length], ['Internal Tickets Excluded', created.length - customer.length]]),
      heading('Status Breakdown'), ...metrics(breakdown([...customerStatuses.filter(status => status !== 'Pending' || statusCounts.has(status)), ...extra])),
    ]},
    {title:'RESOLUTION SLA PERFORMANCE', rows:[
      ...metrics([['Total Closed/Resolved', closed.length], ['On-Time Resolutions', onTime],
        ['Overdue Resolutions', overdue], ['SLA Compliance', compliance]]),
      ...(closed.length > verified.length ? metrics([['SLA Unverified', closed.length - verified.length]]) : []),
      note('Overdue validation: Resolved Time > Due by Time. Compliance uses resolutions with verifiable timestamps.'),
    ]},
    {title:'TOP 2 TICKET DRIVERS', rows: topDrivers.flatMap(({name, count, themes: labels}, i) => [
      heading(`${i + 1}. ${name} — ${count} ${count === 1 ? 'Ticket' : 'Tickets'}`),
      ...labels.map(label => ({type:'bullet', label})),
    ])},
    {title:'OTHER CONTRIBUTORS', rows:metrics(otherDrivers.map(({name, count}) => [name, count]))},
    {title:'OPEN TICKET MONITORING', rows:[
      heading(`As of ${timestamp(asOf)}`), ...metrics([['Total Active Tickets', active.length],
        ...breakdown(['Open','Waiting on Customer', ...['Pending', ...extra].filter(status => statusCounts.has(status))]),
        ['Overdue Active', overdueActive], ['Within SLA', activeWithDue.length - overdueActive],
        ...(active.length > activeWithDue.length ? [['No Due Time', active.length - activeWithDue.length]] : []),
      ]),
    ]},
  ];
  const title = 'WEEKLY IT TICKET MONITORING REPORT';
  const startDate = calendarDate(start), endDate = calendarDate(end);
  const startLabel = start.slice(0, 4) === end.slice(0, 4)
    ? start.slice(0, 7) === end.slice(0, 7)
      ? dateFormat.format(startDate).split(',')[0]
      : dateFormat.format(startDate).replace(/, \d{4}$/, '')
    : dateFormat.format(startDate);
  const endLabel = start.slice(0, 7) === end.slice(0, 7)
    ? `${Number(end.slice(8, 10))}, ${end.slice(0, 4)}` : dateFormat.format(endDate);
  const subtitle = `${startLabel}–${endLabel} | METS One Ticketing System`;
  const coverage = `Reporting Coverage: ${timestamp(start)} – ${timestamp(end)} (Asia/Manila)`;
  const basis = 'Basis: Created Time';
  const caveat = 'Active counts cover tickets created in the selected period. Statuses reflect the imported export.';
  const text = [title, subtitle, '', coverage, basis, ...sections.flatMap(({title, rows}) => [
    '', title, ...(!rows.length ? ['None'] : rows.map(({type, label, value}) =>
      type === 'metric' ? `- ${label}: ${value}` : type === 'bullet' ? `- ${label}` : label)),
  ]), '', caveat].join('\n');
  const html = [`<h2>${title}</h2><p><strong>${escape(subtitle)}</strong></p><p>${escape(coverage)}<br>${basis}</p>`,
    ...sections.map(({title, rows}) => `<h3>${title}</h3>` + (rows.length ? rows.map(({type, label, value}) => {
      if (type === 'metric') return `<p>${escape(label)}: <strong>${escape(value)}</strong></p>`;
      if (type === 'heading') return `<p><strong>${escape(label)}</strong></p>`;
      return `<p>${type === 'bullet' ? '• ' : ''}${escape(label)}</p>`;
    }).join('') : '<p>None</p>')), `<p>${caveat}</p>`,
  ].join('');
  return {title, subtitle, coverage, basis, sections, caveat, text, html};
}
