import {config} from './config.js';
import {equity,log,setAgent,trades} from './state.js';
import type {Candidate,Decision,Trade} from './types.js';

export async function considerBuy(c:Candidate,d:Decision){
 if(!d.accepted){setAgent('SNIPER','BLOCKED',`${c.symbol} 未通过七项规则，禁止下单`);return null;}
 if(config.mode!=='paper'){
  setAgent('SNIPER','BLOCKED','LIVE 模式未启用：缺少经审计的受限签名器与交易适配器');
  log('GUARD','BLOCK','拒绝真实签名：当前构建不包含可提现权限的钱包签名器'); return null;
 }
 setAgent('GUARD','RUNNING','检查仓位上限、止损与模拟资金');
 const last=equity.at(-1)?.value??1000; const amountUsd=Math.min(last*config.maxPositionPct/100,last);
 const t:Trade={id:crypto.randomUUID(),mint:c.mint,symbol:c.symbol,side:'BUY',mode:'PAPER',status:'PAPER_FILLED',amountUsd,pnlUsd:0,createdAt:new Date().toISOString()};
 trades.unshift(t); setAgent('GUARD','OK',`仓位 ${config.maxPositionPct}% 上限；预设止损 -${config.stopLossPct}%`); setAgent('SNIPER','OK',`模拟买入 ${c.symbol} $${amountUsd.toFixed(2)}`); setAgent('SCRIBE','OK','交易及风险参数已写入日志'); log('SNIPER','PAPER',`${c.symbol} paper buy $${amountUsd.toFixed(2)}`); return t;
}
