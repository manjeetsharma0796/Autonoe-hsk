// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PriceOracle — signed-pull (Pyth-style) price oracle (PRD §8, T-110)
/// @notice No standing keeper. The server signs `{symbol, priceX18, timestamp}`
///         with a trusted signer key; a trade submits that attestation and this
///         contract verifies the signature + freshness on-chain. `priceX18` is the
///         mUSD price of 1 unit of the asset, scaled by 1e18.
contract PriceOracle is Ownable {
    address public trustedSigner;
    uint256 public maxAge = 5 minutes;
    uint256 public constant FUTURE_SKEW = 60; // tolerate small clock skew

    event SignerUpdated(address indexed signer);
    event MaxAgeUpdated(uint256 maxAge);

    constructor(address _signer) Ownable(msg.sender) {
        require(_signer != address(0), "ZERO_SIGNER");
        trustedSigner = _signer;
    }

    function setSigner(address s) external onlyOwner {
        require(s != address(0), "ZERO_SIGNER");
        trustedSigner = s;
        emit SignerUpdated(s);
    }

    function setMaxAge(uint256 a) external onlyOwner {
        maxAge = a;
        emit MaxAgeUpdated(a);
    }

    /// @notice The message digest the server must sign (EIP-191 personal-sign).
    ///         Binds chain id + this oracle address to prevent cross-context replay.
    function priceDigest(string memory symbol, uint256 priceX18, uint256 timestamp)
        public
        view
        returns (bytes32)
    {
        bytes32 inner = keccak256(abi.encode(block.chainid, address(this), symbol, priceX18, timestamp));
        return MessageHashUtils.toEthSignedMessageHash(inner);
    }

    /// @notice Reverts unless the attestation is fresh and signed by `trustedSigner`.
    /// @return true on success (so callers can `require(oracle.verifyPrice(...))`).
    function verifyPrice(
        string calldata symbol,
        uint256 priceX18,
        uint256 timestamp,
        bytes calldata signature
    ) external view returns (bool) {
        require(priceX18 > 0, "ZERO_PRICE");
        require(timestamp <= block.timestamp + FUTURE_SKEW, "FUTURE_TIMESTAMP");
        require(block.timestamp <= timestamp + maxAge, "STALE_PRICE");
        address signer = ECDSA.recover(priceDigest(symbol, priceX18, timestamp), signature);
        require(signer == trustedSigner, "BAD_SIGNER");
        return true;
    }
}
