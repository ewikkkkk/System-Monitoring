import { read, utils, SSF } from 'xlsx';
import { normalizeReportInput } from '../../shared/ticket-report.js';

export function readTicketWorkbook(buffer) {
  if (buffer.byteLength>10*1024*1024)throw new Error('Choose an Excel workbook of 10 MB or less.');
  const book=read(buffer,{type:'array',cellDates:false,cellFormula:true,sheetRows:5022,cellHTML:false});
  if(!book.SheetNames.length||book.SheetNames.length>30)throw new Error('The workbook must contain between 1 and 30 worksheets.');
  return book;
}
const heading = value => String(value??'').trim().toLowerCase().replace(/\s+/g,' ');
function dueDate(cell,date1904,ticketId){
  if(!cell||cell.v==null||cell.v==='')return null;
  if(cell.f)throw new Error(`${ticketId}: due dates must be values, not formulas.`);
  let value=cell.v;
  if(typeof value==='number'){
    const date=SSF.parse_date_code(value,{date1904});if(!date)throw new Error(`${ticketId}: invalid Excel due date.`);
    const pad=number=>String(number).padStart(2,'0');value=`${date.y}-${pad(date.m)}-${pad(date.d)}T${pad(date.H)}:${pad(date.M)}:${pad(Math.floor(date.S))}`;
  }else{
    value=String(value).trim().replace(' ','T');
    if(/^\d{4}-\d{2}-\d{2}$/.test(value))value+='T00:00:00';
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))value+=':00';
  }
  return value;
}
export function ticketsFromWorksheet(book,sheetName) {
  const sheet=book.Sheets[sheetName];if(!sheet||!sheet['!ref'])throw new Error('This worksheet is empty.');
  const range=utils.decode_range(sheet['!fullref']||sheet['!ref']);
  if(range.e.r>5020||range.e.c>199)throw new Error('Import at most 5,000 rows and 200 columns.');
  const rows=utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true,range:{s:{r:0,c:0},e:range.e}});
  const headerIndex=rows.slice(0,20).findIndex(row=>row.some(value=>heading(value)==='ticket id')&&row.some(value=>heading(value)==='subject'));
  if(headerIndex<0)throw new Error('Missing Ticket ID and Subject headers in the first 20 rows.');
  const headers=rows[headerIndex].map(heading),column=name=>headers.indexOf(name),id=column('ticket id'),subject=column('subject'),status=column('status'),assigned=column('assigned to'),agent=column('agent'),due=column('due by time');
  if(status<0||(assigned<0&&agent<0))throw new Error('Required columns: Ticket ID, Subject, Status, and Assigned To or Agent.');
  const tickets=[];
  for(let r=headerIndex+1;r<rows.length;r++){
    const values=rows[r];if(values.every(value=>value==null||String(value).trim()===''))continue;
    for(const c of [id,subject,status,assigned,agent,due].filter(c=>c>=0)){if(sheet[utils.encode_cell({r,c})]?.f)throw new Error(`Row ${r+1}: report columns must contain values, not formulas.`);}
    const ticketId=String(values[id]??'').trim();
    const assignee=String(assigned>=0?values[assigned]??'':'').trim()||String(agent>=0?values[agent]??'':'').trim()||'Unassigned';
    tickets.push({ticketId,subject:String(values[subject]??''),status:String(values[status]??''),assignee,dueAt:dueDate(due>=0?sheet[utils.encode_cell({r,c:due})]:null,!!book.Workbook?.WBProps?.date1904,ticketId),url:''});
  }
  // Shared validation rejects incomplete rows and conflicting duplicate ticket IDs.
  return normalizeReportInput({reportDate:'2026-01-01',asOfTime:'00:00',timeZone:'UTC',sourceName:'validation.xlsx',sheetName,tickets}).tickets;
}
