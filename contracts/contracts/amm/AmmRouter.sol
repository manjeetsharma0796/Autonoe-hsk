// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAmmFactory {
    function getPair(address, address) external view returns (address);
    function createPair(address, address) external returns (address);
}

interface IAmmPair {
    function getReserves() external view returns (uint112, uint112);
    function mint(address) external returns (uint256);
    function swap(uint256, uint256, address) external;
}

/// @title AmmRouter — Uniswap-V2-style Router02 subset (T-104)
/// @notice The contract callers use to add liquidity and swap. Mirrors the V2
///         external surface the chain lib (T-108) expects: addLiquidity,
///         swapExactTokensForTokens, getAmountsOut, quote.
contract AmmRouter {
    address public immutable factory;

    constructor(address _factory) {
        factory = _factory;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    function _sortTokens(address a, address b) internal pure returns (address t0, address t1) {
        (t0, t1) = a < b ? (a, b) : (b, a);
    }

    function _reserves(address tokenA, address tokenB)
        internal
        view
        returns (uint256 rA, uint256 rB, address pair)
    {
        pair = IAmmFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) return (0, 0, address(0));
        (uint112 r0, uint112 r1) = IAmmPair(pair).getReserves();
        (address t0, ) = _sortTokens(tokenA, tokenB);
        (rA, rB) = tokenA == t0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
    }

    function getReserves(address tokenA, address tokenB) public view returns (uint256 rA, uint256 rB) {
        (rA, rB, ) = _reserves(tokenA, tokenB);
    }

    function quote(uint256 amountA, uint256 rA, uint256 rB) public pure returns (uint256) {
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        require(rA > 0 && rB > 0, "INSUFFICIENT_LIQUIDITY");
        return (amountA * rB) / rA;
    }

    /// @notice Constant-product output with the 0.30% fee.
    function getAmountOut(uint256 amountIn, uint256 rIn, uint256 rOut) public pure returns (uint256) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(rIn > 0 && rOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        return (amountInWithFee * rOut) / (rIn * 1000 + amountInWithFee);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 rIn, uint256 rOut) = getReserves(path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], rIn, rOut);
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (uint256 rA, uint256 rB, address pair) = _reserves(tokenA, tokenB);
        if (pair == address(0)) {
            pair = IAmmFactory(factory).createPair(tokenA, tokenB);
        }

        if (rA == 0 && rB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, rA, rB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, rB, rA);
                require(amountAOptimal >= amountAMin, "INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        IERC20(tokenA).transferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).transferFrom(msg.sender, pair, amountB);
        liquidity = IAmmPair(pair).mint(to);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        address pair0 = IAmmFactory(factory).getPair(path[0], path[1]);
        IERC20(path[0]).transferFrom(msg.sender, pair0, amounts[0]);
        _swap(amounts, path, to);
    }

    function _swap(uint256[] memory amounts, address[] calldata path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = _sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? IAmmFactory(factory).getPair(output, path[i + 2])
                : _to;
            IAmmPair(IAmmFactory(factory).getPair(input, output)).swap(amount0Out, amount1Out, to);
        }
    }
}
