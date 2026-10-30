import React,{useState} from 'react';
export default function ConversationMessage({text,label}){
 const [expanded,setExpanded]=useState(false),long=text.length>240;
 return <><p className="sysmon-conversation-text">{long&&!expanded?`${text.slice(0,240)}…`:text}</p>{long&&<button type="button" className="sysmon-conversation-expand" aria-label={`${expanded?'Show less':'Show more'} ${label}`} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Show less':'Show more'}</button>}</>;
}
