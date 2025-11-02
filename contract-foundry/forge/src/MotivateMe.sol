// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * MotivateMe - Simple ETH transfer contract
 *
 * Three functions:
 * 1. instantMotivation() - Send ETH instantly to recipient (no lock)
 * 2. timelockedMotivation() - Lock ETH until specific date, recipient claims after unlock
 * 3. proofOfActionMotivation() - Lock ETH until recipient provides proof of action
 *
 * Multiple Motivations:
 * - Senders can create MULTIPLE motivations for the same recipient
 * - Each motivation is tracked independently with an index
 * - Recipient can claim each one separately
 */
contract MotivateMe {
    // Events for off-chain tracking (include index for array tracking)
    event InstantMotivation(address indexed sender, address indexed recipient, uint256 amount, string message);
    event TimelockedMotivationCreated(address indexed sender, address indexed recipient, uint256 index, uint256 amount, uint256 unlockTimestamp, string message);
    event TimelockedMotivationClaimed(address indexed recipient, address indexed sender, uint256 index, uint256 amount);
    event ProofOfActionMotivationCreated(address indexed sender, address indexed recipient, uint256 index, uint256 amount, string actionRequired, string message);
    event ProofOfActionClaimed(address indexed recipient, address indexed sender, uint256 index, uint256 amount, string proofDescription);

    // Time-locked motivation
    struct TimeLock {
        uint256 amount;           // ETH locked
        uint256 unlockTimestamp;  // Unix timestamp when funds become claimable
        bool claimed;             // Whether funds have been claimed
    }

    // Proof-of-action motivation
    struct ProofOfAction {
        uint256 amount;           // ETH locked
        string actionRequired;    // Description of required action
        bool claimed;             // Whether funds have been claimed
    }

    // recipient => sender => TimeLock[] (array of time-locked motivations)
    mapping(address => mapping(address => TimeLock[])) public timeLocks;

    // recipient => sender => ProofOfAction[] (array of proof-of-action motivations)
    mapping(address => mapping(address => ProofOfAction[])) public proofOfActions;

    // Instant Motivation: Send ETH instantly to recipient (no lock, no conditions)
    function instantMotivation(address payable recipient, string memory message) public payable {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient");

        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "Transfer failed");

        emit InstantMotivation(msg.sender, recipient, msg.value, message);
    }

    // Time-locked Motivation: Lock ETH until specific date
    // Recipient can claim after unlock date (one-time only per motivation)
    function timelockedMotivation(address recipient, uint256 unlockTimestamp, string memory message) public payable {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient");
        require(unlockTimestamp > block.timestamp, "Unlock time must be in the future");

        // Create new time-lock (append to array)
        timeLocks[recipient][msg.sender].push(TimeLock({
            amount: msg.value,
            unlockTimestamp: unlockTimestamp,
            claimed: false
        }));

        uint256 index = timeLocks[recipient][msg.sender].length - 1;
        emit TimelockedMotivationCreated(msg.sender, recipient, index, msg.value, unlockTimestamp, message);
    }

    // Claim: Recipient claims specific time-locked motivation after unlock date
    function claimTimelockedMotivation(address sender, uint256 index) public {
        require(index < timeLocks[msg.sender][sender].length, "Invalid index");
        TimeLock storage lock = timeLocks[msg.sender][sender][index];

        require(lock.amount > 0, "No funds locked");
        require(!lock.claimed, "Already claimed");
        require(block.timestamp >= lock.unlockTimestamp, "Funds still locked");

        uint256 amount = lock.amount;
        lock.claimed = true;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit TimelockedMotivationClaimed(msg.sender, sender, index, amount);
    }

    // Proof-of-Action Motivation: Lock ETH until recipient provides proof of completing action
    // Sender describes required action (e.g., "Post positive crypto message on Twitter")
    function proofOfActionMotivation(address recipient, string memory actionRequired, string memory message) public payable {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient");
        require(bytes(actionRequired).length > 0, "Action description required");

        // Create new proof-of-action motivation (append to array)
        proofOfActions[recipient][msg.sender].push(ProofOfAction({
            amount: msg.value,
            actionRequired: actionRequired,
            claimed: false
        }));

        uint256 index = proofOfActions[recipient][msg.sender].length - 1;
        emit ProofOfActionMotivationCreated(msg.sender, recipient, index, msg.value, actionRequired, message);
    }

    // Claim: Recipient claims specific proof-of-action motivation by providing proof
    // Currently trust-based (auto-releases) - placeholder for future verification
    function claimProofOfAction(address sender, uint256 index, string memory proofDescription) public {
        require(index < proofOfActions[msg.sender][sender].length, "Invalid index");
        ProofOfAction storage poa = proofOfActions[msg.sender][sender][index];

        require(poa.amount > 0, "No funds locked");
        require(!poa.claimed, "Already claimed");
        require(bytes(proofDescription).length > 0, "Proof description required");

        // ═══════════════════════════════════════════════════════════════════
        // FUTURE VERIFICATION PLACEHOLDER
        // ═══════════════════════════════════════════════════════════════════
        // Contract CANNOT check Twitter/internet directly.
        // To add verification in the future, you can:
        //
        // Option A: Oracle-based verification (e.g., Chainlink Functions)
        //   - Uncomment and implement oracle call here
        //   - Oracle fetches Twitter API off-chain
        //   - Returns verification result
        //   Example:
        //     require(oracleVerify(proofDescription), "Proof verification failed");
        //
        // Option B: Signature-based verification (trusted verifier)
        //   - Add signature parameter to this function
        //   - Verify signature from trusted verifier who checked off-chain
        //   Example:
        //     require(verifySignature(proofDescription, signature), "Invalid proof signature");
        //
        // Option C: Manual sender approval (add approveProof function)
        //   - Sender checks proof off-chain and calls approveProof()
        //   - Only release funds if sender approved
        //
        // Current implementation: Auto-release (trust-based)
        // ═══════════════════════════════════════════════════════════════════

        uint256 amount = poa.amount;
        poa.claimed = true;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit ProofOfActionClaimed(msg.sender, sender, index, amount, proofDescription);
    }

    // Helper: Get total number of time-locked motivations from a sender to recipient
    function getTimelockedCount(address recipient, address sender) public view returns (uint256) {
        return timeLocks[recipient][sender].length;
    }

    // Helper: Get total number of proof-of-action motivations from a sender to recipient
    function getProofOfActionCount(address recipient, address sender) public view returns (uint256) {
        return proofOfActions[recipient][sender].length;
    }
}
