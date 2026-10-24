import test from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../pricing.js';

const item=(id,price,quantity,unit,extra={})=>({id,name:id,price,quantity,unit,packs:1,percent:0,coupon:0,...extra});

test('sample identifies 500 ml as 7.42% cheaper per 100 ml',()=>{
  const {ranked}=compare('volume',[item('400 ml',159,400,'ml'),item('500 ml',184,500,'ml')]);
  assert.equal(ranked[0].id,'500 ml');
  assert.equal(ranked[0].unitPrice,36.8);
  assert.equal(ranked[1].unitPrice,39.75);
  assert.equal(((ranked[1].unitPrice-ranked[0].unitPrice)/ranked[1].unitPrice*100).toFixed(2),'7.42');
});

test('normalizes litres and applies percentage then coupon to whole purchase',()=>{
  const {ranked}=compare('volume',[item('a',220,1,'l',{percent:10,coupon:18}),item('b',90,500,'ml')]);
  assert.equal(ranked[0].id,'a');
  assert.equal(ranked[0].netPrice,180);
  assert.equal(ranked[0].unitPrice,18);
  assert.equal(ranked[1].unitPrice,18);
});

test('multipack divides total price by total quantity',()=>{
  const {ranked}=compare('mass',[item('three bags',120,250,'g',{packs:3}),item('one bag',45,250,'g')]);
  assert.equal(ranked[0].id,'three bags');
  assert.equal(ranked[0].unitPrice,16);
});

test('rejects zero or invalid quantities and non-positive net prices',()=>{
  const {ranked}=compare('count',[item('ok',30,3,'piece'),item('fraction',10,1.5,'piece'),item('zero',20,0,'piece'),item('free',10,1,'piece',{percent:100}),item('empty pack',10,1,'piece',{packs:''})]);
  assert.deepEqual(ranked.map(p=>p.id),['ok']);
});
