import React, { useEffect } from 'react';
import { Ticket } from 'lucide-react';

export default function HelpDeskTicketPage({ reference, darkMode = false }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `Help Desk · ${reference}`;
    return () => { document.title = previous; };
  }, [reference]);
  return <main className={'sysmon-page sysmon-helpdesk-page' + (darkMode ? ' sysmon-dark' : '')}>
    <div className="sysmon-helpdesk-placeholder">
      <div className="sysmon-eyebrow"><Ticket size={16}/>IT HELP DESK</div>
      <p className="sysmon-helpdesk-caption">Reference ticket</p>
      <h1 className="sysmon-helpdesk-number">{reference || 'No ticket number provided'}</h1>
      <p className="sysmon-muted">Help Desk connection is not configured yet.</p>
    </div>
  </main>;
}
