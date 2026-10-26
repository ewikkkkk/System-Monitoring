// The sole outbound Microsoft Graph transport. No SDK, login flow, key store or token minting.
import https from 'node:https';
import { buildTeamsPlan } from './plan.js';

function graphRequest({path,method='GET',token,body}) {
  return new Promise((resolve,reject)=>{
    const data=body?JSON.stringify(body):null;
    const fail=message=>Object.assign(new Error(message),{ambiguous:method==='POST'});
    const request=https.request({hostname:'graph.microsoft.com',path,method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},response=>{
      let text='';response.setEncoding('utf8');
      response.on('data',chunk=>{text+=chunk;if(text.length>1000000)request.destroy(fail('Microsoft returned an oversized response. Check Teams before retrying.'));});
      response.on('error',()=>reject(fail('The Microsoft response was interrupted. Check Teams before retrying.')));
      response.on('end',()=>{
        const status=response.statusCode;
        if(status<200||status>=300){const error=new Error(status===401?'The Microsoft 365 connection expired. Ask the host to reconnect.':status===403?'The Microsoft 365 account cannot access this group or send messages.':status===429?'Microsoft is throttling requests. Wait and prepare the report again.':`Microsoft rejected the request (HTTP ${status}).`);error.ambiguous=method==='POST'&&status>=500;return reject(error);}
        try{resolve(JSON.parse(text));}catch{reject(fail('Microsoft returned an unreadable response. Check Teams before retrying.'));}
      });
    });
    request.setTimeout(20000,()=>request.destroy(fail('The Microsoft request timed out. Check Teams before retrying.')));
    request.on('error',error=>reject(Object.assign(new Error('The Microsoft connection failed. Check Teams before retrying.'),{ambiguous:error.ambiguous??method==='POST'})));
    if(data)request.write(data);request.end();
  });
}

export function createTeamsService({getAccessToken,destinations,aliases={},resolveTicketUrl,transport=graphRequest}) {
  if(typeof getAccessToken!=='function'||!Array.isArray(destinations)||!destinations.length)throw new Error('Teams requires a host token getter and an approved group destination.');
  const targets=destinations.map(target=>{
    if(!target||typeof target.id!=='string'||!target.id||target.id.length>80||typeof target.name!=='string'||!target.name||target.name.length>200||typeof target.chatId!=='string'||!target.chatId||target.chatId.length>500)throw new Error('Invalid Teams group configuration.');
    return {...target};
  });
  if(new Set(targets.map(target=>target.id)).size!==targets.length)throw new Error('Teams destination IDs must be unique.');
  const destination=id=>{const target=targets.find(target=>target.id===id);if(!target)throw new Error('Choose an approved Teams group.');return target;};
  async function tokenFor(actorId){let token;try{token=await getAccessToken(actorId);}catch{throw new Error('The host Microsoft 365 connection is unavailable.');}if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw new Error('The host Microsoft 365 connection is unavailable.');return token;}
  return {
    destinations:targets.map(({id,name})=>({id,name})),
    async prepare(report,destinationId,actorId){
      const configured=destination(destinationId),token=await tokenFor(actorId),members=[];
      const chat=await transport({path:`/v1.0/chats/${encodeURIComponent(configured.chatId)}`,token});
      if(chat.chatType!=='group')throw new Error('The configured destination is not a Microsoft Teams group chat.');
      const target={...configured,name:typeof chat.topic==='string'&&chat.topic.trim()?chat.topic.trim().slice(0,200):configured.name};
      let path=`/v1.0/chats/${encodeURIComponent(target.chatId)}/members`,pages=0;
      while(path){
        if(++pages>10)throw new Error('Too many group-member pages; no partial recipient list was used.');
        const page=await transport({path,token});if(!Array.isArray(page.value))throw new Error('Microsoft did not return a valid group-member list.');members.push(...page.value);
        if(page['@odata.nextLink']){const url=new URL(page['@odata.nextLink']);if(url.protocol!=='https:'||url.host!=='graph.microsoft.com'||!url.pathname.startsWith('/v1.0/')||url.username||url.password)throw new Error('Unexpected Microsoft paging destination.');path=url.pathname+url.search;}else path=null;
      }
      return buildTeamsPlan(report,target,members,{aliases,resolveTicketUrl});
    },
    async send(plan,destinationId,actorId){
      const target=destination(destinationId),token=await tokenFor(actorId);
      const result=await transport({path:`/v1.0/chats/${encodeURIComponent(target.chatId)}/messages`,method:'POST',token,body:plan.payload});
      if(typeof result.id!=='string'||!result.id)throw Object.assign(new Error('Microsoft did not return a delivery receipt. Check Teams before retrying.'),{ambiguous:true});
      return {messageId:result.id};
    }
  };
}
