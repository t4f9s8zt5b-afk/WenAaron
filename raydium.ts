import type { SwapIntent, UnsignedSwap } from './types.js';
import { assertIntent } from './types.js';

const BASE = 'https://transaction-v1.raydium.io';

/** Fetches a fresh Raydium quote and returns an unsigned transaction. Never signs or broadcasts. */
export async function buildRaydiumUnsigned(i: SwapIntent): Promise<{ quote: unknown; swap: UnsignedSwap }> {
  assertIntent(i);
  if (!/^\d+$/.test(i.amount)) throw new Error('Raydium amount must be an integer in base units');
  const slippageBps = i.slippageBps;
  const q = new URL(`${BASE}/compute/swap-base-in`);
  q.search = new URLSearchParams({ inputMint: i.inputMint, outputMint: i.outputMint, amount: i.amount, slippageBps: String(slippageBps), txVersion: 'V0' }).toString();
  const quoteRes = await fetch(q, { signal: AbortSignal.timeout(10_000) });
  if (!quoteRes.ok) throw new Error(`Raydium quote HTTP ${quoteRes.status}`);
  const quote: any = await quoteRes.json();
  if (!quote?.success || !quote?.data) throw new Error(`Raydium quote rejected: ${quote?.msg ?? 'no route'}`);
  const buildRes = await fetch(`${BASE}/transaction/swap-base-in`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ computeUnitPriceMicroLamports: '50000', swapResponse: quote, txVersion: 'V0', wallet: i.wallet, wrapSol: true, unwrapSol: true }),
    signal: AbortSignal.timeout(15_000)
  });
  if (!buildRes.ok) throw new Error(`Raydium build HTTP ${buildRes.status}`);
  const built: any = await buildRes.json();
  const tx = built?.data?.[0]?.transaction;
  if (!built?.success || typeof tx !== 'string') throw new Error(`Raydium build rejected: ${built?.msg ?? 'missing transaction'}`);
  return { quote, swap: { provider: 'raydium', transactionBase64: tx, expiresAt: Date.now() + 25_000, summary: { inputMint: i.inputMint, outputMint: i.outputMint, amount: i.amount, slippageBps } } };
}
