export type SwapSide = 'buy' | 'sell';
export interface SwapIntent {
  side: SwapSide;
  mint: string;
  amount: string; // raw integer amount for Raydium; PumpPortal amount follows its documented denomination
  inputMint: string;
  outputMint: string;
  slippageBps: number;
  wallet: string;
}
export interface UnsignedSwap {
  provider: 'raydium' | 'pumpportal';
  transactionBase64: string;
  expiresAt: number;
  summary: { inputMint: string; outputMint: string; amount: string; slippageBps: number };
}

export function assertIntent(i: SwapIntent) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(i.mint) || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(i.wallet)) throw new Error('Invalid Solana address');
  if (!/^(?:\d+)(?:\.\d+)?$/.test(i.amount) || Number(i.amount) <= 0 || !Number.isFinite(Number(i.amount))) throw new Error('Amount must be a positive decimal string');
  if (!Number.isInteger(i.slippageBps) || i.slippageBps < 1 || i.slippageBps > 300) throw new Error('Slippage must be 1-300 bps');
}
