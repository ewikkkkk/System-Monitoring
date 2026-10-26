import { buildTicketReport } from '../shared/ticket-report.js';
export function prepareTicketReport(body) {
  if(!body||typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))throw new Error('A valid report request ID is required.');
  const report=buildTicketReport(body);
  if(JSON.stringify(report).length>2500000)throw new Error('The generated report is too large. Import fewer or shorter ticket rows.');
  return report;
}
export function ticketReportSummary(report) {
  const {id,reportDate,asOfTime,timeZone,sourceName,sheetName,actorId,createdAt}=report;
  return {id,reportDate,asOfTime,timeZone,sourceName,sheetName,actorId,createdAt,...report.totals};
}
