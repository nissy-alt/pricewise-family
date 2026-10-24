import {replyForText, HELP} from '../../line-bot.js';

const textResponse = (text, status) => new Response(text, {status, headers:{'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store'}});

async function verifySignature(body, signature, secret) {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
  const received = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, received, new TextEncoder().encode(body));
}

export async function onRequestPost({request, env}) {
  if (!env?.LINE_CHANNEL_SECRET || !env?.LINE_CHANNEL_ACCESS_TOKEN) return textResponse('LINE bot not configured', 503);
  if (Number(request.headers.get('content-length') || 0) > 65536) return textResponse('Payload too large', 413);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 65536) return textResponse('Payload too large', 413);
  if (!await verifySignature(body, request.headers.get('x-line-signature'), env.LINE_CHANNEL_SECRET)) return textResponse('Invalid signature', 401);
  let payload;
  try { payload = JSON.parse(body); } catch { return textResponse('Invalid JSON', 400); }
  if (!Array.isArray(payload.events)) return textResponse('Invalid events', 400);
  for (const event of payload.events) {
    if (!event.replyToken) continue;
    let message;
    if (event.type === 'follow') message = HELP;
    else if (event.type === 'message' && event.message?.type === 'text') message = replyForText(event.message.text);
    else continue;
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method:'POST',
      headers:{'authorization':`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'content-type':'application/json'},
      body:JSON.stringify({replyToken:event.replyToken, messages:[{type:'text', text:message}]})
    });
    if (!response.ok) return textResponse('LINE reply failed', 502);
  }
  return textResponse('OK', 200);
}

export function onRequestGet() { return textResponse('Method not allowed', 405); }
