import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { ethers } from 'ethers'

// Configuration will be injected from HTML
window.initializeApp = async function(config) {
  const { ACTIVE_NETWORK, CONTRACT_ADDRESS, CONTRACT_ADDRESSES, ABI, WALLETCONNECT_PROJECT_ID } = config;

  // State
  let provider, signer, contract, modal;
  let currentContractAddress = CONTRACT_ADDRESS;
  let isProcessingTransaction = false; // Flag to prevent duplicate submissions

  const $ = (id) => document.getElementById(id);

  // Function to update contract address and link
  function updateContractAddress(address) {
    currentContractAddress = address;
    const explorerUrl = `${ACTIVE_NETWORK.blockExplorerUrls[0]}/address/${address}`;
    $('contractAddr').textContent = address;
    $('contractAddr').href = explorerUrl;

    // Reinitialize contract if provider exists
    if (provider && signer) {
      contract = new ethers.Contract(currentContractAddress, ABI, signer);
      console.log('📝 Contract updated to:', currentContractAddress);
    }
  }

  // Set initial contract address link
  updateContractAddress(CONTRACT_ADDRESS);

  // Handle toggle button for custom contract
  const customContractToggle = $('customContractToggle');
  const customContractInput = $('customContractInput');
  const customContractAddr = $('customContractAddr');
  const applyCustomContract = $('applyCustomContract');

  customContractToggle.addEventListener('change', () => {
    if (customContractToggle.checked) {
      // Toggle ON - show custom contract input
      customContractInput.classList.remove('hidden');
    } else {
      // Toggle OFF - hide custom contract input and revert to default
      customContractInput.classList.add('hidden');
      customContractAddr.value = ''; // Clear the input
      updateContractAddress(CONTRACT_ADDRESS);
    }
  });

  // Handle Apply button for custom contract
  applyCustomContract.addEventListener('click', () => {
    const address = customContractAddr.value.trim();
    if (isValidContractAddress(address)) {
      updateContractAddress(address);
      setFunctionInfo('Custom contract applied');
      setTimeout(() => setFunctionInfo(''), 3000); // Clear message after 3 seconds
    } else {
      setFunctionInfo('Invalid address: must be valid Ethereum address (0x...)');
      setTimeout(() => setFunctionInfo(''), 3000); // Clear message after 3 seconds
    }
  });

  // Update page title
  document.title = `MotivateMe · ${ACTIVE_NETWORK.chainName}`;

  // Initialize Reown AppKit
  modal = createAppKit({
    adapters: [new EthersAdapter()],
    projectId: WALLETCONNECT_PROJECT_ID,
    networks: [{
      id: ACTIVE_NETWORK.chainIdDecimal,
      name: ACTIVE_NETWORK.chainName,
      nativeCurrency: ACTIVE_NETWORK.nativeCurrency,
      rpcUrls: {
        default: { http: [ACTIVE_NETWORK.rpcUrls[0]] }
      },
      blockExplorers: {
        default: { name: 'Explorer', url: ACTIVE_NETWORK.blockExplorerUrls[0] }
      }
    }],
    metadata: {
      name: 'MotivateMe',
      description: 'MotivateMe Counter dApp',
      url: window.location.origin,
      icons: ['https://walletconnect.com/walletconnect-logo.png']
    },
    features: {
      analytics: false
    }
  });

  console.log('✅ AppKit initialized');

  // UI Helper Functions
  function setWalletInfo(msg, connected = false) {
    const el = $('walletInfo');
    el.textContent = msg;
    if (connected) {
      el.style.color = '#5848D5'; // Purple when connected
      el.style.fontWeight = '500';
    } else {
      el.style.color = '#8c8c8c'; // Gray when not connected
      el.style.fontWeight = '400';
    }
  }

  function setFunctionInfo(msg) {
    $('functionInfo').textContent = msg;
  }

  function showActionsSection(show) {
    const section = $('actionsSection');
    if (show) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  }

  function getRecipientAddress() {
    const address = $('recipientInput').value.trim();

    if (!address) {
      setFunctionInfo('❌ Please enter recipient address');
      return null;
    }

    // Basic format validation
    if (!ethers.isAddress(address)) {
      setFunctionInfo('❌ Invalid address format. Must be 0x... (42 chars)');
      return null;
    }

    // Checksum validation (if address uses mixed case)
    try {
      const checksumAddress = ethers.getAddress(address);
      // If the user provided mixed case, verify it matches the checksum
      if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
        if (address !== checksumAddress) {
          setFunctionInfo('❌ Invalid checksum. Did you mistype the address?');
          return null;
        }
      }
      // Return the properly checksummed address
      return checksumAddress;
    } catch (e) {
      setFunctionInfo('❌ Address validation failed');
      return null;
    }
  }

  function getEthAmount() {
    const amountStr = $('ethAmountInput').value.trim();

    if (!amountStr) {
      setFunctionInfo('❌ Please enter ETH amount');
      return null;
    }

    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      setFunctionInfo('❌ Invalid ETH amount. Must be greater than 0');
      return null;
    }

    // Check if user has enough balance
    // Note: This is just a warning, actual balance check happens on-chain
    try {
      const amountWei = ethers.parseEther(amountStr);
      console.log(`📤 Sending: ${amountStr} ETH (${amountWei.toString()} Wei)`);
      return amountWei;
    } catch (e) {
      setFunctionInfo('❌ Invalid ETH amount format');
      return null;
    }
  }

  function getUnlockDate() {
    const dateStr = $('unlockDateInput').value.trim();

    if (!dateStr) {
      setFunctionInfo('❌ Please select unlock date');
      return null;
    }

    try {
      // Convert date string (YYYY-MM-DD) to Unix timestamp
      const date = new Date(dateStr + 'T00:00:00Z'); // Treat as UTC midnight
      const timestamp = Math.floor(date.getTime() / 1000);

      // Check if date is in the future
      const now = Math.floor(Date.now() / 1000);
      if (timestamp <= now) {
        setFunctionInfo('❌ Unlock date must be in the future');
        return null;
      }

      console.log(`🗓️ Unlock date: ${dateStr} (Unix timestamp: ${timestamp})`);
      return timestamp;
    } catch (e) {
      setFunctionInfo('❌ Invalid date format');
      return null;
    }
  }

  function getMessage() {
    const message = $('messageInput').value.trim();
    // Message is optional, so return empty string if not provided
    return message || '';
  }

  function isValidAddress(address) {
    if (!address || !ethers.isAddress(address)) {
      return false;
    }
    try {
      ethers.getAddress(address);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isValidContractAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    try {
      // ethers.isAddress validates format AND checksum
      return ethers.isAddress(address);
    } catch (e) {
      return false;
    }
  }

  // Clear form inputs after successful transaction
  function clearForm() {
    $('recipientInput').value = '';
    $('ethAmountInput').value = '';
    $('unlockDateInput').value = '';
    $('messageInput').value = '';
    $('functionSelect').value = '';
    $('unlockDateInput').style.display = 'none';
    $('messageInput').placeholder = 'Message/description (will be stored on blockchain)';
    console.log('✅ Form cleared');
  }

  // Initialize provider and contract after connection
  async function initContract(walletProvider) {
    try {
      provider = new ethers.BrowserProvider(walletProvider);
      signer = await provider.getSigner();
      contract = new ethers.Contract(currentContractAddress, ABI, signer);
      const acct = await signer.getAddress();
      const net = await provider.getNetwork();

      let networkName = ACTIVE_NETWORK.chainName;
      if (Number(net.chainId) !== ACTIVE_NETWORK.chainIdDecimal) {
        networkName = `Wrong network (${Number(net.chainId)})`;
        console.warn(`⚠️ Wrong network detected. Expected ${ACTIVE_NETWORK.chainIdDecimal}, got ${Number(net.chainId)}`);

        // Try to switch network automatically
        try {
          console.log('🔄 Requesting network switch...');
          await provider.send('wallet_switchEthereumChain', [{ chainId: ACTIVE_NETWORK.chainId }]);
          console.log('✅ Network switched successfully');
          // Reload to reinitialize with correct network
          location.reload();
          return;
        } catch (switchError) {
          // If network doesn't exist in wallet, add it
          if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
            try {
              console.log('📡 Adding Ink network to wallet...');
              await provider.send('wallet_addEthereumChain', [{
                chainId: ACTIVE_NETWORK.chainId,
                chainName: ACTIVE_NETWORK.chainName,
                nativeCurrency: ACTIVE_NETWORK.nativeCurrency,
                rpcUrls: ACTIVE_NETWORK.rpcUrls,
                blockExplorerUrls: ACTIVE_NETWORK.blockExplorerUrls
              }]);
              console.log('✅ Network added and switched');
              // Reload to reinitialize with correct network
              location.reload();
              return;
            } catch (addError) {
              console.error('❌ Failed to add network:', addError);
              setFunctionInfo('⚠️ Please manually switch to Ink network in your wallet');
            }
          } else {
            console.error('❌ Failed to switch network:', switchError);
            setFunctionInfo('⚠️ Please manually switch to Ink network in your wallet');
          }
        }
      }

      setWalletInfo(`${acct.slice(0, 6)}...${acct.slice(-4)} · ${networkName}`, true);
      showActionsSection(true);
      setFunctionInfo(''); // Clear function info when connected

      // Show "My Claims" link and pipe when wallet is connected
      $('claimsLink').style.display = 'inline';
      $('claimsPipe').style.display = 'inline';
      $('connectBtn').textContent = 'Wallet';
      $('contractInfo').classList.remove('hidden'); // Show contract info
      await updateBalance(); // Update balance in footer
      console.log('✅ Wallet connected:', acct);
    } catch (e) {
      console.error('Failed to initialize contract:', e);
      setFunctionInfo('Connection error');
    }
  }

  // Connect wallet - opens AppKit modal (supports browser extensions + mobile via QR)
  // IMPORTANT: Set up button handler FIRST before any async operations
  $('connectBtn').onclick = async () => {
    try {
      console.log('Button clicked');
      await modal.open();
    } catch (e) {
      console.error('Connection error:', e);
      setFunctionInfo(`Connection failed: ${e.message || e}`);
    }
  };

  console.log('✅ Button handler attached');

  // Subscribe to AppKit state changes (handles both initial connection and new connections)
  modal.subscribeState(async (newState) => {
    console.log('📍 State changed:', newState);

    // Check if we have a wallet provider (better indicator than address)
    const walletProvider = modal.getWalletProvider();
    console.log('Wallet provider:', walletProvider ? 'EXISTS' : 'NULL');

    if (walletProvider && !contract) {
      console.log('Found wallet provider, initializing contract...');
      await initContract(walletProvider);
    } else if (!walletProvider && contract) {
      console.log('Wallet disconnected - clearing all state');

      // Clear all WalletConnect/AppKit cache
      try {
        const wcKeys = Object.keys(localStorage).filter(key =>
          key.startsWith('wc@') ||
          key.startsWith('@w3m') ||
          key.startsWith('W3M') ||
          key.startsWith('WALLETCONNECT')
        );
        wcKeys.forEach(key => {
          console.log('Clearing cache:', key);
          localStorage.removeItem(key);
        });
      } catch (e) {
        console.warn('Failed to clear WalletConnect cache:', e);
      }

      setWalletInfo('Not connected');
      showActionsSection(false);
      setFunctionInfo('');
      $('connectBtn').textContent = 'Connect wallet';
      $('contractInfo').classList.add('hidden'); // Hide contract info
      $('walletBalance').classList.add('hidden'); // Hide balance
      $('claimsLink').style.display = 'none'; // Hide claims link
      $('claimsPipe').style.display = 'none'; // Hide pipe
      provider = null;
      signer = null;
      contract = null;
    }
  });

  // Function dropdown - show/hide specific fields based on selection
  $('functionSelect').onchange = (e) => {
    const val = e.target.value;
    setFunctionInfo('');

    // Hide unlock date field
    $('unlockDateInput').style.display = 'none';

    // Update message input placeholder and show/hide fields based on motivation type
    const messageInput = $('messageInput');

    if (val === 'timelockedMotivation') {
      $('unlockDateInput').style.display = 'block';
      messageInput.placeholder = 'Message/description (optional, will be stored on blockchain)';
      setFunctionInfo('Enter all fields, then click Motivate');
    } else if (val === 'proofOfActionMotivation') {
      messageInput.placeholder = 'Required action (e.g., "Post positive crypto message on Twitter")';
      setFunctionInfo('Enter all fields, then click Motivate');
    } else if (val === 'instantMotivation') {
      messageInput.placeholder = 'Message/description (optional, will be stored on blockchain)';
      setFunctionInfo('Enter recipient and amount, then click Motivate');
    } else {
      messageInput.placeholder = 'Message/description (will be stored on blockchain)';
    }
  };

  // Helper function to get safe block range (limit to avoid RPC errors)
  async function getSafeBlockRange(maxBlocks = 50000) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - maxBlocks);
    return { fromBlock, toBlock: 'latest' };
  }

  // Helper function to poll for transaction confirmation after RPC quirk
  async function pollForTransactionSuccess(btn, originalText, eventFilter, successMessage) {
    console.warn('🔍 Polling for transaction confirmation...');

    // Get current state
    const startBlock = await provider.getBlockNumber();
    const myAddress = await signer.getAddress();

    // Poll for new events to detect successful transaction
    let pollCount = 0;
    const maxPolls = 60; // 60 polls = 60 seconds

    const pollInterval = setInterval(async () => {
      pollCount++;

      try {
        const currentBlock = await provider.getBlockNumber();

        if (currentBlock > startBlock) {
          console.log(`🔍 Poll ${pollCount}: Checking blocks ${startBlock} to ${currentBlock}...`);

          // Check for new events from my address
          const newEvents = await contract.queryFilter(
            eventFilter,
            startBlock,
            currentBlock
          );

          if (newEvents.length > 0) {
            // Transaction succeeded!
            clearInterval(pollInterval);
            const latestEvent = newEvents[newEvents.length - 1];

            btn.textContent = 'Success!';
            setFunctionInfo(`✅ ${successMessage} in block ${latestEvent.blockNumber}`);
            console.log('✅ Transaction confirmed via event polling!');

            setTimeout(() => {
              btn.textContent = originalText;
              btn.disabled = false;
              isProcessingTransaction = false;
              console.log('🔓 Transaction lock released (success)');
              clearForm();
            }, 2000);
            return;
          }
        }

        // Timeout after maxPolls
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          btn.textContent = originalText;
          btn.disabled = false;
          isProcessingTransaction = false;
          console.log('🔓 Transaction lock released (timeout)');
          clearForm();
          setFunctionInfo('⏱️ Timed out. If you confirmed, check "My Claims" to verify.');
          setTimeout(() => setFunctionInfo(''), 10000);
        }
      } catch (pollError) {
        console.warn('Poll error:', pollError);
      }
    }, 1000); // Poll every 1 second
  }

  // Function to read and log all contract events
  async function logContractEvents() {
    if (!contract) {
      console.log('⚠️ Contract not initialized');
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('📜 CONTRACT STATISTICS (Overall, Not Personal)');
    console.log('═══════════════════════════════════════════════');
    console.log('');

    try {
      // Check if contract supports MotivateMe events
      if (!contract.filters.InstantMotivation) {
        console.log('ℹ️ This contract does not emit MotivateMe events');
        console.log('   (Connected to Counter.sol or different contract)');
        console.log('');
        return;
      }
      // Query all InstantMotivation events
      console.log('⚡ Querying all Instant Motivation events...');
      const instantEvents = await contract.queryFilter(
        contract.filters.InstantMotivation()
      );
      console.log(`   Found ${instantEvents.length} instant motivations`);

      if (instantEvents.length > 0) {
        console.log('   Recent instant motivations:');
        instantEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.args.sender} → ${event.args.recipient}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          if (event.args.message) {
            console.log(`      Message: "${event.args.message}"`);
          }
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Query all TimelockedMotivationCreated events
      console.log('🔒 Querying all Time-locked Motivation deposits...');
      const timelockedEvents = await contract.queryFilter(
        contract.filters.TimelockedMotivationCreated()
      );
      console.log(`   Found ${timelockedEvents.length} time-locked motivations`);

      if (timelockedEvents.length > 0) {
        console.log('   Recent time-locked motivations:');
        timelockedEvents.slice(-5).forEach((event, i) => {
          const unlockDate = new Date(event.args.unlockTimestamp * 1000).toISOString().split('T')[0];
          console.log(`   ${i + 1}. ${event.args.sender} → ${event.args.recipient}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Unlock Date: ${unlockDate}`);
          if (event.args.message) {
            console.log(`      Message: "${event.args.message}"`);
          }
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Query all TimelockedMotivationClaimed events
      console.log('✅ Querying all Time-locked Motivation claims...');
      const claimEvents = await contract.queryFilter(
        contract.filters.TimelockedMotivationClaimed()
      );
      console.log(`   Found ${claimEvents.length} claims`);

      if (claimEvents.length > 0) {
        console.log('   Recent claims:');
        claimEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. Recipient: ${event.args.recipient}`);
          console.log(`      From Sender: ${event.args.sender}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Query all ProofOfActionMotivationCreated events
      console.log('📋 Querying all Proof-of-Action Motivations...');
      const proofOfActionEvents = await contract.queryFilter(
        contract.filters.ProofOfActionMotivationCreated()
      );
      console.log(`   Found ${proofOfActionEvents.length} proof-of-action motivations`);

      if (proofOfActionEvents.length > 0) {
        console.log('   Recent proof-of-action motivations:');
        proofOfActionEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.args.sender} → ${event.args.recipient}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Action Required: "${event.args.actionRequired}"`);
          if (event.args.message) {
            console.log(`      Message: "${event.args.message}"`);
          }
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Query all ProofOfActionClaimed events
      console.log('✔️ Querying all Proof-of-Action claims...');
      const proofClaimEvents = await contract.queryFilter(
        contract.filters.ProofOfActionClaimed()
      );
      console.log(`   Found ${proofClaimEvents.length} proof-of-action claims`);

      if (proofClaimEvents.length > 0) {
        console.log('   Recent proof-of-action claims:');
        proofClaimEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. Recipient: ${event.args.recipient}`);
          console.log(`      From Sender: ${event.args.sender}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Proof: "${event.args.proofDescription}"`);
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Calculate statistics (all from events)
      console.log('📊 CONTRACT STATISTICS:');
      console.log('═══════════════════════════════════════════════');

      // Unique recipients
      const allRecipients = new Set([
        ...instantEvents.map(e => e.args.recipient),
        ...timelockedEvents.map(e => e.args.recipient),
        ...proofOfActionEvents.map(e => e.args.recipient)
      ]);
      console.log(`   Total unique recipients: ${allRecipients.size}`);
      console.log('');

      // Money sent (regardless of locked status)
      const totalInstant = instantEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      const totalTimelocked = timelockedEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      const totalProofOfAction = proofOfActionEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      console.log('   💸 Money Sent:');
      console.log(`   ├─ Total instant motivations: ${ethers.formatEther(totalInstant)} ETH`);
      console.log(`   ├─ Total time-locked: ${ethers.formatEther(totalTimelocked)} ETH`);
      console.log(`   └─ Total proof-of-action: ${ethers.formatEther(totalProofOfAction)} ETH`);
      console.log('');

      // Money received/claimed by recipients
      const totalTimelockedClaimed = claimEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      const totalProofClaimed = proofClaimEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      const stillTimelockedLocked = totalTimelocked - totalTimelockedClaimed;
      const stillProofLocked = totalProofOfAction - totalProofClaimed;
      const totalLocked = stillTimelockedLocked + stillProofLocked;

      console.log('   💰 Locked Motivations:');
      console.log(`   ├─ Time-locked claimed: ${ethers.formatEther(totalTimelockedClaimed)} ETH`);
      console.log(`   ├─ Time-locked unclaimed: ${ethers.formatEther(stillTimelockedLocked)} ETH`);
      console.log(`   ├─ Proof-of-action claimed: ${ethers.formatEther(totalProofClaimed)} ETH`);
      console.log(`   └─ Proof-of-action unclaimed: ${ethers.formatEther(stillProofLocked)} ETH`);
      console.log('');

      // Contract holds (calculated from events)
      console.log(`   📦 Contract holds: ${ethers.formatEther(totalLocked)} ETH`);

      console.log('═══════════════════════════════════════════════');
      console.log('✅ Statistics loaded from blockchain events');
      console.log('');

    } catch (error) {
      console.error('❌ Error reading events:', error);
    }
  }

  // MotivateMe button - triggers the selected action with validation
  $('motivateBtn').onclick = async () => {
    const btn = $('motivateBtn');
    const val = $('functionSelect').value;

    // CRITICAL: Check if already processing (prevents ALL duplicate submissions)
    if (isProcessingTransaction) {
      console.log('⚠️ Transaction already in progress, ignoring click');
      return;
    }

    if (!val) {
      setFunctionInfo('❌ Please select a motivation first');
      return;
    }

    if (!contract) {
      setFunctionInfo('❌ Please connect wallet first');
      return;
    }

    // Set flag and disable button IMMEDIATELY
    isProcessingTransaction = true;
    btn.disabled = true;
    console.log('🔒 Transaction processing locked');

    try {
      // Log all contract events first
      console.log('🔍 Reading contract event history...');
      await logContractEvents();

      // Call the appropriate function based on selection
      if (val === 'instantMotivation') {
        await sendInstantMotivation();
      } else if (val === 'timelockedMotivation') {
        await sendTimelockedMotivation();
      } else if (val === 'proofOfActionMotivation') {
        await sendProofOfActionMotivation();
      }

      // Note: Button re-enabled by individual send functions after success/error
      // Flag cleared there too
    } catch (error) {
      console.error('Motivation error:', error);
      setFunctionInfo(`❌ Error: ${error.message || 'Failed'}`);
      btn.disabled = false;
      isProcessingTransaction = false;
      console.log('🔓 Transaction lock released (error)');
    }
  };

  // (No valueInput handler needed anymore - removed)

  // Contract interaction functions
  async function updateBalance() {
    try {
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balance);
      $('balanceAmount').textContent = balanceEth;
      $('walletBalance').classList.remove('hidden');
    } catch (e) {
      console.error('Balance update failed:', e);
      $('balanceAmount').textContent = '—';
    }
  }

  async function readCounter() {
    try {
      setFunctionInfo('Reading...');
      const v = await contract.number();
      setFunctionInfo(`Current value: ${v.toString()}`);
    } catch (e) {
      console.error(e);
      setFunctionInfo(`Error: ${e.message || 'Read failed'}`);
    }
  }

  async function sendTimelockedMotivation() {
    const btn = $('motivateBtn');
    const originalText = btn.textContent;

    try {
      const recipient = getRecipientAddress();
      if (!recipient) {
        return; // Error message already set by getRecipientAddress()
      }

      // Get ETH amount
      const ethAmount = getEthAmount();
      if (!ethAmount) {
        return; // Error message already set by getEthAmount()
      }

      // Get unlock date for time-locked motivation
      const unlockTimestamp = getUnlockDate();
      if (!unlockTimestamp) {
        return; // Error message already set by getUnlockDate()
      }

      // Get message (optional)
      const message = getMessage();

      btn.disabled = true;
      btn.textContent = 'Confirm in your wallet...';
      setFunctionInfo(''); // Clear any error messages

      // Call MotivateMe.sol timelockedMotivation function with unlock timestamp and message
      const tx = await contract.timelockedMotivation(recipient, unlockTimestamp, message, { value: ethAmount });

      btn.textContent = 'Confirming...';
      const rec = await tx.wait();

      // Check if transaction actually succeeded
      if (rec.status === 0) {
        throw new Error('Transaction failed on-chain');
      }

      // Show success state
      btn.textContent = 'Success!';
      setFunctionInfo(`✅ Time-locked motivation created in block ${rec.blockNumber}`);

      // Wait 2 seconds before clearing and resetting
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        isProcessingTransaction = false;
        console.log('🔓 Transaction lock released (success)');
        clearForm();
      }, 2000);
    } catch (e) {
      console.error('Transaction error (full details):', e);

      // SPECIAL CASE: Ink RPC empty error (transaction submission succeeds despite this error)
      // This happens during tx submission, but wallet still receives the request
      if (e.message?.includes('could not coalesce error') && e.error?.message === '') {
        console.warn('⚠️ Ink RPC quirk: Empty error during transaction submission');
        console.warn('💡 This is a known RPC issue - wallet popup should still appear');

        // Wait 2 seconds before changing button text (give user time to see wallet popup)
        setTimeout(() => {
          btn.textContent = 'Waiting for confirmation...';
        }, 2000);

        // Get my address for the event filter
        const myAddress = await signer.getAddress();

        // Start polling for transaction success
        await pollForTransactionSuccess(
          btn,
          originalText,
          contract.filters.TimelockedMotivationCreated(myAddress),
          'Time-locked motivation created'
        );

        return; // Exit without showing error
      }

      // Provide clearer error messages
      let errorMsg = 'Transaction failed';

      // Check for the misleading "User rejected" error
      if (e.code === 'UNKNOWN_ERROR' && e.error?.message?.includes('User rejected')) {
        // Check actual balance to see if it's really a balance issue
        try {
          const address = await signer.getAddress();
          const balance = await provider.getBalance(address);
          const balanceEth = ethers.formatEther(balance);

          if (balance === 0n) {
            errorMsg = `No funds for gas. Balance: 0 ETH`;
          } else if (parseFloat(balanceEth) < 0.0001) {
            errorMsg = `Low balance: ${balanceEth} ETH (need more for gas)`;
          } else {
            errorMsg = `Transaction rejected. Balance: ${balanceEth} ETH. Check wallet.`;
          }
        } catch (balanceError) {
          errorMsg = 'Transaction rejected by wallet';
        }
      } else if (e.code === 'ACTION_REJECTED') {
        errorMsg = 'You cancelled the transaction';
      } else if (e.code === 'TIMEOUT' || e.message?.includes('timeout')) {
        errorMsg = 'Confirmation timeout. Transaction may have succeeded - check counter.';
      } else if (e.message) {
        // Show first part of error, but suggest checking console for full details
        const shortMsg = e.message.slice(0, 60);
        errorMsg = e.message.length > 60 ? `${shortMsg}... (check console F12)` : e.message;
      }

      btn.textContent = originalText;
      btn.disabled = false;
      isProcessingTransaction = false;
      console.log('🔓 Transaction lock released (error)');
      setFunctionInfo(`❌ Error: ${errorMsg}`);
    }
  }

  async function sendInstantMotivation() {
    const btn = $('motivateBtn');
    const originalText = btn.textContent;

    try {
      const recipient = getRecipientAddress();
      if (!recipient) {
        return; // Error message already set by getRecipientAddress()
      }

      // Get ETH amount
      const ethAmount = getEthAmount();
      if (!ethAmount) {
        return; // Error message already set by getEthAmount()
      }

      // Get message (optional)
      const message = getMessage();

      btn.disabled = true;
      btn.textContent = 'Confirm in your wallet...';
      setFunctionInfo(''); // Clear any error messages

      // Call MotivateMe.sol instantMotivation function (instant transfer) with message
      const tx = await contract.instantMotivation(recipient, message, { value: ethAmount });

      btn.textContent = 'Confirming...';
      const rec = await tx.wait();

      // Check if transaction actually succeeded
      if (rec.status === 0) {
        throw new Error('Transaction failed on-chain');
      }

      // Show success state
      btn.textContent = 'Success!';
      setFunctionInfo(`✅ Instant motivation sent in block ${rec.blockNumber}`);

      // Wait 2 seconds before clearing and resetting
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        isProcessingTransaction = false;
        console.log('🔓 Transaction lock released (success)');
        clearForm();
      }, 2000);
    } catch (e) {
      console.error('Transaction error (full details):', e);

      // SPECIAL CASE: Ink RPC empty error (transaction submission succeeds despite this error)
      // This happens during tx submission, but wallet still receives the request
      if (e.message?.includes('could not coalesce error') && e.error?.message === '') {
        console.warn('⚠️ Ink RPC quirk: Empty error during transaction submission');
        console.warn('💡 This is a known RPC issue - wallet popup should still appear');

        // Wait 2 seconds before changing button text (give user time to see wallet popup)
        setTimeout(() => {
          btn.textContent = 'Waiting for confirmation...';
        }, 2000);

        // Get my address for the event filter
        const myAddress = await signer.getAddress();

        // Start polling for transaction success
        await pollForTransactionSuccess(
          btn,
          originalText,
          contract.filters.InstantMotivation(myAddress),
          'Instant motivation sent'
        );

        return; // Exit without showing error
      }

      // Provide clearer error messages
      let errorMsg = 'Transaction failed';

      // Check for the misleading "User rejected" error
      if (e.code === 'UNKNOWN_ERROR' && e.error?.message?.includes('User rejected')) {
        // Check actual balance to see if it's really a balance issue
        try {
          const address = await signer.getAddress();
          const balance = await provider.getBalance(address);
          const balanceEth = ethers.formatEther(balance);

          if (balance === 0n) {
            errorMsg = `No funds for gas. Balance: 0 ETH`;
          } else if (parseFloat(balanceEth) < 0.0001) {
            errorMsg = `Low balance: ${balanceEth} ETH (need more for gas)`;
          } else {
            errorMsg = `Transaction rejected. Balance: ${balanceEth} ETH. Check wallet.`;
          }
        } catch (balanceError) {
          errorMsg = 'Transaction rejected by wallet';
        }
      } else if (e.code === 'ACTION_REJECTED') {
        errorMsg = 'You cancelled the transaction';
      } else if (e.code === 'TIMEOUT' || e.message?.includes('timeout')) {
        errorMsg = 'Confirmation timeout. Transaction may have succeeded - check counter.';
      } else if (e.message) {
        // Show first part of error, but suggest checking console for full details
        const shortMsg = e.message.slice(0, 60);
        errorMsg = e.message.length > 60 ? `${shortMsg}... (check console F12)` : e.message;
      }

      setFunctionInfo(`Error: ${errorMsg}`);
    }
  }

  async function sendProofOfActionMotivation() {
    const btn = $('motivateBtn');
    const originalText = btn.textContent;

    try {
      const recipient = getRecipientAddress();
      if (!recipient) {
        return; // Error message already set by getRecipientAddress()
      }

      // Get ETH amount
      const ethAmount = getEthAmount();
      if (!ethAmount) {
        return; // Error message already set by getEthAmount()
      }

      // Get action required (using message field for proof-of-action)
      const actionRequired = getMessage();
      if (!actionRequired) {
        setFunctionInfo('❌ Please describe the required action');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Confirm in your wallet...';
      setFunctionInfo(''); // Clear any error messages

      // Call MotivateMe.sol proofOfActionMotivation function with action required as both parameters
      const tx = await contract.proofOfActionMotivation(recipient, actionRequired, actionRequired, { value: ethAmount });

      btn.textContent = 'Confirming...';
      const rec = await tx.wait();

      // Check if transaction actually succeeded
      if (rec.status === 0) {
        throw new Error('Transaction failed on-chain');
      }

      // Show success state
      btn.textContent = 'Success!';
      setFunctionInfo(`✅ Proof-of-action motivation created in block ${rec.blockNumber}`);

      // Wait 2 seconds before clearing and resetting
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        isProcessingTransaction = false;
        console.log('🔓 Transaction lock released (success)');
        clearForm();
      }, 2000);
    } catch (e) {
      console.error('Transaction error (full details):', e);

      // SPECIAL CASE: Ink RPC empty error (transaction submission succeeds despite this error)
      // This happens during tx submission, but wallet still receives the request
      if (e.message?.includes('could not coalesce error') && e.error?.message === '') {
        console.warn('⚠️ Ink RPC quirk: Empty error during transaction submission');
        console.warn('💡 This is a known RPC issue - wallet popup should still appear');

        // Wait 2 seconds before changing button text (give user time to see wallet popup)
        setTimeout(() => {
          btn.textContent = 'Waiting for confirmation...';
        }, 2000);

        // Get my address for the event filter
        const myAddress = await signer.getAddress();

        // Start polling for transaction success
        await pollForTransactionSuccess(
          btn,
          originalText,
          contract.filters.ProofOfActionMotivationCreated(myAddress),
          'Proof-of-action motivation created'
        );

        return; // Exit without showing error
      }

      // Provide clearer error messages
      let errorMsg = 'Transaction failed';

      // Check for the misleading "User rejected" error
      if (e.code === 'UNKNOWN_ERROR' && e.error?.message?.includes('User rejected')) {
        // Check actual balance to see if it's really a balance issue
        try {
          const address = await signer.getAddress();
          const balance = await provider.getBalance(address);
          const balanceEth = ethers.formatEther(balance);

          if (balance === 0n) {
            errorMsg = `No funds for gas. Balance: 0 ETH`;
          } else if (parseFloat(balanceEth) < 0.0001) {
            errorMsg = `Low balance: ${balanceEth} ETH (need more for gas)`;
          } else {
            errorMsg = `Transaction rejected. Balance: ${balanceEth} ETH. Check wallet.`;
          }
        } catch (balanceError) {
          errorMsg = 'Transaction rejected by wallet';
        }
      } else if (e.code === 'ACTION_REJECTED') {
        errorMsg = 'You cancelled the transaction';
      } else if (e.code === 'TIMEOUT' || e.message?.includes('timeout')) {
        errorMsg = 'Confirmation timeout. Transaction may have succeeded - check counter.';
      } else if (e.message) {
        // Show first part of error, but suggest checking console for full details
        const shortMsg = e.message.slice(0, 60);
        errorMsg = e.message.length > 60 ? `${shortMsg}... (check console F12)` : e.message;
      }

      btn.textContent = originalText;
      btn.disabled = false;
      isProcessingTransaction = false;
      console.log('🔓 Transaction lock released (error)');
      setFunctionInfo(`❌ Error: ${errorMsg}`);
    }
  }

  // Listen for account/chain changes
  if (window.ethereum) {
    window.ethereum.on?.('chainChanged', () => {
      console.log('Chain changed - reloading page');
      location.reload();
    });
    window.ethereum.on?.('accountsChanged', (accounts) => {
      console.log('Account changed:', accounts);
      console.log('Reloading page to refresh connection');
      location.reload();
    });
  }

  // Also listen to AppKit's provider events
  const checkProviderEvents = () => {
    const provider = modal.getWalletProvider();
    if (provider?.on) {
      provider.on('accountsChanged', (accounts) => {
        console.log('WalletConnect account changed:', accounts);
        location.reload();
      });
      provider.on('chainChanged', (chainId) => {
        console.log('WalletConnect chain changed:', chainId);
        location.reload();
      });
    }
  };

  // Set up provider event listeners after a short delay
  setTimeout(checkProviderEvents, 1000);

  // Claims Panel Functions
  async function loadClaimableMotivations() {
    const claimsLoading = $('claimsLoading');
    const claimsList = $('claimsList');

    if (!contract || !signer) {
      claimsLoading.textContent = '⚠️ Please connect your wallet first.';
      claimsList.innerHTML = '';
      return;
    }

    claimsLoading.style.display = 'block';
    claimsLoading.textContent = 'Loading your claimable motivations...';
    claimsList.innerHTML = '';

    try {
      const myAddress = await signer.getAddress();
      const claims = [];

      // Get safe block range to avoid RPC errors (last ~1-2 days of claims)
      const blockRange = await getSafeBlockRange();
      console.log(`🔍 Querying claims from block ${blockRange.fromBlock} to latest`);

      // Query TimelockedMotivationCreated events where I'm the recipient
      const timelockedEvents = await contract.queryFilter(
        contract.filters.TimelockedMotivationCreated(null, myAddress),
        blockRange.fromBlock,
        blockRange.toBlock
      );
      console.log(`🔍 Found ${timelockedEvents.length} time-locked events`);

      // Query ProofOfActionMotivationCreated events where I'm the recipient
      const proofOfActionEvents = await contract.queryFilter(
        contract.filters.ProofOfActionMotivationCreated(null, myAddress),
        blockRange.fromBlock,
        blockRange.toBlock
      );
      console.log(`🔍 Found ${proofOfActionEvents.length} proof-of-action events`);

      // Check each time-locked motivation (now with array indices)
      for (const event of timelockedEvents) {
        const sender = event.args.sender;
        const index = Number(event.args.index); // New: array index

        // Get specific motivation from array
        const lock = await contract.timeLocks(myAddress, sender, index);

        console.log(`Time-locked from ${sender} [${index}]:`, {
          amount: ethers.formatEther(lock.amount),
          claimed: lock.claimed,
          unlockTimestamp: lock.unlockTimestamp
        });

        if (lock.amount > 0n && !lock.claimed) {
          const now = Math.floor(Date.now() / 1000);
          const unlockDate = new Date(Number(lock.unlockTimestamp) * 1000);
          const isUnlocked = now >= Number(lock.unlockTimestamp);
          const daysRemaining = Math.ceil((Number(lock.unlockTimestamp) - now) / 86400);

          claims.push({
            type: 'timelocked',
            sender,
            index, // Include index for claiming
            amount: lock.amount,
            unlockTimestamp: lock.unlockTimestamp,
            unlockDate: unlockDate.toISOString().split('T')[0],
            isUnlocked,
            daysRemaining,
            message: event.args.message
          });
        }
      }
      const timelockedCount = claims.length;
      console.log(`✅ Processed time-locked: added ${timelockedCount} claims`);

      // Check each proof-of-action motivation (now with array indices)
      for (const event of proofOfActionEvents) {
        const sender = event.args.sender;
        const index = Number(event.args.index); // New: array index

        // Get specific motivation from array
        const poa = await contract.proofOfActions(myAddress, sender, index);

        console.log(`Proof-of-Action from ${sender} [${index}]:`, {
          amount: ethers.formatEther(poa.amount),
          claimed: poa.claimed,
          actionRequired: poa.actionRequired,
          eventAction: event.args.actionRequired
        });

        // Only show if not claimed
        if (poa.amount > 0n && !poa.claimed) {
          claims.push({
            type: 'proofOfAction',
            sender,
            index, // Include index for claiming
            amount: poa.amount,
            actionRequired: poa.actionRequired,
            message: event.args.actionRequired !== event.args.message ? event.args.message : null
          });
        }
      }
      const proofCount = claims.length - timelockedCount;
      console.log(`✅ Processed proof-of-action: added ${proofCount} claims`);

      claimsLoading.style.display = 'none';

      console.log(`📊 Total claimable motivations found: ${claims.length}`);
      claims.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.type} from ${c.sender.slice(0, 10)}... - ${ethers.formatEther(c.amount)} ETH`);
      });

      if (claims.length === 0) {
        claimsList.innerHTML = '<p style="color: #666;">You have no claimable motivations at this time.</p>';
        return;
      }

      // Display claims
      claims.forEach((claim, index) => {
        const card = document.createElement('div');
        card.className = 'claim-card';
        card.id = `claim-${index}`;

        let html = `<div class="claim-card-header">From: ${claim.sender.slice(0, 10)}...${claim.sender.slice(-8)}</div>`;
        html += `<div class="claim-card-detail">💰 Amount: ${ethers.formatEther(claim.amount)} ETH</div>`;

        if (claim.message) {
          html += `<div class="claim-card-detail">📝 "${claim.message}"</div>`;
        }

        if (claim.type === 'timelocked') {
          html += `<div class="claim-card-detail">📅 Unlock Date: ${claim.unlockDate}</div>`;
          if (claim.isUnlocked) {
            html += `<div class="claim-card-status status-ready">✅ Ready to claim!</div>`;
            html += `<div id="claim-message-${index}" style="margin-top: 8px; font-size: 14px; text-align: center;"></div>`;
            html += `<button class="claim-btn" onclick="window.claimTimelocked('${claim.sender}', ${claim.index}, ${index})">Claim Now</button>`;
          } else {
            html += `<div class="claim-card-status status-locked">🔒 Locked (${claim.daysRemaining} days remaining)</div>`;
            html += `<div id="claim-message-${index}" style="margin-top: 8px; font-size: 14px; text-align: center;"></div>`;
            html += `<button class="claim-btn" disabled>Claim</button>`;
          }
        } else if (claim.type === 'proofOfAction') {
          html += `<div class="claim-card-detail">📋 Action Required: "${claim.actionRequired}"</div>`;
          if (claim.message) {
            html += `<div class="claim-card-detail" style="margin-top: 4px;">💬 Sender's Note: "${claim.message}"</div>`;
          }
          html += `<div class="claim-card-status status-ready">✅ Ready to claim (provide proof)</div>`;
          html += `<textarea id="proof-${index}" class="proof-input" placeholder="Describe what you have executed to meet the goal. Blockchain will store and remember it..." rows="3"></textarea>`;
          html += `<div id="claim-message-${index}" style="margin-top: 8px; font-size: 14px; text-align: center;"></div>`;
          html += `<button class="claim-btn" onclick="window.claimProofOfAction('${claim.sender}', ${claim.index}, ${index})">Submit Proof & Claim</button>`;
        }

        card.innerHTML = html;
        claimsList.appendChild(card);
      });

    } catch (error) {
      console.error('Error loading claims:', error);
      claimsLoading.textContent = '❌ Error loading claims. Check console for details.';
    }
  }

  // Claim time-locked motivation
  window.claimTimelocked = async function(sender, contractIndex, displayIndex) {
    const btn = document.querySelector(`#claim-${displayIndex} button`);
    const messageDiv = document.getElementById(`claim-message-${displayIndex}`);
    const originalText = btn.textContent;

    try {
      btn.disabled = true;
      btn.textContent = 'Confirm in your wallet...';
      messageDiv.textContent = '';

      // Pass contract index (from array) to claim function
      const tx = await contract.claimTimelockedMotivation(sender, contractIndex);
      btn.textContent = 'Confirming...';
      const receipt = await tx.wait();

      // Check if transaction actually succeeded
      if (receipt.status === 0) {
        throw new Error('Transaction failed on-chain');
      }

      // Show success message above button (green checkbox, black text)
      btn.textContent = originalText;
      messageDiv.textContent = `✅ Time-locked motivation claimed in block ${receipt.blockNumber}`;
      messageDiv.style.color = '#000'; // Black text (checkbox is naturally green)

      // Wait 10 seconds before reloading claims (user can close modal anytime)
      setTimeout(() => {
        btn.disabled = false;
        messageDiv.textContent = '';
        loadClaimableMotivations();
      }, 10000);
    } catch (error) {
      console.error('Claim error:', error);

      // SPECIAL CASE: Ink RPC empty error (claim submission succeeds despite this error)
      if (error.message?.includes('could not coalesce error') && error.error?.message === '') {
        console.warn('⚠️ Ink RPC quirk: Empty error during claim submission');
        console.warn('💡 Wallet popup should still appear - polling for claim success...');

        // Wait 2 seconds before changing button text (give user time to see wallet popup)
        setTimeout(() => {
          btn.textContent = 'Waiting for confirmation...';
        }, 2000);
        messageDiv.textContent = '';

        // Get my address and start polling for claim event
        const myAddress = await signer.getAddress();
        const startBlock = await provider.getBlockNumber();

        let pollCount = 0;
        const maxPolls = 60; // 60 seconds

        const pollInterval = setInterval(async () => {
          pollCount++;

          try {
            const currentBlock = await provider.getBlockNumber();

            if (currentBlock > startBlock) {
              console.log(`🔍 Poll ${pollCount}: Checking for claim event...`);

              // Check for TimelockedMotivationClaimed event
              const claimEvents = await contract.queryFilter(
                contract.filters.TimelockedMotivationClaimed(myAddress, sender),
                startBlock,
                currentBlock
              );

              if (claimEvents.length > 0) {
                // Claim succeeded!
                clearInterval(pollInterval);
                const latestEvent = claimEvents[claimEvents.length - 1];

                btn.textContent = originalText;
                messageDiv.textContent = `✅ Time-locked motivation claimed in block ${latestEvent.blockNumber}`;
                messageDiv.style.color = '#000';
                console.log('✅ Claim confirmed via event polling!');

                setTimeout(() => {
                  btn.disabled = false;
                  messageDiv.textContent = '';
                  loadClaimableMotivations();
                }, 10000);
                return;
              }
            }

            // Timeout
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              btn.disabled = false;
              btn.textContent = originalText;
              messageDiv.textContent = '⏱️ Timed out. Refreshing claims...';
              messageDiv.style.color = '#666';
              setTimeout(() => {
                messageDiv.textContent = '';
                loadClaimableMotivations();
              }, 3000);
            }
          } catch (pollError) {
            console.warn('Poll error:', pollError);
          }
        }, 1000);

        return; // Exit without showing error
      }

      // Show error message for real errors
      let errorMsg = error.message || 'Claim failed';

      // Check for common errors
      if (errorMsg.includes('Already claimed')) {
        errorMsg = 'Already claimed (refreshing...)';
      } else if (errorMsg.includes('still locked')) {
        errorMsg = 'Still locked - check unlock date';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
        errorMsg = 'You cancelled the transaction';
      } else if (error.code === 'ACTION_REJECTED') {
        errorMsg = 'You cancelled the transaction';
      }

      messageDiv.textContent = `❌ ${errorMsg}`;
      messageDiv.style.color = 'red';

      // ALWAYS reload claims after 2 seconds to show actual state
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
        messageDiv.textContent = '';
        loadClaimableMotivations();
      }, 2000);
    }
  };

  // Claim proof-of-action motivation
  window.claimProofOfAction = async function(sender, contractIndex, displayIndex) {
    const btn = document.querySelector(`#claim-${displayIndex} button`);
    const messageDiv = document.getElementById(`claim-message-${displayIndex}`);
    const originalText = btn.textContent;

    try {
      const proofInput = document.getElementById(`proof-${displayIndex}`);
      const proof = proofInput.value.trim();

      if (!proof) {
        alert('Please provide a description of what you did.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Confirm in your wallet...';
      messageDiv.textContent = '';

      // Pass contract index (from array) to claim function
      const tx = await contract.claimProofOfAction(sender, contractIndex, proof);
      btn.textContent = 'Confirming...';
      const receipt = await tx.wait();

      // Check if transaction actually succeeded
      if (receipt.status === 0) {
        throw new Error('Transaction failed on-chain');
      }

      // Show success message above button (green checkbox, black text)
      btn.textContent = originalText;
      messageDiv.textContent = `✅ Proof-of-action motivation claimed in block ${receipt.blockNumber}`;
      messageDiv.style.color = '#000'; // Black text (checkbox is naturally green)

      // Wait 10 seconds before reloading claims (user can close modal anytime)
      setTimeout(() => {
        btn.disabled = false;
        messageDiv.textContent = '';
        loadClaimableMotivations();
      }, 10000);
    } catch (error) {
      console.error('Claim error:', error);

      // SPECIAL CASE: Ink RPC empty error (claim submission succeeds despite this error)
      if (error.message?.includes('could not coalesce error') && error.error?.message === '') {
        console.warn('⚠️ Ink RPC quirk: Empty error during claim submission');
        console.warn('💡 Wallet popup should still appear - polling for claim success...');

        // Wait 2 seconds before changing button text (give user time to see wallet popup)
        setTimeout(() => {
          btn.textContent = 'Waiting for confirmation...';
        }, 2000);
        messageDiv.textContent = '';

        // Get my address and start polling for claim event
        const myAddress = await signer.getAddress();
        const startBlock = await provider.getBlockNumber();

        let pollCount = 0;
        const maxPolls = 60; // 60 seconds

        const pollInterval = setInterval(async () => {
          pollCount++;

          try {
            const currentBlock = await provider.getBlockNumber();

            if (currentBlock > startBlock) {
              console.log(`🔍 Poll ${pollCount}: Checking for claim event...`);

              // Check for ProofOfActionClaimed event
              const claimEvents = await contract.queryFilter(
                contract.filters.ProofOfActionClaimed(myAddress, sender),
                startBlock,
                currentBlock
              );

              if (claimEvents.length > 0) {
                // Claim succeeded!
                clearInterval(pollInterval);
                const latestEvent = claimEvents[claimEvents.length - 1];

                btn.textContent = originalText;
                messageDiv.textContent = `✅ Proof-of-action motivation claimed in block ${latestEvent.blockNumber}`;
                messageDiv.style.color = '#000';
                console.log('✅ Claim confirmed via event polling!');

                setTimeout(() => {
                  btn.disabled = false;
                  messageDiv.textContent = '';
                  loadClaimableMotivations();
                }, 10000);
                return;
              }
            }

            // Timeout
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              btn.disabled = false;
              btn.textContent = originalText;
              messageDiv.textContent = '⏱️ Timed out. Refreshing claims...';
              messageDiv.style.color = '#666';
              setTimeout(() => {
                messageDiv.textContent = '';
                loadClaimableMotivations();
              }, 3000);
            }
          } catch (pollError) {
            console.warn('Poll error:', pollError);
          }
        }, 1000);

        return; // Exit without showing error
      }

      // Show error message for real errors
      let errorMsg = error.message || 'Claim failed';

      // Check for common errors
      if (errorMsg.includes('Already claimed')) {
        errorMsg = 'Already claimed (refreshing...)';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
        errorMsg = 'You cancelled the transaction';
      } else if (error.code === 'ACTION_REJECTED') {
        errorMsg = 'You cancelled the transaction';
      }

      messageDiv.textContent = `❌ ${errorMsg}`;
      messageDiv.style.color = 'red';

      // ALWAYS reload claims after 2 seconds to show actual state
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
        messageDiv.textContent = '';
        loadClaimableMotivations();
      }, 2000);
    }
  };

  // Make loadClaimableMotivations globally accessible
  window.loadClaimableMotivations = loadClaimableMotivations;

  // Add listener to load claims when panel opens
  const claimsLink = $('claimsLink');
  if (claimsLink) {
    claimsLink.addEventListener('click', () => {
      setTimeout(() => loadClaimableMotivations(), 100);
    });
  }

  console.log('✅ App initialized');
};

