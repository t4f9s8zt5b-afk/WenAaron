import {config} from './config.js';
import {candidates,log,setAgent} from './state.js';
import type {Candidate} from './types.js';
const get = async (url:string)=>{const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)}); if(!r.ok)throw new Error(`HTTP ${r.status} ${url}`); return r.json() as Promise<any>};
export async function scan(){
 setAgent('SCOUT','RUNNING','扫描 DEX Screener 最新代币资料');
 try{
  // DexScreener latest profiles are discovery signals, not proof of a 7-day gain ranking.
  const profiles:any[]=await get(`${config.dexBase}/token-profiles/latest/v1`);
  const sol=profiles.filter(x=>x.chainId==='solana'&&x.tokenAddress).slice(0,80);
  for(const p of sol){
   try{
    const pairs:any[]=await get(`${config.dexBase}/token-pairs/v1/solana/${p.tokenAddress}`);
    const pair=pairs.filter(x=>x.chainId==='solana').sort((a,b)=>(b.liquidity?.usd??0)-(a.liquidity?.usd??0))[0];
    if(!pair)continue;
    const createdAt=pair.pairCreatedAt??undefined;
    // Restrict to pairs created in the last 7 days; missing timestamps fail closed.
    if(!createdAt||Date.now()-createdAt>7*86400000)continue;
    const c:Candidate={mint:p.tokenAddress,symbol:pair.baseToken?.symbol??'UNKNOWN',name:pair.baseToken?.name??'Unknown',pairAddress:pair.pairAddress,url:pair.url,liquidityUsd:pair.liquidity?.usd??0,priceUsd:Number(pair.priceUsd)||undefined,change24h:pair.priceChange?.h24,createdAt,source:pair.dexId??'DEX Screener'};
    candidates.set(c.mint,c);
   }catch{/* per-token transient failure: skip, never approve */}
  }
  setAgent('SCOUT','OK',`发现 ${candidates.size} 个近 7 天候选代币`); log('SCOUT','INFO','候选池已更新');
 }catch(e){setAgent('SCOUT','ERROR',String(e));}
}
