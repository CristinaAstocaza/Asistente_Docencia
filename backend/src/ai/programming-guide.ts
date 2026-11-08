const filePattern=/(?:[\w@.-]+\/)*[\w.-]+\.(?:tsx?|jsx?|html|css|scss|json|py|java|sql)\b/g;
const productName=/^(?:[A-Z][A-Za-z0-9]*|node|vue|next|nuxt|express|react|three|chart|d3|nest)\.js$/i;
const onlyPath=/^(?:[\w@.-]+[\\/])*[\w.-]+\.(?:tsx?|jsx?|html|css|scss|json|py|java|sql)$/i;
export function programmingGuideIssue(blocks:any[],requireCode=true):string|undefined {
 const code=blocks.filter(block=>block.type==='code');
 // Theory pages may have no code; files they name must still be shown in full.
 if(!code.length&&requireCode)return 'Falta el ejemplo ejecutable: incluye el comando exacto o el contenido completo de los archivos.';
 for(const block of code){
  const text=block.text.trim();
  if(!text||onlyPath.test(text)||/^(?:\/\/|#|<!--)?\s*(?:código aquí|codigo aqui|añade el código|implementa aquí|resto del código|\.\.\.)/im.test(text))return 'Un bloque code contiene solo una ruta o un marcador. Coloca la ruta en filePath y en text el código completo listo para copiar y pegar, sin omitir la implementación.';
 }
 const implemented=new Set(code.flatMap(block=>typeof block.filePath==='string'?[block.filePath.replace(/\\/g,'/')]:[]));
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i];if(!['paragraph','heading','list'].includes(block.type))continue;
  // Product names such as Node.js, Vue.js or Next.js are not files to show.
  const paths=[(block.text||''),...(block.items||[])].flatMap(text=>text.match(filePattern)||[]).filter(path=>!productName.test(path));
  for(const path of paths){
   // Older drafts may put the filename directly above its code instead of in filePath.
   const covered=[...implemented].some(file=>file===path||file.endsWith('/'+path));
   if(!covered&&blocks[i+1]?.type!=='code')return `Falta el contenido de ${path}. Incluye un bloque code con filePath="${path}" y text con el archivo completo; nombrar el archivo no basta.`;
  }
 }
}
