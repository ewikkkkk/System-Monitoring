const validText = value => typeof value==='string' && value.trim().length>0 && value.length<=4000;
export function validCommentChanges(body){
 const edits=body.commentEdits??[],comment=body.newComment;
 return Array.isArray(edits)&&edits.length<=30&&new Set(edits.map(edit=>edit?.id)).size===edits.length&&edits.every(edit=>Number.isSafeInteger(edit?.id)&&edit.id>0&&validText(edit.text))&&
   (comment==null||(validText(comment.text)&&typeof comment.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(comment.requestId)));
}
