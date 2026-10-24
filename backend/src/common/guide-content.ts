// Remove leaked standalone metadata, preserving IDs used as actual quoted code values.
export function cleanGuideText(text:string){return text.split('\n').filter(line=>!/^\s*[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\s*$/i.test(line)).join('\n');}
export function cleanGuideBlocks(blocks:any[]){
 return blocks.map(block=>{
  if(!block||typeof block!=='object'||Array.isArray(block))return block;
  const copy={...block};
  if(typeof copy.text==='string')copy.text=cleanGuideText(copy.text);
  if(typeof copy.caption==='string')copy.caption=cleanGuideText(copy.caption);
  if(Array.isArray(copy.items))copy.items=copy.items.map((item:unknown)=>typeof item==='string'?cleanGuideText(item):item).filter((item:unknown)=>item!=='');
  if(Array.isArray(copy.rows))copy.rows=copy.rows.map((row:unknown)=>Array.isArray(row)?row.map(cell=>typeof cell==='string'?cleanGuideText(cell):cell):row);
  return copy;
 });
}
