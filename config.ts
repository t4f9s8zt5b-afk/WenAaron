import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT ?? 8787), host: process.env.HOST ?? '0.0.0.0',
  mode: (process.env.TRADING_MODE ?? 'paper').toLowerCase(),
  maxPositionPct: Number(process.env.MAX_POSITION_PCT ?? 10), stopLossPct: Number(process.env.STOP_LOSS_PCT ?? 6),
  minLiquidityUsd: Number(process.env.MIN_LIQUIDITY_USD ?? 40000), maxTop10Pct: Number(process.env.MAX_TOP10_PCT ?? 25),
  maxCreatorPct: Number(process.env.MAX_CREATOR_HOLDING_PCT ?? 3), maxInitialAllocationPct: Number(process.env.MAX_INITIAL_ALLOCATION_PCT ?? 10),
  minLpLockDays: Number(process.env.MIN_LP_LOCK_DAYS ?? 30), scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS ?? 30000),
  dexBase: process.env.DEXSCREENER_BASE ?? 'https://api.dexscreener.com', xaiKey: process.env.XAI_API_KEY ?? '', xaiModel: process.env.XAI_MODEL ?? 'grok-4.7',
  fomoReferral: process.env.FOMO_REFERRAL_URL ?? 'https://fomo.family/r/NFTCPS'
};
