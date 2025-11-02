// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// ===== GAS FEES EXPLAINED =====
//
// GAS = Computational cost to execute functions on blockchain
//
// YOU PAY GAS FOR:
// ✅ Writing data (state changes): gift(), pocketMoney(), withdrawPocketMoney()
// ✅ Reading data (view functions): FREE when called from your app!
//    - getPocketMoneyDetails(), getContractStats(), etc. cost ZERO when called off-chain
//    - BUT they cost gas if called from ANOTHER contract
//
// FACTORS AFFECTING GAS COST:
// - Loops: More iterations = more gas
// - Storage writes: Most expensive operation
// - Array operations: Creating/modifying arrays costs gas
// - Math operations: Very cheap
//
// GAS LIMIT:
// - Each block has a gas limit (~30 million gas on most chains)
// - If your function uses more than block limit, it FAILS
// - Loops with 1000+ iterations may exceed limit!

contract MotivateMe {
    // Events (cheap to emit, indexed parameters help with off-chain searching)
    event Gifted(address indexed sender, address indexed recipient, uint256 amount);
    event PocketMoneyDeposited(address indexed sender, address indexed recipient, uint256 amount);
    event PocketMoneyWithdrawn(address indexed recipient, uint256 amount);

    // Struct to store pocket money details
    struct PocketMoney {
        uint256 totalDeposited;        // Total deposited by sender
        uint256 remainingBalance;      // Remaining balance to withdraw
        uint256 lastWithdrawalMonth;   // Last month withdrawn (YYYYMM format)
        uint256 lastWithdrawalYear;    // Last year withdrawn
        address sender;                // Who deposited the money
    }

    // Mapping: recipient address => their pocket money details
    mapping(address => PocketMoney) public pocketMoneyAccounts;

    // ===== GIFT FUNCTION (renamed from motivate) =====
    // Send ETH immediately to recipient (no conditions, no locking)
    // GAS: ✅ Cheap - simple transfer, no storage writes, no loops (~50,000 gas)
    function gift(address payable recipient) public payable {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient address");

        // Send ETH to recipient immediately
        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "Transfer failed");

        // Emit event
        emit Gifted(msg.sender, recipient, msg.value);
    }

    // ===== POCKET MONEY FUNCTION =====
    // Deposit money that will be released as 1/12 per month to recipient
    // GAS: ✅ Moderate - writes to storage but no loops (~70,000-90,000 gas)
    function pocketMoney(address recipient) public payable {
        require(msg.value > 0, "Must send some ETH");
        require(recipient != address(0), "Invalid recipient address");

        PocketMoney storage pm = pocketMoneyAccounts[recipient];

        // If this is a new pocket money account
        if (pm.sender == address(0)) {
            pm.sender = msg.sender;
            pm.lastWithdrawalMonth = 0; // Never withdrawn yet
            pm.lastWithdrawalYear = 0;
        } else {
            // If account exists, just add to deposited amount
            require(pm.sender == msg.sender, "Only original sender can add more");
        }

        pm.totalDeposited += msg.value;
        pm.remainingBalance += msg.value;

        emit PocketMoneyDeposited(msg.sender, recipient, msg.value);
    }

    // Helper function: Get current year and month
    function getCurrentYearAndMonth() internal view returns (uint256 year, uint256 month) {
        uint256 timestamp = block.timestamp;
        // Simplified calculation (approximate, good enough for pocket money)
        uint256 daysSinceEpoch = timestamp / 86400; // 86400 = seconds per day
        uint256 yearsSinceEpoch = (daysSinceEpoch * 4) / 1461; // Leap year approximation
        year = 1970 + yearsSinceEpoch;

        // Calculate day of year
        uint256 daysInYear = (yearsSinceEpoch % 4 == 2) ? 366 : 365; // Approximate leap year
        uint256 dayOfYear = daysSinceEpoch - (yearsSinceEpoch * 365 + yearsSinceEpoch / 4);

        // Approximate month (30.44 days per month average)
        month = (dayOfYear * 12) / daysInYear + 1;
        if (month > 12) month = 12;
        if (month < 1) month = 1;

        return (year, month);
    }

    // Withdraw monthly pocket money (can only be called once per calendar month)
    // GAS: ✅ Moderate - updates storage and sends ETH (~60,000-80,000 gas)
    function withdrawPocketMoney() public {
        PocketMoney storage pm = pocketMoneyAccounts[msg.sender];

        require(pm.remainingBalance > 0, "No pocket money available");

        // Get current year and month
        (uint256 currentYear, uint256 currentMonth) = getCurrentYearAndMonth();

        // Check if it's a new month
        require(
            currentYear > pm.lastWithdrawalYear ||
            (currentYear == pm.lastWithdrawalYear && currentMonth > pm.lastWithdrawalMonth),
            "Already withdrawn this month"
        );

        // Calculate 1/12 of total deposited (monthly allowance)
        uint256 monthlyAmount = pm.totalDeposited / 12;
        require(monthlyAmount > 0, "Monthly amount too small");

        // Can't withdraw more than remaining balance
        if (monthlyAmount > pm.remainingBalance) {
            monthlyAmount = pm.remainingBalance;
        }

        // Update last withdrawal year and month
        pm.lastWithdrawalYear = currentYear;
        pm.lastWithdrawalMonth = currentMonth;

        // Reduce remaining balance
        pm.remainingBalance -= monthlyAmount;

        // Send the monthly amount
        (bool success, ) = payable(msg.sender).call{value: monthlyAmount}("");
        require(success, "Transfer failed");

        emit PocketMoneyWithdrawn(msg.sender, monthlyAmount);
    }

    // Check pocket money details for a recipient
    // GAS: ✅ FREE when called from your app (view function, no state changes)
    // NOTE: Costs gas only if called from another contract
    function getPocketMoneyDetails(address recipient) public view returns (
        uint256 totalDeposited,
        uint256 remainingBalance,
        uint256 monthlyAmount,
        uint256 lastWithdrawalYear,
        uint256 lastWithdrawalMonth,
        address sender,
        bool canWithdrawThisMonth
    ) {
        PocketMoney memory pm = pocketMoneyAccounts[recipient];
        uint256 monthly = pm.totalDeposited / 12;

        // Get current year and month
        (uint256 currentYear, uint256 currentMonth) = getCurrentYearAndMonth();

        // Check if eligible to withdraw this month
        bool eligible = pm.remainingBalance > 0 &&
                       (currentYear > pm.lastWithdrawalYear ||
                        (currentYear == pm.lastWithdrawalYear && currentMonth > pm.lastWithdrawalMonth));

        return (
            pm.totalDeposited,
            pm.remainingBalance,
            monthly,
            pm.lastWithdrawalYear,
            pm.lastWithdrawalMonth,
            pm.sender,
            eligible
        );
    }

    // Check contract balance
    // GAS: ✅ FREE when called from your app (view function)
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // ===== HOW TO VIEW CONTRACT HISTORY =====
    //
    // Use EVENT LOGS (off-chain) - FREE and efficient!
    //
    // In your JavaScript app:
    //
    // // Get all deposits
    // const deposits = await contract.queryFilter(
    //     contract.filters.PocketMoneyDeposited()
    // );
    //
    // // Get all withdrawals
    // const withdrawals = await contract.queryFilter(
    //     contract.filters.PocketMoneyWithdrawn()
    // );
    //
    // // Get all gifts
    // const gifts = await contract.queryFilter(
    //     contract.filters.Gifted()
    // );
    //
    // // Build statistics in your app (FREE!)
    // const totalRecipients = new Set(deposits.map(e => e.args.recipient)).size;
    // const totalDeposited = deposits.reduce((sum, e) => sum + e.args.amount, 0n);
    // const totalWithdrawn = withdrawals.reduce((sum, e) => sum + e.args.amount, 0n);
    //
    // This approach:
    // ✅ FREE (no gas cost)
    // ✅ FAST (no contract calls)
    // ✅ SCALES to any number of transactions
    // ✅ Includes complete history automatically
}

