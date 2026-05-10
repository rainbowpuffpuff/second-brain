// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title X402Escrow
 * @dev An escrow contract designed for the x402 protocol platform.
 * Uploaders register their "Brain" onchain to prove ownership.
 * Users pay for queries by providing the Brain ID.
 */
contract X402Escrow {
    // Mapping of Brain ID to its registered owner (uploader)
    mapping(bytes32 => address) public brainOwners;

    // Mapping of owner address to their accumulated ETH balance
    mapping(address => uint256) public balances;

    // Events for offchain indexing
    event BrainRegistered(bytes32 indexed brainId, address indexed owner);
    event PaymentReceived(bytes32 indexed brainId, address indexed uploader, address indexed user, uint256 amount);
    event FundsClaimed(address indexed uploader, uint256 amount);

    /**
     * @dev Registers a Brain ID to the caller.
     * @param brainId A unique identifier for the uploaded context (e.g., hash of API key).
     */
    function registerBrain(bytes32 brainId) external {
        require(brainId != bytes32(0), "Invalid Brain ID");
        require(brainOwners[brainId] == address(0), "Brain ID already registered");

        brainOwners[brainId] = msg.sender;

        emit BrainRegistered(brainId, msg.sender);
    }

    /**
     * @dev Called by a user to pay for an API query.
     * @param brainId The ID of the brain they are querying.
     */
    function payForQuery(bytes32 brainId) external payable {
        require(msg.value > 0, "Payment amount must be greater than 0");
        
        address owner = brainOwners[brainId];
        require(owner != address(0), "Brain ID not registered");

        // Credit the uploader's internal balance
        balances[owner] += msg.value;

        emit PaymentReceived(brainId, owner, msg.sender, msg.value);
    }

    /**
     * @dev Called by an uploader to withdraw their accumulated funds.
     * Implements the checks-effects-interactions pattern to prevent reentrancy.
     */
    function claimFunds() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No funds to claim");

        // Effects
        balances[msg.sender] = 0;

        // Interactions
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsClaimed(msg.sender, amount);
    }
}