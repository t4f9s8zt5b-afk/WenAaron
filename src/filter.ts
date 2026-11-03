import {config} from './config.js';
import {decisions,log,setAgent} from './state.js';
import type {Candidate,Check,Decision} from './types.js';

// Risk evidence is intentionally fail-closed. Do not replace unknown with a pass.
async function rugcheck(mint:string){
 const base=process.env.RUGCHECK_API_BASE??'https://api.rugcheck.xyz';
 const r=await fetch(`${base}/v1/tokens/${mint}/report`,{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`RugCheck unavailable (${r.status})`); return r.json() as Promise<any>;
}
export async function evaluate(c:Candidate):Promise<Decision>{
 setAgent('FILTER','RUNNING',`检查 ${c.symbol} 七项硬性规则`);
 let report:any=null,reportError='';
 try{report=await rugcheck(c.mint)}catch(e){reportError=String(e)}
 const risks:any[]=report?.risks??[];
 const mintAuth=report?.token?.mintAuthority??report?.mintAuthority;
 const freezeAuth=report?.token?.freezeAuthority??report?.freezeAuthority;
 const top10=report?.topHoldersPct??report?.topHolders?.reduce?.((s:number,h:any)=>s+(Number(h.pct)||0),0);
 const creator=report?.creatorBalancePct??report?.creatorPct;
 const lpLockedDays=report?.lpLockDurationDays??report?.lpLockedDays;
 const lpBurned=report?.lpBurned;
 const initialAllocation=report?.initialLiquidityPercentage??report?.initialAllocationPct;
 const honeypot=report?.honeypot;
 const sellTax=report?.sellTax;
 const rugHistory=report?.creator?.rugPullHistory??report?.creatorRugHistory;
 const hasRisk=(terms:string[])=>risks.some(x=>terms.some(t=>String(x.name??x.description??x).toLowerCase().includes(t)));
 const checks:Check[]=[
  {id:1,key:'lp',label:'流动性销毁或锁仓至少 30 天',passed:lpBurned===true?true:typeof lpLockedDays==='number'?lpLockedDays>=config.minLpLockDays:null,detail:lpBurned===true?'已销毁':typeof lpLockedDays==='number'?`锁仓 ${lpLockedDays} 天`:reportError||'缺少可验证的 LP 销毁/锁仓证明'},
  {id:2,key:'authority',label:'Mint / Freeze 权限均已撤销',passed:mintAuth===null&&freezeAuth===null?true:mintAuth||freezeAuth?false:null,detail:`mint=${mintAuth??'未知'} / freeze=${freezeAuth??'未知'}`},
  {id:3,key:'holders',label:'排除 LP 后前十大持仓不超过 25%',passed:typeof top10==='number'?top10<=config.maxTop10Pct:null,detail:typeof top10==='number'?`前十大 ${top10.toFixed(2)}%`:'缺少排除 LP 后持仓数据'},
  {id:4,key:'creator',label:'项目方持仓不超过 3% 且无跑路前科',passed:typeof creator==='number'&&rugHistory===false?creator<=config.maxCreatorPct:typeof creator==='number'&&rugHistory===true?false:null,detail:typeof creator==='number'?`项目方 ${creator.toFixed(2)}%；跑路记录=${rugHistory??'未知'}`:'缺少项目方钱包归属/持仓与历史数据'},
  {id:5,key:'allocation',label:'上线初始批量配售不超过 10%',passed:typeof initialAllocation==='number'?initialAllocation<=config.maxInitialAllocationPct:null,detail:typeof initialAllocation==='number'?`初始配售 ${initialAllocation.toFixed(2)}%`:'缺少初始分配证据'},
  {id:6,key:'honeypot',label:'通过蜜罐检测且无卖出税',passed:honeypot===false&&Number(sellTax??0)===0?true:honeypot===true||Number(sellTax??0)>0?false:null,detail:`honeypot=${honeypot??'未知'} / sellTax=${sellTax??'未知'}`},
  {id:7,key:'liquidity',label:'流动性至少 40,000 美元',passed:c.liquidityUsd>=config.minLiquidityUsd,detail:`$${c.liquidityUsd.toLocaleString('en-US',{maximumFractionDigits:0})}`}
 ];
 const accepted=checks.every(x=>x.passed===true); const reasons=checks.filter(x=>x.passed!==true).map(x=>`${x.label}：${x.detail}${x.passed===null?'（无法验证，按失败处理）':''}`);
 const d:Decision={mint:c.mint,symbol:c.symbol,accepted,checks,reasons,createdAt:new Date().toISOString()}; decisions.unshift(d); if(decisions.length>500)decisions.length=500;
 setAgent('FILTER',accepted?'OK':'BLOCKED',accepted?`${c.symbol} 七项全通过`:`${c.symbol} 已拒绝：${reasons.length} 项未通过`);
 setAgent('ANALYST','OK','基础链上风控数据已归档；AI 仅可解释证据，不可覆盖硬规则');
 setAgent('SCRIBE','OK',`已记录 ${c.symbol} ${accepted?'通过':'拒绝'}及逐项原因`);
 log('FILTER',accepted?'PASS':'REJECT',`${c.symbol}: ${reasons.join(' | ')||'7/7 PASS'}`);
 return d;
}
