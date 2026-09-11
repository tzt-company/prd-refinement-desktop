import { _electron as electron } from '@playwright/test';
import { createCanvas } from '@napi-rs/canvas';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('docs/acceptance/material-bundle-index/round-1/real-vision');
const profile=path.join(root,'profile');await mkdir(profile,{recursive:true});
const config=JSON.parse(await readFile(path.join(process.env.APPDATA,'prd-refinement-desktop','runtime-config.json'),'utf8'));
assert.equal(config.adapter,'codex-oauth');
const selected={adapter:config.adapter,provider:config.provider,model:config.model,reasoningEffort:config.reasoningEffort,nodeProfiles:{imageReading:config.nodeProfiles.imageReading},maxParallel:1,maxNodeParallel:1};
await writeFile(path.join(profile,'runtime-config.json'),JSON.stringify(selected));
const main=path.join(root,'main.txt'),png=path.join(root,'supplement.png');
await writeFile(main,'新增订单备注功能。','utf8');
// 代码生成测试夹具，不是编辑用户图片。
const canvas=createCanvas(1000,240),context=canvas.getContext('2d');
context.fillStyle='white';context.fillRect(0,0,1000,240);context.fillStyle='#111111';context.font='bold 54px "Microsoft YaHei"';context.fillText('订单备注最多100字',60,140);
await writeFile(png,canvas.toBuffer('image/png'));
const env={...process.env};delete env.VITE_DEV_SERVER_URL;
const app=await electron.launch({args:['.',`--user-data-dir=${profile}`],env});
try{
  assert.equal(path.resolve(await app.evaluate(({app})=>app.getPath('userData'))),profile);
  const page=await app.firstWindow();await page.waitForFunction(()=>Boolean(window.prdApp?.materials));
  const bundle=await page.evaluate(()=>window.prdApp.materials.create());
  for(const [file,role] of [[main,'primary'],[png,'supplement']]){
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);
    await page.evaluate(({id,role})=>window.prdApp.materials.add(id,{role,kind:'files'}),{id:bundle.id,role});
  }
  const waitReady=async()=>{
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      const b=await page.evaluate(id=>window.prdApp.materials.get(id),bundle.id);
      if(b.state!=='indexing'){assert.equal(b.state,'ready',JSON.stringify(b));return b}
      await new Promise(r=>setTimeout(r,1000));
    }
    await page.evaluate(id=>window.prdApp.materials.cancel(id),bundle.id);throw new Error('真实视觉索引超时，已取消');
  };
  await page.evaluate(id=>window.prdApp.materials.index(id),bundle.id);
  const first=await waitReady();
  const project=await page.evaluate(id=>window.prdApp.materials.project(id),bundle.id);
  const image=project.sourceUnits.find(unit=>unit.asset);
  assert.equal(image.asset.readStatus,'read');assert.ok(image.asset.extractedText.includes('100'));
  const visionDir=path.join(profile,'materials',bundle.id,'vision');
  const cache=async()=>Promise.all((await readdir(visionDir)).map(async name=>({name,mtimeMs:(await stat(path.join(visionDir,name))).mtimeMs,text:await readFile(path.join(visionDir,name),'utf8')})));
  const before=await cache();assert.equal(before.length,1);assert.ok(before[0].text.includes('100'));
  const sessionsBefore=await readdir(path.join(profile,'material-vision'));assert.equal(sessionsBefore.length,1);
  await page.evaluate(id=>window.prdApp.materials.index(id),bundle.id);
  const second=await waitReady();
  const after=await cache();assert.deepEqual(after,before);
  const sessionsAfter=await readdir(path.join(profile,'material-vision'));assert.deepEqual(sessionsAfter,sessionsBefore);
  assert.ok(second.revision>first.revision);
  const reread=await page.evaluate(id=>window.prdApp.materials.project(id),bundle.id);
  assert.equal(reread.sourceUnits.find(unit=>unit.asset).asset.extractedText,image.asset.extractedText);
  const evidence={bundleId:bundle.id,config:selected,firstState:first.state,firstRevision:first.revision,secondState:second.state,secondRevision:second.revision,image,cacheBefore:before,cacheAfter:after,visionSessionsBefore:sessionsBefore,visionSessionsAfter:sessionsAfter,checks:'真实main IPC+真实图像模型回调；转录含100；重建版本递增；缓存内容/mtime未变，未新增模型会话目录'};
  await writeFile(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({bundleId:bundle.id,extractedText:image.asset.extractedText,firstRevision:first.revision,secondRevision:second.revision,checks:evidence.checks}));
}finally{await app.close()}
