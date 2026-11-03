import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import {randomBytes,createPublicKey,verify as verifySignature} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {config} from './config.js';
import {agents,candidates,decisions,equity,events,log,trades} from './state.js';
import {scan} from './scout.js';
import {evaluate} from './filter.js';
import {considerBuy} from './trader.js';
const app=Fastify({logger:true,trustProxy:true});
// Wallet login proves address ownership only; it never grants transaction authority.
const challenges=new Map<string,{message:string;expires:number}>();
const sessions=new Map<string,{publicKey:string;expires:number}>();
let automationEnabled=false;
const paperBought=new Set<string>();
function decodeBase58(value:string):Buffer {
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n=0n;
 for(const ch of value){const i=alphabet.indexOf(ch);if(i<0)throw new Error('invalid_base58');n=n*58n+BigInt(i);}
 let hex=n===0n?'':n.toString(16);if(hex.length%2)hex='0'+hex;
 const body=hex?Buffer.from(hex,'hex'):Buffer.alloc(0);let zeros=0;while(zeros<value.length&&value[zeros]==='1')zeros++;
 return Buffer.concat([Buffer.alloc(zeros),body]);
}
function getSession(req:any){const token=req.cookies?.dawn_session;const session=token?sessions.get(token):undefined;if(!session||session.expires<Date.now())return null;return session;}

const __dirname=path.dirname(fileURLToPath(import.meta.url));
await app.register(websocket);
await app.register((await import('@fastify/cookie')).default,{secret:process.env.COOKIE_SECRET??randomBytes(32).toString('hex'),hook:'onRequest'});
await app.register(fastifyStatic,{root:path.resolve(__dirname,'../public'),prefix:'/'});
app.get('/api/status',async()=>({name:'DAWN',mode:config.mode,automationEnabled, liveEnabled:false,agents:Object.values(agents),candidateCount:candidates.size,accepted:decisions.filter(x=>x.accepted).length,rejected:decisions.filter(x=>!x.accepted).length,trades:trades.length,equity:equity.at(-1)?.value??1000,guard:{maxPositionPct:config.maxPositionPct,stopLossPct:config.stopLossPct,minLiquidityUsd:config.minLiquidityUsd,liveEnabled:false}}));

app.get('/api/auth/nonce',async(req:any,reply)=>{
 const nonce=randomBytes(18).toString('hex');
 const host=req.headers.host??'localhost';
 const message=`DAWN Wallet Sign-In\nDomain: ${host}\nNonce: ${nonce}\nPurpose: Verify wallet ownership only. No token approval or transfer permission is granted.\nIssued At: ${new Date().toISOString()}`;
 challenges.set(nonce,{message,expires:Date.now()+5*60*1000});
 return {nonce,message};
});
app.post('/api/auth/verify',async(req:any,reply)=>{
 try{
  const {publicKey,signature,nonce}=req.body??{};
  if(typeof publicKey!=='string'||typeof signature!=='string'||typeof nonce!=='string')return reply.code(400).send({error:'invalid_request'});
  const challenge=challenges.get(nonce);challenges.delete(nonce);
  if(!challenge||challenge.expires<Date.now())return reply.code(401).send({error:'challenge_expired'});
  const pub=decodeBase58(publicKey),sig=decodeBase58(signature);
  if(pub.length!==32||sig.length!==64)return reply.code(400).send({error:'invalid_key_or_signature'});
  const der=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),pub]);
  const key=createPublicKey({key:der,format:'der',type:'spki'});
  if(!verifySignature(null,Buffer.from(challenge.message,'utf8'),key,sig))return reply.code(401).send({error:'signature_invalid'});
  const token=randomBytes(32).toString('hex');sessions.set(token,{publicKey,expires:Date.now()+12*60*60*1000});
  reply.setCookie('dawn_session',token,{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:12*60*60});
  return {ok:true,publicKey,expiresIn:43200};
 }catch{return reply.code(400).send({error:'signature_verification_failed'});}
});
app.get('/api/auth/me',async(req:any)=>({authenticated:!!getSession(req),publicKey:getSession(req)?.publicKey??null}));
app.post('/api/auth/logout',async(req:any,reply)=>{const token=req.cookies?.dawn_session;if(token)sessions.delete(token);reply.clearCookie('dawn_session',{path:'/'});return {ok:true};});
app.post('/api/automation/enable',async(req:any,reply)=>{
 const session=getSession(req);if(!session)return reply.code(401).send({error:'wallet_sign_in_required'});
 if(config.mode!=='paper')return reply.code(403).send({error:'live_trading_disabled',message:'Live trading is disabled until the restricted signer and transaction policy have passed independent audit.'});
 automationEnabled=true;log('GUARD','PAPER','錢包已驗證；已啟用 PAPER 自動交易，沒有真實資金授權');
 return {ok:true,mode:'paper',publicKey:session.publicKey,automationEnabled};
});
app.post('/api/automation/disable',async(req:any,reply)=>{if(!getSession(req))return reply.code(401).send({error:'wallet_sign_in_required'});automationEnabled=false;log('GUARD','INFO','自動交易已由使用者停止');return {ok:true,automationEnabled};});

app.get('/api/candidates',async()=>[...candidates.values()]);
app.get('/api/decisions',async()=>decisions.slice(0,100));
app.get('/api/trades',async()=>trades.slice(0,100));
app.get('/api/events',async()=>events.slice(0,200));
app.get('/api/equity',async()=>equity);
app.post('/api/scan',async()=>{await scan();return {ok:true,candidates:candidates.size}});
app.post('/api/evaluate/:mint',async(req:any,reply)=>{const c=candidates.get(req.params.mint);if(!c)return reply.code(404).send({error:'candidate_not_found'});return evaluate(c)});
app.post('/api/paper-buy/:mint',async(req:any,reply)=>{const c=candidates.get(req.params.mint);if(!c)return reply.code(404).send({error:'candidate_not_found'});const d=decisions.find(x=>x.mint===c.mint);if(!d)return reply.code(409).send({error:'must_evaluate_first'});return considerBuy(c,d)});
app.get('/ws',{websocket:true},(socket)=>{const send=()=>socket.send(JSON.stringify({type:'snapshot',agents:Object.values(agents),events:events.slice(0,40),equity:equity.at(-1)?.value??1000}));send();const timer=setInterval(send,2000);socket.on('close',()=>clearInterval(timer));});
await app.listen({port:config.port,host:config.host});
log('SYSTEM','INFO',`DAWN started in ${config.mode} mode`);
await scan();
async function scheduledScan(){
 await scan();
 if(!automationEnabled||config.mode!=='paper')return;
 for(const c of candidates.values()){
  if(paperBought.has(c.mint))continue;
  const d=await evaluate(c);
  if(d.accepted){paperBought.add(c.mint);await considerBuy(c,d);}
 }
}
setInterval(()=>{void scheduledScan().catch(err=>log('SYSTEM','ERROR',String(err)));},config.scanIntervalMs);
