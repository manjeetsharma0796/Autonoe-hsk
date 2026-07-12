// Minimal const ABIs — only the functions the chain lib calls, typed `as const`
// so viem can infer argument/return types. Full ABIs live in ../abis/*.json.

export const erc20Abi = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;

export const musdAbi = [
  ...erc20Abi,
  { type: 'function', name: 'faucet', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export const wmntAbi = [
  ...erc20Abi,
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

export const routerAbi = [
  { type: 'function', name: 'getAmountsOut', stateMutability: 'view', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'getReserves', stateMutability: 'view', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { type: 'function', name: 'swapExactTokensForTokens', stateMutability: 'nonpayable', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'amountOutMin', type: 'uint256' }, { name: 'path', type: 'address[]' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'addLiquidity', stateMutability: 'nonpayable', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'amountADesired', type: 'uint256' }, { name: 'amountBDesired', type: 'uint256' }, { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
] as const;

export const oracleAbi = [
  { type: 'function', name: 'verifyPrice', stateMutability: 'view', inputs: [{ name: 'symbol', type: 'string' }, { name: 'priceX18', type: 'uint256' }, { name: 'timestamp', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'priceDigest', stateMutability: 'view', inputs: [{ name: 'symbol', type: 'string' }, { name: 'priceX18', type: 'uint256' }, { name: 'timestamp', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'trustedSigner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'maxAge', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export const syntheticAbi = [
  { type: 'function', name: 'openPosition', stateMutability: 'nonpayable', inputs: [{ name: 'symbol', type: 'string' }, { name: 'isLong', type: 'bool' }, { name: 'sizeMUSD', type: 'uint256' }, { name: 'priceX18', type: 'uint256' }, { name: 'timestamp', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'closePosition', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'priceX18', type: 'uint256' }, { name: 'timestamp', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [{ type: 'int256' }, { type: 'uint256' }] },
  { type: 'function', name: 'reserve', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'isMarket', stateMutability: 'view', inputs: [{ name: 'symbol', type: 'string' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'positionsLength', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getTraderPositions', stateMutability: 'view', inputs: [{ name: 'trader', type: 'address' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'getPosition', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ components: [{ name: 'trader', type: 'address' }, { name: 'symbol', type: 'string' }, { name: 'isLong', type: 'bool' }, { name: 'sizeMUSD', type: 'uint256' }, { name: 'entryPriceX18', type: 'uint256' }, { name: 'open', type: 'bool' }], type: 'tuple' }] },
  { type: 'event', name: 'PositionOpened', inputs: [{ name: 'id', type: 'uint256', indexed: true }, { name: 'trader', type: 'address', indexed: true }, { name: 'symbol', type: 'string', indexed: false }, { name: 'isLong', type: 'bool', indexed: false }, { name: 'sizeMUSD', type: 'uint256', indexed: false }, { name: 'entryPriceX18', type: 'uint256', indexed: false }] },
] as const;

export const decisionLogAbi = [
  { type: 'function', name: 'logDecision', stateMutability: 'nonpayable', inputs: [{ name: 'thesisHash', type: 'bytes32' }, { name: 'verdictHash', type: 'bytes32' }, { name: 'asset', type: 'string' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOut', type: 'uint256' }, { name: 'pnl', type: 'int256' }, { name: 'optionRef', type: 'string' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decisionsLength', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getUserDecisions', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'getDecision', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ components: [{ name: 'user', type: 'address' }, { name: 'thesisHash', type: 'bytes32' }, { name: 'verdictHash', type: 'bytes32' }, { name: 'asset', type: 'string' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOut', type: 'uint256' }, { name: 'pnl', type: 'int256' }, { name: 'optionRef', type: 'string' }, { name: 'timestamp', type: 'uint256' }], type: 'tuple' }] },
  { type: 'event', name: 'DecisionLogged', inputs: [{ name: 'id', type: 'uint256', indexed: true }, { name: 'user', type: 'address', indexed: true }, { name: 'thesisHash', type: 'bytes32', indexed: false }, { name: 'verdictHash', type: 'bytes32', indexed: false }, { name: 'asset', type: 'string', indexed: false }, { name: 'amountIn', type: 'uint256', indexed: false }, { name: 'amountOut', type: 'uint256', indexed: false }, { name: 'pnl', type: 'int256', indexed: false }, { name: 'optionRef', type: 'string', indexed: false }] },
] as const;
