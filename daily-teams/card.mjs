const markdown = value => String(value).replace(/[\\`*_{}\[\]<>#]/g, '\\$&');
const textBlock = (text, extra = {}) => ({type: 'TextBlock', text, wrap: true, ...extra});
const envelope = body => ({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    contentUrl: null,
    content: {$schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.2', body},
  }],
});
const fits = card => Buffer.byteLength(JSON.stringify(card)) <= 20_000;

export function dailyWorkflowPayload(savedReport, date) {
  if (!savedReport) return {ready: false, report_date: date};
  const report = savedReport;
  const subtitle = report.text.split('\n')[1];
  const title = textBlock('DAILY TICKET MONITORING REPORT', {size: 'Medium', weight: 'Bolder'});
  const header = [title, textBlock(subtitle)];
  const cards = [];
  let body = [...header];

  function add(block, context = []) {
    if (!fits(envelope([...body, block]))) {
      cards.push(envelope(body));
      body = [title, textBlock(`${subtitle} · Continued`), ...context];
      if (!fits(envelope([...body, block]))) throw new Error('A ticket exceeds the Teams card size limit.');
    }
    body.push(block);
  }

  for (const group of report.groups) {
    const status = textBlock(`${markdown(ticketStatusHeading(group.status))} (${group.count})`, {weight: 'Bolder', separator: true});
    add(status);
    if (!group.count) add(textBlock('None'), [status]);
    for (const person of group.assignees) {
      const assignee = textBlock(markdown(person.assignee), {weight: 'Bolder'});
      add(assignee, [status]);
      for (const ticket of person.tickets) {
        const id = markdown(ticket.ticketId);
        const url = ticket.url?.replaceAll('(', '%28').replaceAll(')', '%29');
        const label = url ? `[${id}](${url})` : id;
        const due = group.status === 'Internal Ticket' ? '' : ` | Due: ${ticketDueDateLabel(ticket.dueAt)}`;
        add(textBlock(`${label} – ${markdown(ticket.subject)}${due}`, {spacing: 'Small'}), [status, assignee]);
      }
    }
    if (group.status === 'Pending') add(textBlock(pendingTicketNote), [status]);
  }
  for (const [index, note] of report.notes.entries()) {
    add(textBlock(markdown(note), {isSubtle: true, separator: index === 0}));
  }
  cards.push(envelope(body));
  return {ready: true, report_date: date, report_id: report.id, cards};
}
import {pendingTicketNote, ticketDueDateLabel, ticketStatusHeading} from './report.mjs';

