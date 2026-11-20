import {request} from 'node:https';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {dailyWorkflowPayload} from './card.mjs';
import {buildTicketReport} from './report.mjs';
import {readTicketWorkbook, ticketsFromWorksheet} from './import.mjs';

const testSend = process.argv.includes('--test');
const preview = process.argv.includes('--preview');
const now = new Date();
const date = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
const time = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(now);

function checkedUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('A configured URL is missing or invalid.'); }
  if (url.username || url.password || url.hash || url.protocol !== 'https:' ||
    !/(?:^|\.)(?:api\.powerplatform\.com|logic\.azure\.com)$/i.test(url.hostname)) {
    throw new Error('Use the Microsoft Teams Workflows webhook URL.');
  }
  return url;
}

function exchange(url, body) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Network request failed or timed out.'));
    const req = request(url, {method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
    }}, response => {
      response.resume();
      response.on('error', fail);
      response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', fail);
    req.setTimeout(20_000, () => req.destroy(new Error()));
    req.end(body);
  });
}

async function loadReport() {
  const sourceName = `METS-${date}.xlsx`;
  const input = process.argv[process.argv.indexOf('--preview') + 1];
  const file = preview ? input : join(process.env.DAILY_TEAMS_EXPORT_DIR || 'exports', sourceName);
  if (!file) throw new Error('Supply a workbook path after --preview.');
  let buffer;
  try { buffer = await readFile(file); } catch (error) {
    if (!preview && error.code === 'ENOENT') return null;
    throw new Error('The workbook could not be read.');
  }
  const workbook = readTicketWorkbook(buffer);
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'tickets');
  if (!sheetName) throw new Error('The export must contain a Tickets worksheet.');
  const tickets = ticketsFromWorksheet(workbook, sheetName).map(ticket => ({
    ...ticket, url: `https://www.mcssi.ph:3001/#/tickets/${encodeURIComponent(ticket.ticketId)}`,
  }));
  return buildTicketReport({reportDate: date, asOfTime: time, timeZone: 'Asia/Manila', sourceName, sheetName, tickets});
}

async function run() {
  if (preview) {
    const report = await loadReport();
    console.log(JSON.stringify({totals: report.totals, cards: dailyWorkflowPayload(report, date).cards.length}));
    return;
  }
  if (!testSend && time < '09:00') return;
  let file;
  if (!testSend) {
    const folder = process.env.DAILY_TEAMS_STATE_DIR;
    if (!folder) throw new Error('A delivery state directory is required.');
    await mkdir(folder, {recursive: true});
    file = join(folder, `${date}.json`);
    try {
      await access(file);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const webhook = checkedUrl(process.env.DAILY_TEAMS_WEBHOOK_URL);
  const report = testSend ? buildTicketReport({
    reportDate: date, asOfTime: time, timeZone: 'Asia/Manila', sourceName: 'Sample test', sheetName: 'Tickets',
    tickets: [{ticketId: 'DEMO-1', subject: 'Sample only · verifies automatic Teams delivery', status: 'Open', assignee: 'Sample assignee'}],
  }) : await loadReport();
  if (!report) {
    console.log(`${date}: Waiting for METS-${date}.xlsx.`);
    return;
  }
  const {cards} = dailyWorkflowPayload(report, date);
  if (!testSend) {
    // Reserve before the first POST so a restart cannot duplicate a possibly accepted message.
    try {
      await writeFile(file, JSON.stringify({status: 'Sending'}), {flag: 'wx'});
    } catch (error) {
      if (error.code === 'EEXIST') return;
      throw error;
    }
    let accepted = 0;
    try {
      accepted = await postCards(webhook, cards);
      await writeFile(file, JSON.stringify({status: 'Accepted', accepted}));
    } catch (error) {
      await writeFile(file, JSON.stringify({status: 'Check Teams', accepted: error.accepted ?? accepted}));
      throw error;
    }
    console.log(`${date}: Workflow accepted ${accepted} card(s).`);
  } else {
    const accepted = await postCards(webhook, cards);
    console.log(`Test: Workflow accepted ${accepted} sample card(s). Check the test chat for the message.`);
  }
}

async function postCards(webhook, cards) {
  let accepted = 0;
  try {
    for (const card of cards) {
      const status = await exchange(webhook, JSON.stringify(card));
      if (status < 200 || status >= 300) throw new Error(`Teams Workflow returned HTTP ${status}.`);
      accepted++;
    }
    return accepted;
  } catch (error) {
    error.accepted = accepted;
    throw error;
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
