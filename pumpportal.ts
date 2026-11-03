import type { SwapIntent, UnsignedSwap } from './types.js';
import { assertIntent } from './types.js';

/** Uses PumpPortal Local Transaction API: returns an unsigned transaction only. */
export async function buildPumpPortalUnsigned(i: SwapIntent, opts: { amountInSol: boolean; priorityFeeSol?: number; pool?: string }): Promise<UnsignedSwap> {
  assertIntent(i);
  const body = new URLSearchParams({
    publicKey: i.wallet, action: i.side, mint: i.mint,
    amount: i.amount, denominatedInSol: String(opts.amountInSol),
    slippage: String(i.slippageBps / 100), priorityFee: String(opts.priorityFeeSol ?? 0.0001),
    pool: opts.pool ?? 'auto'
  });
  const res = await fetch('https://pumpportal.fun/api/trade-local', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(15_000)
  });
  if (!res.ok) throw new Error(`PumpPortal local trade HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 100) throw new Error('PumpPortal returned an invalid transaction payload');
  const transactionBase64 = Buffer.from(bytes).toString('base64');
  return { provider: 'pumpportal', transactionBase64, expiresAt: Date.now() + 20_000, summary: { inputMint: i.inputMint, outputMint: i.outputMint, amount: i.amount, slippageBps: i.slippageBps } };
}
