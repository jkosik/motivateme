// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title MotivateMe
 * @notice ETH transfer contract with instant, time-locked, and proof-of-action motivations
 * @dev Supports multiple motivations per sender-recipient pair tracked by array indices
 */

contract MotivateMe {
    // State variables
    address public immutable owner;
    bool public paused;

    uint256 public constant MAX_MESSAGE_LENGTH = 280;
    uint256 public constant MAX_LOCK_DURATION = 365 days * 1;
    uint256 public constant MAX_MOTIVATIONS_PER_PAIR = 100;

    // Events
    event InstantMotivation(address indexed sender, address indexed recipient, uint256 amount, string message);
    event TimelockedMotivationCreated(address indexed sender, address indexed recipient, uint256 index, uint256 amount, uint256 unlockTimestamp, string message);
    event TimelockedMotivationClaimed(address indexed recipient, address indexed sender, uint256 index, uint256 amount);
    event ProofOfActionMotivationCreated(address indexed sender, address indexed recipient, uint256 index, uint256 amount, string actionRequired, string message);
    event ProofOfActionClaimed(address indexed recipient, address indexed sender, uint256 index, uint256 amount, string proofDescription);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event EmergencyWithdrawal(address indexed by, uint256 amount);

    // Time-locked motivation data
    struct TimeLock {
        uint256 amount;
        uint256 unlockTimestamp;
        bool claimed;
    }

    // Proof-of-action motivation data
    struct ProofOfAction {
        uint256 amount;
        string actionRequired;
        bool claimed;
    }

    // Mappings: recipient => sender => motivation array
    mapping(address => mapping(address => TimeLock[])) public timeLocks;
    mapping(address => mapping(address => ProofOfAction[])) public proofOfActions;

    constructor() {
        owner = msg.sender;
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier validStringLength(string memory str) {
        require(bytes(str).length <= MAX_MESSAGE_LENGTH, "String too long");
        _;
    }

    // Send ETH instantly to recipient (no lock, no conditions)
    function instantMotivation(address payable recipient, string calldata message)
        public
        payable
        whenNotPaused
        validStringLength(message)
    {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient");
        require(recipient != address(this), "Cannot send to contract");

        emit InstantMotivation(msg.sender, recipient, msg.value, message);

        (bool success, bytes memory returnData) = recipient.call{value: msg.value}("");
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
            revert("Transfer failed");
        }
    }

    // Lock ETH until specific date, recipient claims after unlock (one-time per motivation)
    function timelockedMotivation(address recipient, uint256 unlockTimestamp, string calldata message)
        public
        payable
        whenNotPaused
        validStringLength(message)
    {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient");
        require(recipient != address(this), "Cannot send to contract");
        require(unlockTimestamp > block.timestamp, "Unlock time must be in the future");
        require(unlockTimestamp <= block.timestamp + MAX_LOCK_DURATION, "Lock duration too long");
        require(timeLocks[recipient][msg.sender].length < MAX_MOTIVATIONS_PER_PAIR, "Too many motivations");

        timeLocks[recipient][msg.sender].push(TimeLock({
            amount: msg.value,
            unlockTimestamp: unlockTimestamp,
            claimed: false
        }));

        uint256 index = timeLocks[recipient][msg.sender].length - 1;
        emit TimelockedMotivationCreated(msg.sender, recipient, index, msg.value, unlockTimestamp, message);
    }

    // Recipient claims specific time-locked motivation after unlock date
    function claimTimelockedMotivation(address sender, uint256 index) public whenNotPaused {
        require(sender != address(0), "Invalid sender");
        require(index < timeLocks[msg.sender][sender].length, "Invalid index");
        TimeLock storage lock = timeLocks[msg.sender][sender][index];

        require(lock.amount > 0, "No funds locked");
        require(!lock.claimed, "Already claimed");
        require(block.timestamp >= lock.unlockTimestamp, "Funds still locked");

        uint256 amount = lock.amount;
        lock.claimed = true;

        emit TimelockedMotivationClaimed(msg.sender, sender, index, amount);

        (bool success, bytes memory returnData) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
            revert("Transfer failed");
        }
    }

    // Lock ETH until recipient provides proof of completing action (e.g., "Post on Twitter")
    function proofOfActionMotivation(address recipient, string calldata actionRequired, string calldata message)
        public
        payable
        whenNotPaused
        validStringLength(actionRequired)
        validStringLength(message)
    {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient");
        require(recipient != address(this), "Cannot send to contract");
        require(bytes(actionRequired).length > 0, "Action description required");
        require(proofOfActions[recipient][msg.sender].length < MAX_MOTIVATIONS_PER_PAIR, "Too many motivations");

        proofOfActions[recipient][msg.sender].push(ProofOfAction({
            amount: msg.value,
            actionRequired: actionRequired,
            claimed: false
        }));

        uint256 index = proofOfActions[recipient][msg.sender].length - 1;
        emit ProofOfActionMotivationCreated(msg.sender, recipient, index, msg.value, actionRequired, message);
    }

    // Recipient claims proof-of-action motivation by providing proof description
    // Currently trust-based (auto-releases) - add oracle/signature verification in future
    function claimProofOfAction(address sender, uint256 index, string calldata proofDescription)
        public
        whenNotPaused
        validStringLength(proofDescription)
    {
        require(sender != address(0), "Invalid sender");
        require(index < proofOfActions[msg.sender][sender].length, "Invalid index");
        require(bytes(proofDescription).length > 0, "Proof description required");

        ProofOfAction storage poa = proofOfActions[msg.sender][sender][index];
        require(poa.amount > 0, "No funds locked");
        require(!poa.claimed, "Already claimed");

        // TODO: Add verification (oracle/signature/manual approval)
        // Current: auto-releases on claim

        uint256 amount = poa.amount;
        poa.claimed = true;

        emit ProofOfActionClaimed(msg.sender, sender, index, amount, proofDescription);

        (bool success, bytes memory returnData) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
            revert("Transfer failed");
        }
    }

    // Admin: Pause contract in emergency
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    // Admin: Unpause contract
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // Admin: Emergency withdrawal for stuck ETH (use carefully)
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        emit EmergencyWithdrawal(msg.sender, balance);

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // Get total time-locked motivations from sender to recipient
    function getTimelockedCount(address recipient, address sender) public view returns (uint256) {
        return timeLocks[recipient][sender].length;
    }

    // Get total proof-of-action motivations from sender to recipient
    function getProofOfActionCount(address recipient, address sender) public view returns (uint256) {
        return proofOfActions[recipient][sender].length;
    }

    // Get contract ETH balance
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Receive function to accept ETH sent directly to contract
    receive() external payable {}
}
