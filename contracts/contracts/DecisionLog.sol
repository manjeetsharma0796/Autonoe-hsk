// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DecisionLog — on-chain AI-performance benchmark (PRD §8, T-105)
/// @notice Records every executed AI decision + outcome. Both AMM swaps and
///         synthetic positions log here identically. `pnl` is signed.
contract DecisionLog {
    struct Decision {
        address user;
        bytes32 thesisHash;
        bytes32 verdictHash;
        string asset;
        uint256 amountIn;
        uint256 amountOut;
        int256 pnl;
        string optionRef;
        uint256 timestamp;
    }

    Decision[] public decisions;
    mapping(address => uint256[]) public userDecisions;

    event DecisionLogged(
        uint256 indexed id,
        address indexed user,
        bytes32 thesisHash,
        bytes32 verdictHash,
        string asset,
        uint256 amountIn,
        uint256 amountOut,
        int256 pnl,
        string optionRef
    );

    function logDecision(
        bytes32 thesisHash,
        bytes32 verdictHash,
        string calldata asset,
        uint256 amountIn,
        uint256 amountOut,
        int256 pnl,
        string calldata optionRef
    ) external returns (uint256 id) {
        id = decisions.length;
        decisions.push(
            Decision(
                msg.sender,
                thesisHash,
                verdictHash,
                asset,
                amountIn,
                amountOut,
                pnl,
                optionRef,
                block.timestamp
            )
        );
        userDecisions[msg.sender].push(id);
        emit DecisionLogged(
            id,
            msg.sender,
            thesisHash,
            verdictHash,
            asset,
            amountIn,
            amountOut,
            pnl,
            optionRef
        );
    }

    function decisionsLength() external view returns (uint256) {
        return decisions.length;
    }

    function getUserDecisions(address user) external view returns (uint256[] memory) {
        return userDecisions[user];
    }

    function getDecision(uint256 id) external view returns (Decision memory) {
        return decisions[id];
    }
}
