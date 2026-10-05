/** Verbatim source fragments to reduce transcription errors by small models.
 * These are untrusted source data, never inferred facts or instructions.
 * The final validator still requires a supported exact quotation.
 */
export function evidenceChoices(body:string):string[]{
  const matches=[...body.matchAll(/\b(?:hiring|paid|compensation|salary|financial support|apply for|applications?|grant|funding|implement|integration|workflow|partnership|proposal)\b/gi)];
  const choices:string[]=[];
  for(const match of matches){
    const index=match.index??0;
    const before=Math.max(body.lastIndexOf('. ',index),body.lastIndexOf('\n',index),body.lastIndexOf('! ',index));
    let start=before<0?0:before+1;
    while(start<index&&/\s/.test(body[start]))start++;
    const ends=[body.indexOf('. ',index),body.indexOf('\n',index),body.indexOf('! ',index)].filter(n=>n>=index);
    let end=ends.length?Math.min(...ends)+1:body.length;
    if(end-start>280){start=Math.max(start,index-50);end=Math.min(body.length,start+270);}
    const quote=body.slice(start,end).trim();
    if(quote.length>=15&&!choices.includes(quote)&&!/^https?:\/\/\S+$/.test(quote))choices.push(quote);
    if(choices.length===16)break;
  }
  return choices;
}
