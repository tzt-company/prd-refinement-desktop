import { _electron as electron } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const [userData, outputRoot] = process.argv.slice(2);
if (!userData || !outputRoot) throw new Error('需要 userData 和输出目录');
await mkdir(outputRoot,{recursive:true});
const app=await electron.launch({args:[`--user-data-dir=${userData}`,'--no-sandbox','.'],env:{...process.env,VITE_DEV_SERVER_URL:'http://127.0.0.1:5173'}});
try{
  await app.firstWindow();await new Promise(resolve=>setTimeout(resolve,1000));
  const page=app.windows().find(value=>value.url().includes('127.0.0.1:5173'))??app.windows().at(-1);if(!page)throw new Error('未找到应用窗口');
  await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'新建任务'}).first().click();
  await page.screenshot({path:path.join(outputRoot,'initial-1440.png'),fullPage:true});
  await page.locator('.material-page').evaluate(element=>{const dataTransfer=new DataTransfer();dataTransfer.items.add(new File(['demo'],'demo.md',{type:'text/markdown'}));element.dispatchEvent(new DragEvent('dragenter',{bubbles:true,dataTransfer}))});
  await page.screenshot({path:path.join(outputRoot,'dragging-1440.png'),fullPage:true});
  await page.locator('.material-page').dispatchEvent('dragleave');
  await page.setViewportSize({width:1100,height:720});await page.screenshot({path:path.join(outputRoot,'initial-1100.png'),fullPage:true});
  console.log(JSON.stringify({passed:true,title:await page.locator('h1').innerText()}));
}finally{await app.close()}
