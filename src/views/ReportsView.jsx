import React, {useState} from 'react';
import {CalendarDays, FileText} from 'lucide-react';
import TicketReportsView from './TicketReportsView.jsx';
import WeeklyTicketReportView from './WeeklyTicketReportView.jsx';

export default function ReportsView() {
  const [view, setView] = useState('daily');
  const [weeklyOpened, setWeeklyOpened] = useState(false);
  return <section aria-label="Ticket reports">
    <div className="sysmon-report-tabs" role="group" aria-label="Report type">
      {[['daily', 'Daily report', FileText], ['weekly', 'Weekly report', CalendarDays]].map(([key, label, Icon]) =>
        <button key={key} className={`sysmon-tool-pill${view === key ? ' sysmon-tool-active' : ''}`}
          aria-pressed={view === key} onClick={() => {
            if (key === 'weekly') setWeeklyOpened(true);
            setView(key);
          }}><Icon size={15}/>{label}</button>
      )}
    </div>
    <div hidden={view !== 'daily'}><TicketReportsView/></div>
    {weeklyOpened && <div hidden={view !== 'weekly'}><WeeklyTicketReportView/></div>}
  </section>;
}
