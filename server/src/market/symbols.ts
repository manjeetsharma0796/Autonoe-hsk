// GET /api/symbols - re-exports getAllTickers from bybit.ts under the route-handler name.
// Keeping this as a thin adapter lets app.ts import a name that matches the domain.

export { getAllTickers as getSymbols } from './bybit.ts';
