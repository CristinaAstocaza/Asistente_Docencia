const filePattern=/(?:[\w@.-]+\/)*[\w.-]+\.(?:tsx?|jsx?|html|css|scss|json|py|java|sql)\b/g;
const onlyPath=/^(?:[\w@.-]+[\\/])*[\w.-]+\.(?:tsx?|jsx?|html|css|scss|json|py|java|sql)$/i;
export function programmingGuideIssue(blocks:any[]):string|undefined {
 const code=blocks.filter(block=>block.type==='code');
 if(!code.length)return 'Falta el ejemplo ejecutable: incluye el comando exacto o el contenido completo de los archivos.';
 for(const block of code){
  const text=block.text.trim();
  if(!text||onlyPath.test(text)||/^(?:\/\/|#|<!--)?\s*(?:código aquí|codigo aqui|añade el código|implementa aquí|resto del código|\.\.\.)/im.test(text))return 'Un bloque code contiene solo una ruta o un marcador. Coloca la ruta en filePath y en text el código completo listo para copiar y pegar, sin omitir la implementación.';
 }
 const implemented=new Set(code.flatMap(block=>typeof block.filePath==='string'?[block.filePath.replace(/\\/g,'/')]:[]));
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i];if(!['paragraph','heading','list'].includes(block.type))continue;
  const paths=[(block.text||''),...(block.items||[])].flatMap(text=>text.match(filePattern)||[]);
  for(const path of paths){
   // Older drafts may put the filename directly above its code instead of in filePath.
   const covered=[...implemented].some(file=>file===path||file.endsWith('/'+path));
   if(!covered&&blocks[i+1]?.type!=='code')return `Falta el contenido de ${path}. Incluye un bloque code con filePath="${path}" y text con el archivo completo; nombrar el archivo no basta.`;
  }
 }
}
