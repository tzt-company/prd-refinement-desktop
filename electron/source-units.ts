import type { SourceUnit } from '../src/types.js';

const contextStart = '<source-structure-context>';
const contextEnd = '</source-structure-context>';

/** 只补充可由原文结构确定的上下文，不改原文、编号或字符覆盖。 */
export function enrichSourceContext(units: SourceUnit[]): SourceUnit[] {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  let introduction: { text: string; id: string } | undefined;
  return units.map(unit => {
    const text = unit.excerpt.trim();
    const markdownHeading = text.match(/^(#{1,6})\s+(.+)$/);
    const boldHeading = text.match(/^\*\*(.+)\*\*$/);
    if (markdownHeading || boldHeading || unit.kind === 'heading') {
      const title = markdownHeading?.[2] ?? boldHeading?.[1] ?? text;
      const numbered = title.match(/^(\d+(?:\.\d+)*)(?:\.|\s)/);
      const level = markdownHeading?.[1].length ?? (numbered ? numbered[1].split('.').length + 1 : 2);
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
      headings.push({ level, text: title, id: unit.id });
      introduction = undefined;
    }
    const listItem = /^(?:[-+*]\s+|\d+[.)、]\s+)/.test(text);
    const inheritedIntroduction = listItem ? introduction : undefined;
    if (!listItem) {
      introduction = unit.kind === 'paragraph' && /[:：]\s*$/.test(text)
        ? { text, id: unit.id }
        : undefined;
    }
    // 自有标记使重复调用幂等，既有表头及调用方提供的 context 原样保留。
    const previous = unit.context ?? '';
    const marker = previous.indexOf(contextStart);
    const baseContext = marker < 0 ? previous : previous.slice(0, marker).replace(/\n\n$/, '');
    const structure = [
      headings.length ? `章节路径：${headings.map(heading => `[${heading.id}] ${heading.text}`).join(' → ')}` : '',
      inheritedIntroduction ? `列表引导原文 [${inheritedIntroduction.id}]：${inheritedIntroduction.text}` : '',
    ].filter(Boolean).join('\n');
    const context = [baseContext, structure ? `${contextStart}\n${structure}\n${contextEnd}` : ''].filter(Boolean).join('\n\n');
    const result = { ...unit };
    if (context) result.context = context;
    else delete result.context;
    return result;
  });
}

export function buildSourceUnits(rawText: string): SourceUnit[] {
  const lines=rawText.replace(/\r\n/g,'\n').split('\n');
  const units:SourceUnit[]=[];
  const add=(kind:SourceUnit['kind'],excerpt:string,start:number,end:number,label?:string,context?:string)=>{
    if(!excerpt.trim())return;
    const heading=excerpt.match(/^#{1,6}\s+(.+)$/)?.[1]??excerpt.match(/^\*\*(.+)\*\*$/)?.[1];
    units.push({id:`S-${String(units.length+1).padStart(3,'0')}`,label:label??heading??`原文单元 ${units.length+1}`,kind,excerpt,...(context?{context}:{}),location:start===end?`第 ${start} 行`:`第 ${start}-${end} 行`,status:kind==='image'?'blocked':'processed'});
  };
  let index=0;
  while(index<lines.length){
    const line=lines[index],lineNo=index+1;
    if(!line.trim()){index+=1;continue}
    if(/^#{1,6}\s+/.test(line)||/^\*\*.+\*\*$/.test(line)){add('heading',line,lineNo,lineNo);index+=1;continue}
    if(/^\s*\|.*\|\s*$/.test(line)){
      const tableStart=index,tableLines:string[]=[];
      while(index<lines.length&&/^\s*\|.*\|\s*$/.test(lines[index])){tableLines.push(lines[index]);index+=1}
      const headerCount=tableLines.length>1&&/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(tableLines[1])?2:1;
      const header=tableLines.slice(0,headerCount).join('\n');
      add('table',header,tableStart+1,tableStart+headerCount,'表格表头');
      for(let row=headerCount;row<tableLines.length;row+=1)add('table',tableLines[row],tableStart+row+1,tableStart+row+1,`表格数据行 ${row-headerCount+1}`,header);
      continue;
    }
    const paragraph:string[]=[];let paragraphStart=index;
    while(index<lines.length&&lines[index].trim()&&!/^#{1,6}\s+/.test(lines[index])&&!/^\*\*.+\*\*$/.test(lines[index])&&!/^\s*\|.*\|\s*$/.test(lines[index])){
      const current=lines[index];
      if(/!\[[^\]]*\]\([^)]*\)/.test(current)){add('paragraph',paragraph.join('\n'),paragraphStart+1,index);paragraph.length=0;add('image',current,index+1,index+1,'图片引用（待读取）');paragraphStart=index+1}
      else paragraph.push(current);
      index+=1;
    }
    add('paragraph',paragraph.join('\n'),paragraphStart+1,index);
  }
  return enrichSourceContext(units);
}

export function sourceCoverage(rawText:string,units:SourceUnit[]){const normalize=(value:string)=>value.replace(/\s/g,'');const source=normalize(rawText),ledger=normalize(units.filter(x=>!x.synthetic).map(x=>x.excerpt).join(''));return {complete:source===ledger,sourceCharacters:source.length,ledgerCharacters:ledger.length}}

