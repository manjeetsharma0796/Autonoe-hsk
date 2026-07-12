// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PriceOracle} from "./PriceOracle.sol";

/// @title SyntheticExchange — oracle-priced mUSD clearing house (PRD §8b, T-111)
/// @notice Opens/closes synthetic positions settled in mUSD against PriceOracle.
///         A treasury-funded house reserve pays winners. Supports long & short.
///         `sizeMUSD` is collateral (6-dec mUSD). Prices are 1e18-scaled mUSD/asset.
///         PnL: `sizeMUSD * (closePrice - entryPrice) / entryPrice`, sign by side.
contract SyntheticExchange is Ownable {
    IERC20 public immutable mUSD;
    PriceOracle public oracle;

    struct Position {
        address trader;
        string symbol;
        bool isLong;
        uint256 sizeMUSD;
        uint256 entryPriceX18;
        bool open;
    }

    Position[] public positions;
    mapping(address => uint256[]) public traderPositions;
    mapping(bytes32 => bool) public marketRegistered;

    event MarketRegistered(string symbol);
    event PositionOpened(
        uint256 indexed id,
        address indexed trader,
        string symbol,
        bool isLong,
        uint256 sizeMUSD,
        uint256 entryPriceX18
    );
    event PositionClosed(
        uint256 indexed id,
        address indexed trader,
        uint256 closePriceX18,
        int256 pnl,
        uint256 payout
    );
    event ReserveFunded(address indexed from, uint256 amount);

    constructor(IERC20 _mUSD, PriceOracle _oracle) Ownable(msg.sender) {
        mUSD = _mUSD;
        oracle = _oracle;
    }

    function setOracle(PriceOracle _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function registerMarket(string calldata symbol) external onlyOwner {
        marketRegistered[keccak256(bytes(symbol))] = true;
        emit MarketRegistered(symbol);
    }

    function isMarket(string calldata symbol) external view returns (bool) {
        return marketRegistered[keccak256(bytes(symbol))];
    }

    /// @notice Add mUSD to the house reserve (treasury seeding).
    function fundReserve(uint256 amount) external {
        require(mUSD.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice Total mUSD held (house reserve + open-position collateral).
    function reserve() public view returns (uint256) {
        return mUSD.balanceOf(address(this));
    }

    function openPosition(
        string calldata symbol,
        bool isLong,
        uint256 sizeMUSD,
        uint256 priceX18,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (uint256 id) {
        require(marketRegistered[keccak256(bytes(symbol))], "UNKNOWN_MARKET");
        require(sizeMUSD > 0, "ZERO_SIZE");
        oracle.verifyPrice(symbol, priceX18, timestamp, signature);

        require(mUSD.transferFrom(msg.sender, address(this), sizeMUSD), "TRANSFER_FAILED");

        id = positions.length;
        positions.push(Position(msg.sender, symbol, isLong, sizeMUSD, priceX18, true));
        traderPositions[msg.sender].push(id);
        emit PositionOpened(id, msg.sender, symbol, isLong, sizeMUSD, priceX18);
    }

    function closePosition(
        uint256 id,
        uint256 priceX18,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (int256 pnl, uint256 payout) {
        Position storage p = positions[id];
        require(p.open, "ALREADY_CLOSED");
        require(p.trader == msg.sender, "NOT_OWNER");
        oracle.verifyPrice(p.symbol, priceX18, timestamp, signature);

        p.open = false;

        int256 delta = int256(priceX18) - int256(p.entryPriceX18);
        int256 dir = p.isLong ? int256(1) : int256(-1);
        pnl = (int256(p.sizeMUSD) * delta * dir) / int256(p.entryPriceX18);

        int256 payoutSigned = int256(p.sizeMUSD) + pnl;
        if (payoutSigned < 0) payoutSigned = 0;
        payout = uint256(payoutSigned);

        require(reserve() >= payout, "INSUFFICIENT_RESERVE");
        require(mUSD.transfer(msg.sender, payout), "TRANSFER_FAILED");
        emit PositionClosed(id, msg.sender, priceX18, pnl, payout);
    }

    function positionsLength() external view returns (uint256) {
        return positions.length;
    }

    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        return traderPositions[trader];
    }

    function getPosition(uint256 id) external view returns (Position memory) {
        return positions[id];
    }
}
