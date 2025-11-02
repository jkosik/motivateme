import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { ethers } from 'ethers'

// Configuration will be injected from HTML
window.initializeApp = async function(config) {
  const { ACTIVE_NETWORK, CONTRACT_ADDRESS, CONTRACT_ADDRESSES, ABI, WALLETCONNECT_PROJECT_ID } = config;

  // State
  let provider, signer, contract, modal;
  let currentContractAddress = CONTRACT_ADDRESS;

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
    if (isValidContractPrefix(address)) {
      updateContractAddress(address);
      setFunctionInfo('Custom contract applied');
      setTimeout(() => setFunctionInfo(''), 3000); // Clear message after 3 seconds
    } else {
      setFunctionInfo('Invalid address: must start with 0x');
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

  function isValidContractPrefix(address) {
    return address && address.startsWith('0x');
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
      }

      setWalletInfo(`${acct.slice(0, 6)}...${acct.slice(-4)} · ${networkName}`, true);
      showActionsSection(true);
      setFunctionInfo(''); // Clear function info when connected
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
      console.log('Wallet disconnected');
      setWalletInfo('Not connected');
      showActionsSection(false);
      setFunctionInfo('');
      $('connectBtn').textContent = 'Connect wallet';
      $('contractInfo').classList.add('hidden'); // Hide contract info
      $('walletBalance').classList.add('hidden'); // Hide balance
      provider = null;
      signer = null;
      contract = null;
    }
  });

  // Function dropdown - only show/hide input fields, don't trigger actions
  $('functionSelect').onchange = (e) => {
    const val = e.target.value;

    $('setValueInput').classList.add('hidden');
    setFunctionInfo('');

    if (val === 'set') {
      $('setValueInput').classList.remove('hidden');
      setFunctionInfo('Enter value, then click MotivateMe');
    }
  };

  // Function to read and log all contract events
  async function logContractEvents() {
    if (!contract) {
      console.log('⚠️ Contract not initialized');
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('📜 READING CONTRACT EVENT HISTORY FROM BLOCKCHAIN');
    console.log('═══════════════════════════════════════════════');
    console.log('');

    try {
      // Check if contract supports MotivateMe events
      if (!contract.filters.Gifted) {
        console.log('ℹ️ This contract does not emit MotivateMe events');
        console.log('   (Connected to Counter.sol or different contract)');
        console.log('');
        return;
      }
      // Query all Gifted events
      console.log('🎁 Querying all Gifted events...');
      const giftedEvents = await contract.queryFilter(
        contract.filters.Gifted()
      );
      console.log(`   Found ${giftedEvents.length} gift transactions`);

      if (giftedEvents.length > 0) {
        console.log('   Recent gifts:');
        giftedEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.args.sender} → ${event.args.recipient}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Query all PocketMoneyDeposited events
      console.log('💰 Querying all PocketMoney deposits...');
      const depositEvents = await contract.queryFilter(
        contract.filters.PocketMoneyDeposited()
      );
      console.log(`   Found ${depositEvents.length} pocket money deposits`);

      if (depositEvents.length > 0) {
        console.log('   Recent deposits:');
        depositEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.args.sender} → ${event.args.recipient}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Query all PocketMoneyWithdrawn events
      console.log('💸 Querying all PocketMoney withdrawals...');
      const withdrawalEvents = await contract.queryFilter(
        contract.filters.PocketMoneyWithdrawn()
      );
      console.log(`   Found ${withdrawalEvents.length} withdrawals`);

      if (withdrawalEvents.length > 0) {
        console.log('   Recent withdrawals:');
        withdrawalEvents.slice(-5).forEach((event, i) => {
          console.log(`   ${i + 1}. ${event.args.recipient}`);
          console.log(`      Amount: ${ethers.formatEther(event.args.amount)} ETH`);
          console.log(`      Block: ${event.blockNumber}`);
        });
      }
      console.log('');

      // Calculate statistics
      console.log('📊 CONTRACT STATISTICS:');
      console.log('═══════════════════════════════════════════════');

      // Unique recipients
      const allRecipients = new Set([
        ...giftedEvents.map(e => e.args.recipient),
        ...depositEvents.map(e => e.args.recipient)
      ]);
      console.log(`   Total unique recipients: ${allRecipients.size}`);

      // Total amounts
      const totalGifted = giftedEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      const totalDeposited = depositEvents.reduce((sum, e) => sum + e.args.amount, 0n);
      const totalWithdrawn = withdrawalEvents.reduce((sum, e) => sum + e.args.amount, 0n);

      console.log(`   Total gifted: ${ethers.formatEther(totalGifted)} ETH`);
      console.log(`   Total deposited: ${ethers.formatEther(totalDeposited)} ETH`);
      console.log(`   Total withdrawn: ${ethers.formatEther(totalWithdrawn)} ETH`);
      console.log(`   Locked in contract: ${ethers.formatEther(totalDeposited - totalWithdrawn)} ETH`);

      // Contract balance (current state)
      const contractBalance = await contract.getBalance();
      console.log(`   Actual contract balance: ${ethers.formatEther(contractBalance)} ETH`);

      console.log('═══════════════════════════════════════════════');
      console.log('✅ Event history loaded successfully!');
      console.log('');

    } catch (error) {
      console.error('❌ Error reading events:', error);
    }
  }

  // MotivateMe button - triggers the selected action with validation
  $('motivateBtn').onclick = async () => {
    const val = $('functionSelect').value;

    if (!val) {
      setFunctionInfo('❌ Please select a motivation first');
      return;
    }

    if (!contract) {
      setFunctionInfo('❌ Please connect wallet first');
      return;
    }

    // Log all contract events first
    console.log('🔍 Reading contract event history...');
    await logContractEvents();

    // Read doesn't need recipient validation, but increment and set do
    if (val === 'read') {
      await readCounter();
    } else if (val === 'increment') {
      await incrementCounter();
    } else if (val === 'set') {
      await setCounter();
    }
  };

  // Set value input
  $('valueInput').onkeypress = async (e) => {
    if (e.key === 'Enter') {
      await setCounter();
    }
  };

  // Contract interaction functions
  async function updateBalance() {
    try {
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balance);
      $('balanceAmount').textContent = `${balanceEth} ETH`;
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

  async function incrementCounter() {
    try {
      const recipient = getRecipientAddress();
      if (!recipient) {
        return; // Error message already set by getRecipientAddress()
      }

      setFunctionInfo('Confirm transaction in your wallet...');
      const tx = await contract.increment();
      setFunctionInfo(`Confirming... ${tx.hash.slice(0, 10)}...`);
      const rec = await tx.wait();
      setFunctionInfo(`Confirmed in block ${rec.blockNumber}`);
    } catch (e) {
      console.error('Transaction error (full details):', e);

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

  async function setCounter() {
    try {
      const recipient = getRecipientAddress();
      if (!recipient) {
        return; // Error message already set by getRecipientAddress()
      }

      const val = $('valueInput').value;
      if (!val) {
        setFunctionInfo('Please enter a value');
        return;
      }
      setFunctionInfo(`Setting to ${val}... Confirm in your wallet`);
      const tx = await contract.setNumber(BigInt(val));
      setFunctionInfo(`Confirming... ${tx.hash.slice(0, 10)}...`);
      const rec = await tx.wait();
      setFunctionInfo(`Set to ${val} in block ${rec.blockNumber}`);
      $('valueInput').value = '';
      $('setValueInput').classList.add('hidden');
    } catch (e) {
      console.error('Transaction error (full details):', e);

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

  // Listen for account/chain changes
  if (window.ethereum) {
    window.ethereum.on?.('chainChanged', () => location.reload());
    window.ethereum.on?.('accountsChanged', () => location.reload());
  }

  console.log('✅ App initialized');
};

