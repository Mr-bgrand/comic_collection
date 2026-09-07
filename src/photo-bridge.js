/** Temporary LAN companion. Pairing grants photo intake only, never full Admin. */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import { PHOTO_LIMIT, searchPhotoRecords, getPhotoRecord, readPhotoImage } from './photo-store.js';

export const sendPhotoJson = (res,status,body) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
export async function photoBody(req, limit = PHOTO_LIMIT) {
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if(length>limit)throw Object.assign(new Error('Choose a photo smaller than 20 MB.'),{status:413}); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export async function photoRoute(req,res,url,{root,save,source='owner-upload',prefix='/api/admin/photos'}) {
  const route = url.pathname.slice(prefix.length), id = url.searchParams.get('id');
  if(req.method==='GET'&&route==='/search')sendPhotoJson(res,200,{records:await searchPhotoRecords(root,url.searchParams.get('q'))});
  else if(req.method==='GET'&&route==='/record')sendPhotoJson(res,200,{record:await getPhotoRecord(root,id)});
  else if(req.method==='GET'&&route==='/image') { const bytes=await readPhotoImage(root,id,url.searchParams.get('side'));res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store'});res.end(bytes); }
  else if(req.method==='POST'&&route==='/save') {
    if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Choose an image file.'),{status:415});
    const input=await photoBody(req);
    sendPhotoJson(res,200,await save({id,side:url.searchParams.get('side'),revision:req.headers['x-record-revision'],input,source}));
  } else sendPhotoJson(res,404,{error:'Photo action not found.'});
}

export function lanAddresses() {
  return [...new Set(Object.entries(networkInterfaces()).filter(([name])=>!/vEthernet|WSL|docker|virtual|loopback/i.test(name)).flatMap(([,list])=>list).filter(a=>a&&a.family==='IPv4'&&!a.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)).map(a=>a.address))];
}
export function createPhotoBridge({root,save,port=4176,addresses=lanAddresses,now=()=>Date.now(),ttl=30*60*1000}) {
  const sessions=new Map();let server=null,starting=null;
  function active(token) {
    const session=sessions.get(token);
    if(!session||session.expiresAt<=now()) {sessions.delete(token);throw Object.assign(new Error('This camera link expired. Pair your phone again from Admin → Photos.'),{status:401});}
    return session;
  }
  async function start() {
    if(server)return;if(starting)return starting;
    starting=(async()=>{
      const listener=createServer(async(req,res)=>{
        res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
        res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
        try {
          const origin=new URL(`http://${req.headers.host}`),allowed=['127.0.0.1','localhost',...addresses()];
          if(!allowed.includes(origin.hostname)||(req.headers.origin&&req.headers.origin!==origin.origin)||req.headers['sec-fetch-site']==='cross-site')return sendPhotoJson(res,403,{error:'Open the paired camera link on the same Wi-Fi.'});
          const url=new URL(req.url,origin);
          const assets={'/capture/':['phone-capture.html','text/html; charset=utf-8'],'/capture/photo-intake.mjs':['photo-intake.mjs','text/javascript'],'/capture/photo-intake.css':['photo-intake.css','text/css'],'/capture/phone-capture.mjs':['phone-capture.mjs','text/javascript'],'/capture/photo-intake.html':['photo-intake.html','text/html; charset=utf-8']};
          if(req.method==='GET'&&assets[url.pathname]) {
            const [file,mime]=assets[url.pathname];res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});return res.end(await readFile(path.join(root,'docs/prototypes',file)));
          }
          if(!url.pathname.startsWith('/api/capture/'))return sendPhotoJson(res,404,{error:'Not found.'});
          const token=(req.headers.authorization||'').replace(/^Bearer /,''),session=active(token);
          session.lastSeenAt=now();
          if(req.method==='GET'&&url.pathname==='/api/capture/session')return sendPhotoJson(res,200,{record:await getPhotoRecord(root,session.initialId),expiresAt:new Date(session.expiresAt).toISOString()});
          await photoRoute(req,res,url,{root,prefix:'/api/capture',source:'phone-upload',save:async body=>{
            active(token);const result=await save(body,()=>active(token));session.saved++;return result;
          }});
        }catch(error){if(!res.headersSent)sendPhotoJson(res,error.status||400,{error:error.code==='ENOENT'?'Photo file unavailable.':error.message});}
      });
      await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(port,'0.0.0.0',resolve);});server=listener;
    })().finally(()=>{starting=null;});return starting;
  }
  return {
    async pair(id) {
      await getPhotoRecord(root,id);
      const hosts=addresses();if(!hosts.length)throw new Error('Connect this computer to Wi-Fi or Ethernet to pair a phone.');
      await start();for(const [key,s] of sessions)if(s.expiresAt<=now())sessions.delete(key);
      if(sessions.size>=10)throw new Error('Disconnect an existing camera link before pairing another phone.');
      const token=randomBytes(24).toString('base64url'),pairingId=randomBytes(12).toString('hex'),expiresAt=now()+ttl;
      sessions.set(token,{pairingId,initialId:id,expiresAt,lastSeenAt:null,saved:0});
      const links=await Promise.all(hosts.map(async host=>{const url=`http://${host}:${server.address().port}/capture/#${token}`;return {host,url,qr:await QRCode.toDataURL(url,{width:240,margin:2,errorCorrectionLevel:'M'})};}));
      return {pairingId,expiresAt:new Date(expiresAt).toISOString(),links};
    },
    status(pairingId) { const s=[...sessions.values()].find(s=>s.pairingId===pairingId);return {active:!!s&&s.expiresAt>now(),connected:!!s?.lastSeenAt,saved:s?.saved||0}; },
    revoke(pairingId) { for(const [token,s] of sessions)if(s.pairingId===pairingId)sessions.delete(token); },
    async close() {sessions.clear();if(starting)await starting.catch(()=>{});if(server){server.closeAllConnections();await new Promise(r=>server.close(r));server=null;}},
    address:()=>server?.address()
  };
}
