import { query, sql } from '../db/pool.js';
export const sqlTeamsRepository={
  async list(reportId){return (await query('SELECT id,reportId,destinationName,status,messageId,error,actorId,createdAt,completedAt,attempts FROM monitoring.TeamsDeliveries WHERE reportId=@reportId ORDER BY id DESC',{reportId:{type:sql.Int,value:reportId}})).recordset;},
  async reserve({reportId,destinationKey,destinationName,previewHash,actorId}){
    const result=await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      DECLARE @id int,@status nvarchar(12),@acquired bit=0;
      SELECT @id=id,@status=status FROM monitoring.TeamsDeliveries WITH(UPDLOCK,HOLDLOCK) WHERE reportId=@reportId AND destinationKey=@destinationKey;
      IF @id IS NULL BEGIN
        INSERT monitoring.TeamsDeliveries(reportId,destinationKey,destinationName,previewHash,actorId,status) VALUES(@reportId,@destinationKey,@name,@hash,@actor,'Sending');SET @id=SCOPE_IDENTITY();SET @acquired=1;
      END ELSE IF @status='Failed' BEGIN
        UPDATE monitoring.TeamsDeliveries SET status='Sending',actorId=@actor,previewHash=@hash,error='',completedAt=NULL,attempts=attempts+1 WHERE id=@id;SET @acquired=1;
      END;
      COMMIT; SELECT @acquired AS acquired,id,reportId,destinationName,status,messageId,error,actorId,createdAt,completedAt,attempts FROM monitoring.TeamsDeliveries WHERE id=@id;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{reportId:{type:sql.Int,value:reportId},destinationKey:{type:sql.Char(64),value:destinationKey},name:{type:sql.NVarChar(200),value:destinationName},hash:{type:sql.Char(64),value:previewHash},actor:{type:sql.NVarChar(128),value:actorId}});
    const {acquired,...delivery}=result.recordset[0];return {acquired:!!acquired,delivery};
  },
  async finish(id,{status,messageId,error}){const row=(await query(`UPDATE monitoring.TeamsDeliveries SET status=@status,messageId=@message,error=@error,completedAt=SYSUTCDATETIME()
    OUTPUT INSERTED.id,INSERTED.reportId,INSERTED.destinationName,INSERTED.status,INSERTED.messageId,INSERTED.error,INSERTED.actorId,INSERTED.createdAt,INSERTED.completedAt,INSERTED.attempts WHERE id=@id AND status='Sending'`,{id:{type:sql.Int,value:id},status:{type:sql.NVarChar(12),value:status},message:{type:sql.NVarChar(200),value:messageId},error:{type:sql.NVarChar(1000),value:error.slice(0,1000)}})).recordset[0];if(!row)throw new Error('Delivery reservation missing');return row;}
};
export function createDemoTeamsRepository(store){return {
  async list(reportId){return (store.snapshot().teamsDeliveries||[]).filter(row=>row.reportId===reportId).sort((a,b)=>b.id-a.id);},
  async reserve(input){return store.update(state=>{
    state.teamsDeliveries||=[];let row=state.teamsDeliveries.find(row=>row.reportId===input.reportId&&row.destinationKey===input.destinationKey);
    if(row&&row.status!=='Failed')return {acquired:false,delivery:row};
    if(row)Object.assign(row,{status:'Sending',actorId:input.actorId,previewHash:input.previewHash,error:'',completedAt:null,attempts:row.attempts+1});
    else{row={...input,id:Math.max(0,...state.teamsDeliveries.map(row=>row.id))+1,status:'Sending',messageId:null,error:'',createdAt:new Date().toISOString(),completedAt:null,attempts:1};state.teamsDeliveries.push(row);}
    return {acquired:true,delivery:row};
  });},
  async finish(id,result){return store.update(state=>{const row=state.teamsDeliveries.find(row=>row.id===id&&row.status==='Sending');if(!row)throw new Error('Delivery reservation missing');Object.assign(row,result,{completedAt:new Date().toISOString()});return row;});}
};}
