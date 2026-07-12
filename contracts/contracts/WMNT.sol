// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title WMNT — Wrapped HSK (WETH-style wrapper, PRD §7)
/// @notice Deposit native HSK to mint 1:1 WHSK; withdraw to burn and reclaim HSK.
///         WHSK is the ERC-20 the AMM trades (the real `mUSD/WHSK` pool).
contract WMNT is ERC20 {
    event Deposit(address indexed dst, uint256 amount);
    event Withdrawal(address indexed src, uint256 amount);

    constructor() ERC20("Wrapped HSK", "WHSK") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "HSK_TRANSFER_FAILED");
        emit Withdrawal(msg.sender, amount);
    }

    receive() external payable {
        deposit();
    }
}
