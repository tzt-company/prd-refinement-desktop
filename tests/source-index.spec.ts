import { expect, it } from 'vitest';
import { SourceIndex } from '../electron/source-index';
import type { SourceUnit } from '../src/types';

const unit = (id: string, fileId: string, label: string, excerpt: string): SourceUnit => ({id,fileId,label,excerpt,logicalPath:`${fileId}/需求.md`,fileRevision:1,sourceRole:'supplement',kind:'paragraph',status:'processed',location:'第 1 行'});
it('隔离跨文件同名内容，支持中文片段、标题优先和文件过滤',()=>{
  const index=new SourceIndex([unit('S-B','B','说明','支持生产活动关联ID合并提醒'),unit('S-A','A','生产活动关联ID合并提醒','同名生产活动')],3);
  expect(index.query({query:'活动关联'}).items.map(x=>x.id)).toEqual(['S-A','S-B']);
  expect(index.query({query:'活动关联',fileId:'B'}).items.map(x=>x.logicalPath)).toEqual(['B/需求.md']);
  expect(index.query({query:'不存在'}).total).toBe(0);
  expect(index.read(['S-B','S-A']).map(x=>x.fileId)).toEqual(['B','A']);
});
it('分页顺序稳定，限制单页 100 项并返回准确总数和版本',()=>{
  const index=new SourceIndex(Array.from({length:105},(_,i)=>unit(`S-${String(i).padStart(3,'0')}`,'A','同名','内容')),7);
  const first=index.query({limit:1000});
  expect(first).toMatchObject({total:105,nextOffset:100,revision:7});expect(first.items).toHaveLength(100);
  const second=index.query({offset:first.nextOffset});expect(second.items).toHaveLength(5);expect(second.nextOffset).toBeUndefined();
  expect(new Set([...first.items,...second.items].map(x=>x.id)).size).toBe(105);
});
it('构造、查询和读取均隔离可变对象，未知编号和重复编号明确失败',()=>{
  const source=unit('S-A','A','原题','原文');source.asset={path:'a',mimeType:'image/png',sha256:'x',readStatus:'read',extractedText:'原图片'};
  const index=new SourceIndex([source],1);source.excerpt='外部改写';
  const result=index.query({});result.items[0].asset!.extractedText='改写';
  const read=index.read(['S-A']);read[0].excerpt='改写';
  expect(index.read(['S-A'])[0]).toMatchObject({excerpt:'原文',asset:{extractedText:'原图片'}});
  expect(()=>index.read(['S-A','S-MISSING'])).toThrow('未知来源编号');
  expect(()=>new SourceIndex([source,source],1)).toThrow('来源编号重复');
});
it('大响应分页保持完整单元，超预算读取明确失败而不截断原文',()=>{
  const index=new SourceIndex([unit('S-A','A','大文本','甲'.repeat(600000)),unit('S-B','A','大文本','乙'.repeat(600000))],1);
  expect(index.query({})).toMatchObject({total:2,nextOffset:1});
  expect(index.query({offset:1}).items[0].excerpt).toHaveLength(600000);
  expect(()=>index.read(['S-A','S-B'])).toThrow('预算');
  expect(()=>index.read(Array(101).fill('S-A'))).toThrow('100');
  expect(()=>index.query({query:'甲'.repeat(1001)})).toThrow('1000');
});
