import React, { useEffect, useRef, useState } from 'react';
import { ListFilter, CircleCheck, ChevronDown, Search, Check, X } from 'lucide-react';

export default function VoucherToolbar({vouchers,status,setStatus,location,setLocation,search,setSearch}) {
  const [panel,setPanel]=useState(null),[searchOpen,setSearchOpen]=useState(false);
  const root=useRef(null),popup=useRef(null),searchInput=useRef(null),triggers=useRef({});
  function close(focus=false){if(focus)triggers.current[panel]?.focus();setPanel(null);}
  useEffect(()=>{
    if(!panel)return;
    popup.current?.querySelector('select,[role="menuitemradio"]')?.focus();
    const outside=event=>{if(!root.current?.contains(event.target))setPanel(null);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[panel]);
  useEffect(()=>{if(searchOpen)searchInput.current?.focus();},[searchOpen]);
  const trigger=(key,label,Icon,active)=><button ref={node=>{triggers.current[key]=node;}} className={'sysmon-tool-pill'+(active?' sysmon-tool-active':'')} aria-label={`Voucher ${label.toLowerCase()}`} aria-haspopup={key==='status'?'menu':'dialog'} aria-expanded={panel===key} aria-controls={`sysmon-voucher-${key}`} title={key==='status'?`Status: ${status}`:'Filter by location'} onClick={()=>setPanel(panel===key?null:key)}><Icon size={13}/><span>{label}</span>{key==='filter'&&location&&<span className="sysmon-tool-count">1</span>}<ChevronDown size={11}/></button>;
  return <div ref={root} className="sysmon-voucher-tools" onKeyDown={event=>{if(event.key==='Escape'&&panel){event.preventDefault();close(true);}}}>
    <div className="sysmon-voucher-controls"><div className="sysmon-tool-actions">
      <div className="sysmon-tool-anchor">{trigger('filter','Filter',ListFilter,!!location)}{panel==='filter'&&<div ref={popup} className="sysmon-tool-popover" role="dialog" aria-label="Filter vouchers" id="sysmon-voucher-filter"><div className="sysmon-popover-heading">Filter vouchers<button className="sysmon-tool-icon" aria-label="Close voucher filters" onClick={()=>close(true)}><X size={14}/></button></div><label className="sysmon-field">Location<select className="sysmon-input" aria-label="Filter voucher location" value={location} onChange={event=>setLocation(event.target.value)}><option value="">All locations</option><option>Bancal 1</option><option>Bancal 2</option></select></label><div className="sysmon-popover-footer"><button className="sysmon-tool-text" onClick={()=>setLocation('')}>Reset</button><button className="sysmon-button" onClick={()=>close(true)}>Done</button></div></div>}</div>
      <div className="sysmon-tool-anchor">{trigger('status','Status',CircleCheck,status!=='Active')}{panel==='status'&&<div ref={popup} className="sysmon-tool-popover sysmon-status-menu" role="menu" aria-label="Voucher statuses" id="sysmon-voucher-status" onKeyDown={event=>{
        const items=[...event.currentTarget.querySelectorAll('[role="menuitemradio"]')],index=items.indexOf(document.activeElement);
        const next=event.key==='ArrowDown'?(index+1)%items.length:event.key==='ArrowUp'?(index+items.length-1)%items.length:event.key==='Home'?0:event.key==='End'?items.length-1:null;
        if(next!==null){event.preventDefault();items[next]?.focus();}
      }}>{['Active','Used','Invalid','All'].map(value=><button key={value} role="menuitemradio" aria-checked={value===status} className="sysmon-status-option" onClick={()=>{setStatus(value);close(true);}}><span>{value==='All'?'All statuses':value} <span className="sysmon-count">{vouchers.filter(voucher=>value==='All'||voucher.status===value).length}</span></span>{value===status&&<Check size={14}/>}</button>)}</div>}</div>
      <button className={'sysmon-tool-icon'+(search?' sysmon-tool-active':'')} aria-label="Search vouchers" title="Search vouchers" aria-expanded={searchOpen} aria-controls="sysmon-voucher-search" onClick={()=>{setSearchOpen(!searchOpen);setPanel(null);}}><Search size={15}/></button>
    </div><span className="sysmon-muted" role="status">{status==='All'?'All':status} vouchers{location?` · ${location}`:''}</span></div>
    {searchOpen&&<div className="sysmon-quick-search" id="sysmon-voucher-search"><Search size={15}/><input ref={searchInput} className="sysmon-search-input" aria-label="Search voucher text" placeholder="Voucher, ticket, person or client…" value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){setSearchOpen(false);root.current?.querySelector('[aria-label="Search vouchers"]')?.focus();}}}/><button className="sysmon-tool-icon" aria-label="Close voucher search" onClick={()=>setSearchOpen(false)}><X size={14}/></button></div>}
    {(location||status!=='Active'||search)&&<div className="sysmon-active-filters" aria-label="Active voucher filters">{[[location,'Location',()=>setLocation('')],[status!=='Active'?status:'','Status',()=>setStatus('Active')],[search,'Search',()=>setSearch('')]].filter(([value])=>value).map(([value,label,clear])=><button className="sysmon-filter-chip" key={label} aria-label={`Remove voucher ${label.toLowerCase()} filter`} onClick={clear}>{label}: {value}<X size={11}/></button>)}<button className="sysmon-tool-text" onClick={()=>{setLocation('');setStatus('Active');setSearch('');}}>Clear all</button></div>}
  </div>;
}
