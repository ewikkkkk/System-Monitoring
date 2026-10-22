import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { readVoucherPdf } from '../services/voucher-import.js';
import { importVouchers } from '../services/api.js';

export default function VoucherImportModal({ vouchers, onClose, onSaved }) {
  const dialog = useRef(null), generation = useRef(0);
  const [location, setLocation] = useState(''), [preview, setPreview] = useState(null), [name, setName] = useState('');
  const [excluded, setExcluded] = useState(new Set()), [reading, setReading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); return () => { generation.current++; dialog.current?.close(); }; }, []);
  const existing = new Set(vouchers.map(voucher => voucher.code.toLowerCase()));
  const codes = preview?.codes.filter(code => !existing.has(code.toLowerCase()) && !excluded.has(code)) || [];
  async function read(event) {
    const current = ++generation.current, file = event.target.files?.[0];
    setPreview(null); setExcluded(new Set()); setError('');
    if (!file) { setName(''); setReading(false); return; }
    setName(file.name); setReading(true);
    try { const result = await readVoucherPdf(file); if (current === generation.current) setPreview(result); }
    catch (error) { if (current === generation.current) setError(error.message); }
    finally { if (current === generation.current) setReading(false); }
  }
  async function submit(event) {
    event.preventDefault(); if (!codes.length || reading) return;
    setSaving(true); setError('');
    try { const result = await importVouchers({ location, codes }); onSaved(result); }
    catch (error) { setError(error.message); } finally { setSaving(false); }
  }
  return <dialog ref={dialog} className="sysmon-task-dialog" aria-labelledby="sysmon-import-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="sysmon-editor-heading"><div><div className="sysmon-eyebrow">INFRA OPERATIONS</div><h2 id="sysmon-import-title" className="sysmon-editor-title">Import vouchers</h2></div><button className="sysmon-button" disabled={saving} onClick={onClose} aria-label="Close voucher import"><X size={17}/></button></div>
    <form className="sysmon-form" onSubmit={submit}>
      <label className="sysmon-field">Voucher PDF<input type="file" accept=".pdf,application/pdf" className="sysmon-input" disabled={saving} onChange={read}/></label>
      <label className="sysmon-field">Location tag<select className="sysmon-input" aria-label="Import location tag" required disabled={saving} value={location} onChange={event => setLocation(event.target.value)}><option value="">Choose location</option><option>Bancal 1</option><option>Bancal 2</option></select></label>
      <p className="sysmon-field-help sysmon-event-wide">Choose the correct location explicitly; the PDF filename does not set the tag. Selected codes enter Active inventory. Printed validity and colored markings do not determine status. Uncheck codes you do not want to import.</p>
      {reading && <p className="sysmon-muted" role="status">Reading voucher sheet…</p>}
      {preview && <div className="sysmon-event-wide"><p className="sysmon-muted">{name} · {preview.pages} pages · {preview.codes.length} unique codes · {preview.duplicates} repeats removed · {preview.codes.filter(code => existing.has(code.toLowerCase())).length} already registered</p><fieldset className="sysmon-import-preview"><legend className="sysmon-muted">Review codes · {codes.length} selected</legend>{preview.codes.map(code => <label key={code} className="sysmon-import-code"><input type="checkbox" aria-label={`Import ${code}`} disabled={saving || existing.has(code.toLowerCase())} checked={!excluded.has(code) && !existing.has(code.toLowerCase())} onChange={event => setExcluded(previous => { const next = new Set(previous); if (event.target.checked) next.delete(code); else next.add(code); return next; })}/><span>{code}</span>{existing.has(code.toLowerCase()) && <span className="sysmon-muted">Already registered</span>}</label>)}</fieldset></div>}
      {error && <p role="alert" className="sysmon-form-error">{error}</p>}
      <div className="sysmon-form-actions"><button className="sysmon-primary" disabled={saving || reading || !codes.length}>{saving ? 'Importing…' : `Import ${codes.length || ''} vouchers`}</button><button type="button" className="sysmon-button" disabled={saving} onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}
