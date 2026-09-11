import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { execFile } from 'node:child_process';
import { parse, serializeOuter, type DefaultTreeAdapterMap } from 'parse5';
import type { SourceUnit } from '../src/types.js';
import { buildSourceUnits, enrichSourceContext } from './source-units.js';

export type ExtractionOptions = { resolveReference?: (reference:string,location:string)=>Promise<{path?:string;error?:string;excludedReason?:string}>; followReferences?:boolean; signal?:AbortSignal };
const checkAbort=(signal?:AbortSignal)=>signal?.throwIfAborted();

export type ImportedDocument = { rawText: string; sourceUnits: SourceUnit[] };
const mimeTypes: Record<string,string> = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp' };

async function convertLegacyDoc(input:string,output:string,signal?:AbortSignal):Promise<void>{
  const script=`$ErrorActionPreference='Stop'
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
$word=$null;$document=$null;$probe=$null
$existingWordIds=@(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class WordWindowOwner { [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); }'
try {
  $word=New-Object -ComObject Word.Application
  $probe=$word.Documents.Add()
  [uint32]$ownedWordId=0
  [void][WordWindowOwner]::GetWindowThreadProcessId([IntPtr]$word.ActiveWindow.Hwnd,[ref]$ownedWordId)
  if($existingWordIds -notcontains $ownedWordId){[Console]::Out.WriteLine("OWNED_WORD_PID="+$ownedWordId);[Console]::Out.Flush()}
  $probe.Close(0);$probe=$null
  $word.Visible=$false;$word.DisplayAlerts=0;$word.AutomationSecurity=3
  $word.Options.UpdateLinksAtOpen=$false
  $document=$word.Documents.Open($request.input,$false,$true,$false,'','')
  $document.SaveAs2($request.output,16)
} finally {
  if($null -ne $probe){$probe.Close(0)}
  if($null -ne $document){$document.Close(0)}
  if($null -ne $word){$word.Quit()}
}`;
  await new Promise<void>((resolve,reject)=>{
    let ownedWordPid:number|undefined,stdout='';
    const child=execFile('pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:60_000},async error=>{
      signal?.removeEventListener('abort',abort);
      if(!error){resolve();return}
      // 只回收本次 COM 创建且启动前不存在的 Word 进程，绝不终止用户已打开的 Word。
      if(ownedWordPid)await new Promise<void>(done=>execFile('pwsh.exe',['-NoProfile','-NonInteractive','-Command',`Stop-Process -Id ${ownedWordPid} -Force -ErrorAction SilentlyContinue`],{windowsHide:true,timeout:5000},()=>done()));
      reject(signal?.aborted?signal.reason:new Error('DOC 转换失败或超时。请确认已安装 Microsoft Word，且文档未损坏、未加密；也可另存为 DOCX 后导入。'));
    });
    const abort=()=>{if(ownedWordPid)child.kill()};signal?.addEventListener('abort',abort,{once:true});
    child.stdout?.on('data',chunk=>{stdout+=String(chunk);const match=stdout.match(/OWNED_WORD_PID=(\d+)/);if(match){ownedWordPid=Number(match[1]);if(signal?.aborted)child.kill()}});
    child.stdin?.end(JSON.stringify({input,output}));
  });
}

/** Assets are immutable import snapshots. Extraction is not evidence of semantic reading. */
export async function extractDocument(filePath: string, assetDirectory: string, options:ExtractionOptions={}): Promise<ImportedDocument> {
  checkAbort(options.signal);
  const buffer = await readFile(filePath,{signal:options.signal}), extension = path.extname(filePath).toLowerCase();
  validateSignature(buffer,extension);
  if(extension==='.doc'){
    await mkdir(assetDirectory,{recursive:true});
    const converted=path.join(assetDirectory,'converted.docx');
    await convertLegacyDoc(path.resolve(filePath),path.resolve(converted),options.signal);
    return extractDocument(converted,assetDirectory,options);
  }
  const followReferences=options.followReferences!==false;
  if (!['.docx','.pdf','.html','.htm','.css','.js','.svg',...Object.keys(mimeTypes)].includes(extension)) {
    if(!['.md','.txt'].includes(extension))throw new Error(`不支持的文档格式：${extension}`);
    const rawText=new TextDecoder('utf-8',{fatal:true}).decode(buffer),sourceUnits=buildSourceUnits(rawText);
    if(extension==='.md'&&followReferences&&options.resolveReference){
      for(const unit of [...sourceUnits]){
        let referenceFailed=false;
        for(const match of unit.excerpt.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)){
          checkAbort(options.signal);const reference=match[1].trim().replace(/^<|>$/g,''),result=await options.resolveReference(reference,unit.location);
          if(result.excludedReason){unit.kind='paragraph';unit.status='processed';unit.context=`用户排除图片引用：${result.excludedReason}`;continue}
          if(!result.path){referenceFailed=true;unit.status='blocked';unit.context=`图片引用未读取：${reference}；${result.error??'缺少文件'}`;continue}
          try{
            const image=await extractDocument(result.path,path.join(assetDirectory,`markdown-image-${sourceUnits.length}`),{signal:options.signal});
            if(!image.sourceUnits.some(item=>item.asset))throw new Error('引用目标不是可读取图片');
            unit.kind='paragraph';unit.status='processed';
            sourceUnits.push(...image.sourceUnits.map(item=>({...item,location:`${unit.location} / 图片 ${reference}`,synthetic:true})));
          }catch(error){checkAbort(options.signal);referenceFailed=true;unit.status='blocked';unit.context=`图片无法读取：${reference}；${String(error)}`}
        }
        if(referenceFailed)unit.status='blocked';
      }
      sourceUnits.forEach((unit,index)=>unit.id=`S-${String(index+1).padStart(3,'0')}`);
    }
    return {rawText,sourceUnits};
  }
  await mkdir(assetDirectory,{recursive:true});
  const assets: SourceUnit[]=[];
  const addAsset=async(bytes:Buffer,name:string,location:string,mimeType:string,error?:string)=>{
    const file=path.join(assetDirectory,name);await writeFile(file,bytes);
    assets.push({id:'',kind:'image',label:name,excerpt:`[图片资产：${name}]`,location,status:error?'blocked':'pending',asset:{path:file,mimeType,sha256:createHash('sha256').update(bytes).digest('hex'),readStatus:error?'blocked':'pending',...(error?{error}:{})}});
  };
  let rawText='';
  if(mimeTypes[extension]||extension==='.svg'){
    const bytes=extension==='.svg'?await rasterizeSvg(buffer):buffer;
    await addAsset(bytes,`image${extension==='.svg'?'.png':extension}`,'图片文件',extension==='.svg'?'image/png':mimeTypes[extension]);
  } else if(['.html','.htm','.css','.js'].includes(extension)){
    const units:SourceUnit[]=[];
    const add=(excerpt:string,location:string,kind:SourceUnit['kind']='paragraph',context?:string,status:SourceUnit['status']='processed')=>{
      if(excerpt.trim())units.push({id:'',kind,label:excerpt.slice(0,100),excerpt,location,status,...(context?{context}:{})});
    };
    const blocked=(label:string,location:string)=>add(`[${label}]`,location,'attachment',undefined,'blocked');
    const resolve=async(reference:string,location:string,base:string)=>{
      checkAbort(options.signal);
      if(options.resolveReference){
        const normalized=/^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(reference)?reference:path.relative(path.dirname(path.resolve(filePath)),path.resolve(base,reference)).split(path.sep).join('/');
        const result=await options.resolveReference(normalized,location);
        if(result.excludedReason){add(`[已排除引用 ${reference}：${result.excludedReason}]`,location,'attachment','用户明确排除的资料，不作为需求依据');return undefined}
        if(!result.path){blocked(`引用未读取：${reference}；${result.error??'缺少文件'}`,location);return undefined}
        return result.path;
      }
      if(/^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(reference)){blocked(`${location.includes('外部 iframe')?'HTML 外部 iframe':'外部引用'}未读取：${reference}`,location);return undefined}
      let decoded:string;try{decoded=decodeURIComponent(reference.split(/[?#]/)[0])}catch{blocked(`引用路径编码错误：${reference}`,location);return undefined}
      const target=path.resolve(base,decoded),relative=path.relative(base,target);
      if(relative.startsWith('..')||path.isAbsolute(relative)){blocked(`引用路径越界：${reference}`,location);return undefined}
      return target;
    };
    const readReference=async(reference:string,location:string,base:string)=>{
      const target=await resolve(reference,location,base);if(!target)return;
      try{return {bytes:await readFile(target,{signal:options.signal}),target}}catch(error){checkAbort(options.signal);blocked(`引用缺失或无法读取：${reference}；${String(error)}`,location)}
    };
    const decodeHtml=(bytes:Buffer)=>{
      const charset=bytes.subarray(0,4096).toString('ascii').match(/charset\s*=\s*["']?\s*([a-zA-Z0-9_-]+)/i)?.[1]??'utf-8';
      try{return new TextDecoder(charset,{fatal:true}).decode(bytes)}catch{throw new Error(`HTML 编码 ${charset} 无法读取，请另存为 UTF-8 HTML`)}
    };
    const scanStyle=async(code:string,location:string,base:string,depth=0):Promise<void>=>{
      if(!followReferences)return;
      if(depth>=8){blocked('CSS 引用超过 8 层',location);return}
      for(const match of code.matchAll(/(?:url\(\s*["']?([^"')\s]+)|@import\s+["']([^"']+))/gi)){
        const reference=match[1]??match[2];if(reference.startsWith('#'))continue;
        if(reference.startsWith('data:')){blocked('CSS 内嵌资源需另行提供',location);continue}
        const resource=await readReference(reference,location,base);if(!resource)continue;
        const suffix=path.extname(resource.target).toLowerCase();
        try{
          if(mimeTypes[suffix]||suffix==='.svg'){
            validateSignature(resource.bytes,suffix);
            await addAsset(suffix==='.svg'?await rasterizeSvg(resource.bytes):resource.bytes,`html-image-${assets.length+1}${suffix==='.svg'?'.png':suffix}`,`${location} / CSS ${reference}`,suffix==='.svg'?'image/png':mimeTypes[suffix]);
          }else if(suffix==='.css'){
            const style=new TextDecoder('utf-8',{fatal:true}).decode(resource.bytes);
            add(style,`${location} / CSS ${reference}`,'attachment','样式源码（来源数据，不是普通业务需求）');
            await scanStyle(style,`${location} / CSS ${reference}`,path.dirname(options.resolveReference?path.resolve(base,reference):resource.target),depth+1);
          }else blocked(`CSS 资源尚未读取：${reference}`,location);
        }catch(error){checkAbort(options.signal);blocked(`CSS 资源无法读取：${reference}；${String(error)}`,location)}
      }
    };
    const visit=async(node:DefaultTreeAdapterMap['node'],base:string,parentLocation:string,depth=0,heading='',tableContext=''):Promise<void>=>{
      checkAbort(options.signal);
      const pos='sourceCodeLocation' in node?node.sourceCodeLocation:undefined;
      const location=pos?`${parentLocation} / HTML 第 ${pos.startLine} 行第 ${pos.startCol} 列`:parentLocation;
      if(node.nodeName==='#text'){const value=(node as DefaultTreeAdapterMap['textNode']).value.trim();if(value)add(heading+value,location,heading?'heading':tableContext?'table':'paragraph',tableContext||undefined);return}
      if(!('tagName' in node)){if('childNodes' in node)for(const child of node.childNodes)await visit(child,base,parentLocation,depth);return}
      const tag=node.tagName,attrs=Object.fromEntries(node.attrs.map(a=>[a.name,a.value]));
      if(tag==='head'){for(const child of node.childNodes)if('tagName' in child&&['script','style','link'].includes(child.tagName))await visit(child,base,parentLocation,depth);return}
      if(tag==='script'||tag==='style'||tag==='link'){
        if(tag==='link'&&!attrs.rel?.split(/\s+/).includes('stylesheet'))return;
        const reference=tag==='link'?attrs.href:attrs.src;
        let codeBase=base;
        let code=node.childNodes.map(child=>'value' in child?child.value:'').join('');
        if(reference){if(!followReferences)return;const resource=await readReference(reference,location,base);if(!resource)return;codeBase=path.dirname(options.resolveReference?path.resolve(base,reference):resource.target);code=new TextDecoder('utf-8',{fatal:true}).decode(resource.bytes)}
        if(code.trim())add(code,location,'attachment',`HTML ${tag==='script'?'交互脚本':'样式'}源码（来源数据，未执行；不是普通业务需求）`);
        if(tag!=='script')await scanStyle(code,location,codeBase);
        return;
      }
      if(tag==='iframe'){
        if(depth>=8){blocked('HTML 内嵌文档超过 8 层',location);return}
        let embedded=attrs.srcdoc,embeddedBase=base;
        if(embedded===undefined&&attrs.src?.startsWith('data:text/html')){
          try{const comma=attrs.src.indexOf(',');if(comma<0)throw new Error('invalid data URL');embedded=/;base64$/i.test(attrs.src.slice(0,comma))?decodeHtml(Buffer.from(attrs.src.slice(comma+1),'base64')):decodeURIComponent(attrs.src.slice(comma+1))}catch{blocked('HTML 内嵌文档编码无法读取',location);return}
        }
        if(embedded===undefined){if(!followReferences)return;if(!attrs.src){blocked('HTML 外部 iframe 缺少地址',location);return}const resource=await readReference(attrs.src,`${location} / 外部 iframe`,base);if(!resource)return;embedded=decodeHtml(resource.bytes);embeddedBase=path.dirname(options.resolveReference?path.resolve(base,attrs.src):resource.target)}
        await visit(parse(embedded,{sourceCodeLocationInfo:true}),embeddedBase,`${location} / iframe ${attrs.title??(attrs.src?.startsWith('data:')?'data:text/html 内嵌文档':attrs.src)??'srcdoc'}`,depth+1);return;
      }
      if(tag==='img'){
        const src=attrs.src??'',match=src.match(/^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([\s\S]+)$/i);
        try{
          if(match){const bytes=Buffer.from(match[2],'base64'),suffix=match[1]==='image/svg+xml'?'.svg':'.'+(match[1]==='image/jpeg'?'jpg':match[1].split('/')[1]);validateSignature(bytes,suffix);await addAsset(suffix==='.svg'?await rasterizeSvg(bytes):bytes,`html-image-${assets.length+1}${suffix==='.svg'?'.png':suffix}`,location,suffix==='.svg'?'image/png':match[1])}
          else if(src&&followReferences){const resource=await readReference(src,location,base);if(resource){const suffix=path.extname(resource.target).toLowerCase();validateSignature(resource.bytes,suffix);if(suffix==='.svg')await addAsset(await rasterizeSvg(resource.bytes),`html-image-${assets.length+1}.png`,location,'image/png');else if(mimeTypes[suffix])await addAsset(resource.bytes,`html-image-${assets.length+1}${suffix}`,location,mimeTypes[suffix]);else blocked(`HTML 图片格式尚不支持：${src}`,location)}}
          else if(!src)blocked('HTML 图片缺少地址',location);
        }catch(error){checkAbort(options.signal);blocked(`HTML 图片无法读取：${src}；${String(error)}`,location)}
        if(attrs.alt)add(`[图片说明：${attrs.alt}]`,location);return;
      }
      if(tag==='svg'){try{await addAsset(await rasterizeSvg(Buffer.from(serializeOuter(node))),`html-image-${assets.length+1}.png`,location,'image/png')}catch(error){checkAbort(options.signal);blocked(`HTML SVG 无法读取：${String(error)}`,location)}return}
      if(['object','embed','canvas','video','audio','template'].includes(tag)){if(followReferences){if(attrs.src||attrs.data)await readReference(attrs.src??attrs.data,location,base);blocked(`HTML ${tag} 内容需另行读取`,location)}return}
      if(attrs.style){add(attrs.style,location,'attachment','HTML 排版属性（来源数据，不是普通业务需求）');await scanStyle(attrs.style,location,base)}
      if(followReferences&&attrs.srcset)blocked(`HTML ${tag} 替代图片未读取`,location);
      const context=tag==='table'?`表格原始位置：${location}`:tableContext;
      for(const child of node.childNodes)await visit(child,base,parentLocation,depth,/^h[1-6]$/.test(tag)?'#'.repeat(Number(tag[1]))+' ':heading,context);
    };
    if(extension==='.css'||extension==='.js'){
      const code=new TextDecoder('utf-8',{fatal:true}).decode(buffer),location=`${path.basename(filePath)} 第 1-${code.split('\n').length} 行`;
      add(code,location,'attachment',`${extension==='.css'?'样式':'脚本'}源码（来源数据，未执行；不是普通业务需求）`);
      if(extension==='.css')await scanStyle(code,location,path.dirname(path.resolve(filePath)));
    }else await visit(parse(decodeHtml(buffer),{sourceCodeLocationInfo:true}),path.dirname(path.resolve(filePath)),path.basename(filePath));
    rawText=units.map(unit=>unit.excerpt).join('\n\n');
    if(!rawText&&!assets.length)throw new Error('HTML 未包含可读取正文');
    const sourceUnits=[...units,...assets.map(asset=>({...asset,synthetic:true}))];
    sourceUnits.forEach((unit,index)=>unit.id=`S-${String(index+1).padStart(3,'0')}`);
    return {rawText,sourceUnits:enrichSourceContext(sourceUnits)};
  } else if(extension==='.docx') {
    const result=await mammoth.extractRawText({buffer});rawText=result.value;
    const archive=await JSZip.loadAsync(buffer);
    const media=Object.values(archive.files).filter(file=>!file.dir&&/^word\/media\//.test(file.name)).sort((a,b)=>a.name.localeCompare(b.name));
    for(const [index,file] of media.entries()) {
      checkAbort(options.signal);
      const suffix=path.extname(file.name).toLowerCase(),mimeType=mimeTypes[suffix]??'application/octet-stream';
      await addAsset(await file.async('nodebuffer'),`docx-${index+1}${suffix}`,`DOCX 包内 ${file.name}`,mimeType,mimeTypes[suffix]?undefined:`图片格式 ${suffix} 尚不支持视觉读取`);
    }
    // Embedded documents are separate source material, never assumed covered by body text.
    for(const file of Object.values(archive.files).filter(file=>!file.dir&&/^word\/embeddings\//.test(file.name)))assets.push({id:'',kind:'attachment',label:file.name,excerpt:`[嵌入附件：${file.name}]`,location:`DOCX 包内 ${file.name}`,status:'blocked'});
    // These parts are outside mammoth raw-text coverage; keep an explicit ingestion gap.
    for(const file of Object.values(archive.files).filter(file=>!file.dir&&/^word\/(?:charts\/|diagrams\/|header\d|footer\d)/.test(file.name)))assets.push({id:'',kind:'attachment',label:file.name,excerpt:`[未读取的文档组件：${file.name}]`,location:`DOCX 包内 ${file.name}`,status:'blocked'});
    if(followReferences)for(const file of Object.values(archive.files).filter(file=>!file.dir&&file.name.endsWith('.rels'))) {
      const relationships=await file.async('string');
      const external=[...relationships.matchAll(/<Relationship\b[^>]*>/g)].map(match=>match[0]).filter(element=>/TargetMode\s*=\s*["']External["']/.test(element));
      for(const element of external){
        checkAbort(options.signal);
        const target=element.match(/\bTarget\s*=\s*["']([^"']+)/)?.[1]??'缺少目标',location=`DOCX 包内 ${file.name}`;
        const result=options.resolveReference?await options.resolveReference(target,location):undefined;
        assets.push({id:'',kind:'attachment',label:result?.excludedReason?'外部引用已排除':'外部引用待核对',excerpt:result?.excludedReason?`[外部引用 ${target} 已排除：${result.excludedReason}]`:`[未读取外部引用：${target}；${result?.error??'尚未支持 DOCX 外部组件读取'}]`,location,status:result?.excludedReason?'processed':'blocked'});
      }
    }
    for(const message of result.messages)assets.push({id:'',kind:'attachment',label:'DOCX 解析提示',excerpt:message.message,location:'DOCX 解析器',status:'blocked'});
  } else {
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading=pdfjs.getDocument({data:new Uint8Array(buffer),useWorkerFetch:false,isEvalSupported:false});
    const abort=()=>{void loading.destroy()};options.signal?.addEventListener('abort',abort,{once:true});
    let document;try{document=await loading.promise}catch(error){options.signal?.removeEventListener('abort',abort);await loading.destroy();checkAbort(options.signal);throw error}
    const pages:string[]=[];
    try {
      for(let index=1;index<=document.numPages;index++) {
        checkAbort(options.signal);
        const page=await document.getPage(index),content=await page.getTextContent();
        pages.push(`# 第 ${index} 页\n\n${content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('')}`);
        try {
          const viewport=page.getViewport({scale:1.5});
          if(viewport.width*viewport.height>40_000_000)throw new Error('PDF 页面超过 4000 万像素上限');
          const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
          await page.render({canvasContext:canvas.getContext('2d') as unknown as CanvasRenderingContext2D,viewport}).promise;
          await addAsset(canvas.toBuffer('image/png'),`pdf-page-${index}.png`,`PDF 第 ${index} 页（完整页面，含文字、图片与矢量图）`,'image/png');
        } catch(error) {
          checkAbort(options.signal);
          assets.push({id:'',kind:'image',label:`PDF 第 ${index} 页`,excerpt:`[页面渲染失败：${String(error)}]`,location:`PDF 第 ${index} 页`,status:'blocked'});
        } finally {page.cleanup()}
      }
    } finally {options.signal?.removeEventListener('abort',abort);await document.destroy()}
    rawText=pages.join('\n\n');
  }
  checkAbort(options.signal);
  const sourceUnits=buildSourceUnits(rawText);
  if(extension==='.docx')sourceUnits.forEach(unit=>unit.location=`DOCX 提取文本 ${unit.location}（非原文页码或段落坐标）`);
  if(extension==='.pdf')sourceUnits.forEach(unit=>unit.location=`PDF 提取文本 ${unit.location}；页码见章节上下文`);
  for(const asset of assets){asset.synthetic=true;asset.id=`S-${String(sourceUnits.length+1).padStart(3,'0')}`;sourceUnits.push(asset)}
  return {rawText,sourceUnits};
}


function validateSignature(bytes:Buffer,extension:string){
  const signatures:Record<string,boolean>={
    '.pdf':bytes.subarray(0,5).toString()==='%PDF-',
    '.docx':bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4])),
    '.doc':bytes.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])),
    '.png':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    '.jpg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
    '.jpeg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
    '.gif':/^GIF8[79]a/.test(bytes.subarray(0,6).toString()),
    '.webp':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',
    '.svg':/<svg(?:\s|>)/i.test(bytes.toString('utf8')),
    '.html':!bytes.includes(0)&&/<(?:!doctype|html|head|body|[a-z][\w:-]*)(?:\s|>)/i.test(bytes.toString('utf8')),
    '.htm':!bytes.includes(0)&&/<(?:!doctype|html|head|body|[a-z][\w:-]*)(?:\s|>)/i.test(bytes.toString('utf8')),
    '.txt':!bytes.includes(0),'.md':!bytes.includes(0),'.css':!bytes.includes(0),'.js':!bytes.includes(0),
  };
  if(signatures[extension]===false)throw new Error(`文件签名与扩展名 ${extension} 不符或文件损坏`);
}
async function rasterizeSvg(bytes:Buffer):Promise<Buffer>{
  const svg=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // 在交给原生渲染器之前拒绝一切活动内容和资源加载语法。
  if(/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)|<(?:script|foreignObject|image|use|animate|set|feImage)\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=|url\s*\(|@import/i.test(svg))throw new Error('SVG 含活动内容或外部资源，拒绝栅格化');
  const root=svg.match(/<svg\b([^>]*)>/i)?.[1]??'';
  const viewBox=root.match(/\bviewBox\s*=\s*["']([^"']+)/i)?.[1].trim().split(/[\s,]+/).map(Number);
  const dimension=(name:string,index:number)=>{const value=root.match(new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']+)','i'))?.[1];if(value&&!/^\d+(?:\.\d+)?(?:px)?$/.test(value))throw new Error('SVG 尺寸必须使用有限像素数');return value?parseFloat(value):viewBox?.[index]??300};
  const width=dimension('width',2),height=dimension('height',3);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>4096||height>4096||width*height>16_000_000)throw new Error('SVG 尺寸超过 4096 边长或 1600 万像素上限');
  const image=await loadImage(bytes),canvas=createCanvas(Math.ceil(width),Math.ceil(height));canvas.getContext('2d').drawImage(image,0,0,width,height);return canvas.toBuffer('image/png');
}
