import React, { useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, History, X, TicketCheck, AlertCircle, Upload, RotateCcw } from 'lucide-react';
import { getVouchers, addVoucher, useVoucher, restoreVoucher, getVoucherHistory, getHelpDeskTicketUrl } from '../services/api.js';
import VoucherImportModal from '../components/VoucherImportModal.jsx';
import VoucherToolbar from '../components/VoucherToolbar.jsx';

const locations = ['Bancal 1', 'Bancal 2'];
const timestamp = value => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const localNow = () => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const canRestore = voucher => voucher.status === 'Invalid' && voucher.requestedLocation && voucher.requestedLocation !== voucher.location && voucher.finding.startsWith('Location mismatch:');
function HistoryDetails({ value }) {
  let details;
  try { details = JSON.parse(value || 'null'); } catch { return null; }
  if (!details) return null;
  return <div className="sysmon-muted sysmon-voucher-details">{details.ticketReference && <span>Ticket: {details.ticketReference}</span>}{details.requestedLocation && <span>Requested location: {details.requestedLocation}</span>}{details.personInvolved && <span>Person involved: {details.personInvolved}</span>}{details.client && <span>Client: {details.client}</span>}{details.device && <span>Device: {details.device}</span>}{details.durationHours != null && <span>Duration: {details.durationHours} hours</span>}{details.purpose && <span>Purpose: {details.purpose}</span>}{details.occurredAt && <span>Attempt date: {timestamp(details.occurredAt)}</span>}</div>;
}

function VoucherDialog({ mode, voucher, onClose, onSaved }) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState({ code: '', location: '', requestedLocation: voucher?.location || '', occurredAt: localNow(), ticketReference: '', personInvolved: '', client: '', device: '', purpose: '', durationHours: '', finding: '', reason: '' });
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [history, setHistory] = useState(null);
  const loadHistory = async () => { setError(''); try { setHistory(await getVoucherHistory(voucher.id)); } catch (error) { setError(error.message); } };
  useEffect(() => { dialog.current.showModal(); if (mode === 'history') loadHistory(); return () => dialog.current?.close(); }, []);
  const change = key => event => setDraft(previous => ({ ...previous, [key]: event.target.value }));
  const mismatch = ['use', 'invalid'].includes(mode) && voucher.location !== draft.requestedLocation;
  const title = { add: 'Add voucher', use: 'Use voucher', invalid: 'Record voucher finding', restore: 'Return voucher to active', history: 'Voucher history' }[mode];
  const field = (key, label, maxLength, required = false, type = 'text') => <label className="sysmon-field">{label}<input className="sysmon-input" type={type} maxLength={maxLength} required={required} value={draft[key]} onChange={change(key)} {...(type === 'number' ? { min: 0.01, max: 8760, step: 0.01 } : {})} /></label>;
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (mode === 'add') await addVoucher({ code: draft.code, location: draft.location });
      else if (mode === 'restore') await restoreVoucher(voucher.id, draft.reason);
      else await useVoucher(voucher.id, { ...draft, outcome: mode === 'invalid' ? 'Invalid' : 'Use', occurredAt: new Date(draft.occurredAt).toISOString(), durationHours: draft.durationHours === '' ? null : Number(draft.durationHours) });
      onSaved(['add', 'restore'].includes(mode) || mismatch ? 'Active' : mode === 'invalid' ? 'Invalid' : 'Used');
    } catch (error) { setError(error.message); } finally { setSaving(false); }
  }
  return <dialog ref={dialog} className="sysmon-task-dialog" aria-labelledby="sysmon-voucher-dialog-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="sysmon-editor-heading"><div><div className="sysmon-eyebrow">INFRA OPERATIONS</div><h2 id="sysmon-voucher-dialog-title" className="sysmon-editor-title">{title}</h2>{voucher && <p className="sysmon-muted">{voucher.code} · {voucher.location}</p>}</div><button className="sysmon-button" aria-label="Close voucher dialog" disabled={saving} onClick={onClose}><X size={17} /></button></div>
    {mode === 'history' ? <div>{history === null && !error && <p className="sysmon-muted">Loading history…</p>}{history?.map(item => <div className="sysmon-history-item" key={item.id}><strong>{item.action} · {item.status}</strong><span className="sysmon-muted">{timestamp(item.changedAt)} · {item.actorId}</span><p className="sysmon-note">{item.note || 'Voucher usage recorded.'}</p><HistoryDetails value={item.details}/></div>)}{error && <p role="alert" className="sysmon-form-error">{error} <button className="sysmon-button" onClick={loadHistory}>Retry</button></p>}</div> : <form className="sysmon-form" onSubmit={submit}>
      {mode === 'restore' ? <><p className="sysmon-field-help sysmon-event-wide">Return this location-mismatch voucher for use at {voucher.location}. The previous finding stays in history. Confirm the code is still usable before returning it.</p><label className="sysmon-field sysmon-event-wide">Reason<textarea className="sysmon-input" required maxLength={2000} value={draft.reason} onChange={change('reason')}/></label></> : mode === 'add' ? <>{field('code', 'Voucher code', 120, true)}<label className="sysmon-field">Location tag<select className="sysmon-input" required value={draft.location} onChange={change('location')}><option value="">Choose location</option>{locations.map(location => <option key={location}>{location}</option>)}</select></label><p className="sysmon-field-help sysmon-event-wide">The voucher will enter Active inventory, tagged for the selected location.</p></> : <>
        {field('occurredAt', 'Date & time (local)', undefined, true, 'datetime-local')}
        <label className="sysmon-field">Requested location<select className="sysmon-input" required value={draft.requestedLocation} onChange={change('requestedLocation')}>{locations.map(location => <option key={location}>{location}</option>)}</select></label>
        {mismatch && <p className="sysmon-voucher-warning sysmon-event-wide" role="status">This voucher is tagged {voucher.location}. The attempt at {draft.requestedLocation} will be logged as a location mismatch. It stays Active and can still be used at {voucher.location}.</p>}
        {field('ticketReference', 'IT Help Desk ticket reference', 80, mode === 'use')}{field('personInvolved', 'Person involved', 160, mode === 'use')}{field('client', 'Client', 160, mode === 'use')}{field('device', 'Device', 160, mode === 'use')}{field('durationHours', 'Duration (hours)', undefined, mode === 'use', 'number')}
        <label className="sysmon-field sysmon-event-wide">Purpose<textarea className="sysmon-input" maxLength={2000} required={mode === 'use'} value={draft.purpose} onChange={change('purpose')} /></label>
        <label className="sysmon-field sysmon-event-wide">Finding {mode === 'use' ? '(optional)' : ''}<textarea className="sysmon-input" maxLength={2000} required={mode === 'invalid'} value={draft.finding} onChange={change('finding')} /></label>
      </>}
      {error && <p className="sysmon-form-error" role="alert">{error}</p>}
      <div className="sysmon-form-actions"><button className="sysmon-primary" disabled={saving}>{saving ? 'Saving…' : mode === 'add' ? 'Add to active vouchers' : mode === 'restore' ? 'Return to active' : mismatch ? 'Record finding · keep active' : mode === 'invalid' ? 'Record as invalid' : 'Mark as used'}</button><button type="button" className="sysmon-button" disabled={saving} onClick={onClose}>Cancel</button></div>
    </form>}
  </dialog>;
}

export default function VoucherView() {
  const [vouchers, setVouchers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [status, setStatus] = useState('Active'), [location, setLocation] = useState(''), [search, setSearch] = useState(''), [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const host = useRef(null);
  async function refresh() { setLoading(true); setError(''); try { setVouchers(await getVouchers()); } catch (error) { setError(error.message); } finally { setLoading(false); } }
  useEffect(() => { refresh(); }, []);
  useEffect(() => { const page = host.current?.closest('.sysmon-page'); if (modal) page?.classList.add('sysmon-modal-open'); return () => page?.classList.remove('sysmon-modal-open'); }, [!!modal]);
  const shown = vouchers.filter(voucher => (status === 'All' || voucher.status === status) && (!location || voucher.location === location) && [voucher.code, voucher.ticketReference, voucher.personInvolved, voucher.client, voucher.device, voucher.purpose, voucher.finding].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  return <section ref={host} className="sysmon-vouchers" aria-label="Voucher monitoring">
    <div className="sysmon-voucher-heading"><div><h1 className="sysmon-editor-title">Voucher monitoring</h1><p className="sysmon-muted">Manage location-tagged inventory and record ticket usage or findings.</p></div><div className="sysmon-voucher-actions"><button className="sysmon-button" disabled={loading} onClick={refresh} aria-label="Refresh vouchers"><RefreshCw size={15} /></button><button className="sysmon-button" disabled={loading || !!error} onClick={() => setModal({mode:'import'})}><Upload size={15}/>Import vouchers</button><button className="sysmon-primary" onClick={() => setModal({ mode: 'add' })}><Plus size={16} /> Add voucher</button></div></div>
    {notice && <p className="sysmon-voucher-notice" role="status">{notice}</p>}
    <VoucherToolbar vouchers={vouchers} status={status} setStatus={setStatus} location={location} setLocation={setLocation} search={search} setSearch={setSearch}/>
    {error && <p className="sysmon-form-error" role="alert">{error}</p>}
    {loading ? <p className="sysmon-muted" role="status">Loading vouchers…</p> : <><table className="sysmon-voucher-table"><caption className="sysmon-sr-only">{status} vouchers · {shown.length} records</caption><thead><tr>{['Date', 'Ticket ID', 'Details', 'Person involved', 'Client', 'Voucher', 'Status', ''].map((heading, index) => <th scope="col" key={index}>{heading || <span className="sysmon-sr-only">Actions</span>}</th>)}</tr></thead><tbody>{shown.map(voucher => <tr key={voucher.id}>
      <td data-label="Date">{timestamp(voucher.occurredAt || voucher.createdAt)}</td><td data-label="Ticket ID">{voucher.ticketReference ? <a className="sysmon-ticket-link" href={getHelpDeskTicketUrl(voucher.ticketReference)} target="_blank" rel="noopener noreferrer">{voucher.ticketReference}</a> : <span className="sysmon-muted">—</span>}</td>
      <td data-label="Details" className="sysmon-voucher-detail-cell"><div className="sysmon-voucher-details"><span><span className="sysmon-muted">Location: </span>{voucher.location}</span>{voucher.requestedLocation && <span><span className="sysmon-muted">Requested: </span>{voucher.requestedLocation}</span>}{voucher.durationHours != null && <span><span className="sysmon-muted">Duration: </span>{voucher.durationHours} hours</span>}{voucher.device && <span><span className="sysmon-muted">Device: </span>{voucher.device}</span>}{voucher.purpose && <span><span className="sysmon-muted">Purpose: </span>{voucher.purpose}</span>}{voucher.finding && <span className="sysmon-voucher-finding">{voucher.finding}</span>}</div></td>
      <td data-label="Person involved">{voucher.personInvolved || '—'}</td><td data-label="Client">{voucher.client || '—'}</td><td data-label="Voucher" className="sysmon-voucher-code-cell"><strong>{voucher.code}</strong><span className="sysmon-voucher-location">{voucher.location}</span></td><td data-label="Status" className="sysmon-voucher-status-cell"><span className={`sysmon-voucher-status sysmon-voucher-status-${voucher.status.toLowerCase()}`}>{voucher.status}</span></td><td data-label="Actions" className="sysmon-voucher-action-cell"><div className="sysmon-voucher-row-actions">{voucher.status === 'Active' && <><button className="sysmon-button" aria-label={`Use voucher ${voucher.code}`} onClick={() => setModal({ mode: 'use', voucher })}><TicketCheck size={15} />Use</button><button className="sysmon-button" title="Record invalid voucher" aria-label={`Record finding for ${voucher.code}`} onClick={() => setModal({ mode: 'invalid', voucher })}><AlertCircle size={15} /></button></>}<button className="sysmon-button" title="Activity history" aria-label={`History for ${voucher.code}`} onClick={() => setModal({ mode: 'history', voucher })}><History size={15} /></button>{canRestore(voucher) && <button className="sysmon-button" aria-label={`Return ${voucher.code} to active`} title="Return location-mismatch voucher to active" onClick={() => setModal({ mode: 'restore', voucher })}><RotateCcw size={15}/></button>}</div></td>
    </tr>)}</tbody></table>{!shown.length && <div className="sysmon-empty"><p className="sysmon-empty-title">No {status === 'All' ? '' : status.toLowerCase()} vouchers</p><p>{vouchers.length ? 'Try another status, location, or search.' : 'Add a voucher and tag it Bancal 1 or Bancal 2 to get started.'}</p></div>}<p className="sysmon-muted">{shown.length} records · Used and invalid vouchers stay in the register for reference.</p></>}
    {modal?.mode === 'import' ? <VoucherImportModal vouchers={vouchers} onClose={() => setModal(null)} onSaved={result => { setModal(null); setStatus('Active'); setLocation(''); setSearch(''); setNotice(`${result.imported} vouchers imported. ${result.skipped} duplicate codes skipped.`); refresh(); }}/> : modal && <VoucherDialog {...modal} onClose={() => setModal(null)} onSaved={nextStatus => { setModal(null); setStatus(nextStatus); setNotice('Voucher saved.'); refresh(); }} />}
  </section>;
}

