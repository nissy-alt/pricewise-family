import test from 'node:test';
import assert from 'node:assert/strict';
import {parseComparison, replyForText} from '../line-bot.js';
import {onRequestPost} from '../functions/api/line.js';

test('LINE sample reports 500 ml as 7.42% cheaper', () => {
  const result = parseComparison('400 ml ฿159 vs 500 ml ฿184');
  assert.equal(result.ranked[0].name, 'สินค้า 2');
  assert.match(replyForText('400 ml ฿159 vs 500 ml ฿184'), /7\.42%/);
});

test('named items and discounts compare through shared pricing logic', () => {
  const result = parseComparison('นม A 159 400ml ลด 10%\nนม B 184 500ml');
  assert.equal(result.ranked[0].name, 'นม A');
  assert.equal(result.ranked[0].unitPrice, 35.775);
  assert.equal(parseComparison('น้ำ 159 400ml\nแป้ง 184 500g'), null);
});

test('unsigned webhook is rejected and signed webhook replies', async () => {
  const env = {LINE_CHANNEL_SECRET:'test-secret', LINE_CHANNEL_ACCESS_TOKEN:'test-token'};
  const body = JSON.stringify({events:[{type:'message',replyToken:'reply-token',message:{type:'text',text:'400 ml ฿159\n500 ml ฿184'}}]});
  const url = 'https://pricewise-family.pages.dev/api/line';
  assert.equal((await onRequestPost({request:new Request(url,{method:'POST',body}),env})).status, 401);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LINE_CHANNEL_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('base64');
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (target, options) => {
    assert.equal(target, 'https://api.line.me/v2/bot/message/reply');
    sent = JSON.parse(options.body);
    return new Response(null,{status:200});
  };
  try {
    const request = new Request(url,{method:'POST',headers:{'x-line-signature':signature},body});
    assert.equal((await onRequestPost({request,env})).status, 200);
    assert.equal(sent.replyToken, 'reply-token');
    assert.match(sent.messages[0].text, /7\.42%/);
  } finally { globalThis.fetch = originalFetch; }
});
