// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title mUSD — mock USD test stablecoin (PRD §7)
/// @notice 6-decimal ERC-20, the single settlement currency. Public `faucet()`
///         with a per-address cooldown + balance cap, plus `ownerMint` for seeding.
contract MUSD is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    /// @notice Amount minted per faucet call (10,000 mUSD).
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** DECIMALS;
    /// @notice Minimum time between faucet calls for one address.
    uint256 public constant FAUCET_COOLDOWN = 8 hours;
    /// @notice Faucet is refused if the caller already holds at least this much.
    uint256 public constant FAUCET_MAX_BALANCE = 100_000 * 10 ** DECIMALS;

    mapping(address => uint256) public lastFaucet;

    constructor() ERC20("Mock USD", "mUSD") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Mint the faucet amount to the caller (cooldown + cap enforced).
    function faucet() external {
        require(balanceOf(msg.sender) < FAUCET_MAX_BALANCE, "FAUCET_CAP");
        require(
            block.timestamp - lastFaucet[msg.sender] >= FAUCET_COOLDOWN,
            "FAUCET_COOLDOWN"
        );
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner seeding mint (liquidity, house reserve, demo wallets).
    function ownerMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
