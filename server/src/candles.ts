// Candles endpoint logic - validates symbol and delegates to the Bybit kline helper.

import { ASSET_SYMBOLS, type AssetSymbol } from '@autonoe/shared';
import { getKline, type Candle } from './market/bybit.ts';

export type { Candle };

export async function getCandlesFor(
  symbol: string,
  interval: string,
  limit: number,
): Promise<Candle[]> {
  if (!(ASSET_SYMBOLS as readonly string[]).includes(symbol)) {
    throw Object.assign(new Error('unknown symbol'), { status: 400 });
  }
  return getKline(symbol as AssetSymbol, interval, limit);
}
