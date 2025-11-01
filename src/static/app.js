import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { ethers } from 'ethers'

// Configuration will be injected from HTML
window.initializeApp = async function(config) {
  const { ACTIVE_NETWORK, CONTRACT_ADDRESS, ABI, WALLETCONNECT_PROJECT_ID } = config;

  // State
  let provider, signer, contract, modal;

  const $ = (id) => document.getElementById(id);

  // Set contract address link
  const explorerUrl = `${ACTIVE_NETWORK.blockExplorerUrls[0]}/address/${CONTRACT_ADDRESS}`;
  $('contractAddr').textContent = CONTRACT_ADDRESS;
  $('contractAddr').href = explorerUrl;

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
      el.style.color = '#00d26a'; // Green when connected
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
    return $('recipientInput').value.trim();
  }

  function isValidAddress(address) {
    return address && /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Initialize provider and contract after connection
  async function initContract(walletProvider) {
    try {
      provider = new ethers.BrowserProvider(walletProvider);
      signer = await provider.getSigner();
      contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const acct = await signer.getAddress();
      const net = await provider.getNetwork();

      let networkName = ACTIVE_NETWORK.chainName;
      if (Number(net.chainId) !== ACTIVE_NETWORK.chainIdDecimal) {
        networkName = `Wrong network (${Number(net.chainId)})`;
      }

      setWalletInfo(`${acct.slice(0, 6)}...${acct.slice(-4)} · ${networkName}`, true);
      showActionsSection(true);
      setFunctionInfo('—'); // Clear function info when connected
      $('connectBtn').textContent = 'Wallet';
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
      setFunctionInfo('—');
      $('connectBtn').textContent = 'Connect wallet';
      provider = null;
      signer = null;
      contract = null;
    }
  });

  // Function dropdown
  $('functionSelect').onchange = async (e) => {
    const val = e.target.value;

    $('setValueInput').classList.add('hidden');

    if (!val) {
      setFunctionInfo('—');
      return;
    }

    if (!contract) {
      setFunctionInfo('Please connect wallet first');
      e.target.value = '';
      return;
    }

    if (val === 'read') {
      await readCounter();
    } else if (val === 'increment') {
      await incrementCounter();
    } else if (val === 'set') {
      $('setValueInput').classList.remove('hidden');
      setFunctionInfo('Enter value and press Enter');
    }

    e.target.value = '';
  };

  // Set value input
  $('valueInput').onkeypress = async (e) => {
    if (e.key === 'Enter') {
      await setCounter();
    }
  };

  // Contract interaction functions
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
      // Recipient validation could be added here if needed

      setFunctionInfo('Confirm transaction in your wallet...');
      const tx = await contract.increment();
      setFunctionInfo(`Confirming... ${tx.hash.slice(0, 10)}...`);
      const rec = await tx.wait();
      setFunctionInfo(`Confirmed in block ${rec.blockNumber}`);
    } catch (e) {
      console.error('Transaction error:', e);

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
      } else if (e.message) {
        // Shorten the error message if it's too long
        errorMsg = e.message.slice(0, 80);
      }

      setFunctionInfo(`Error: ${errorMsg}`);
    }
  }

  async function setCounter() {
    try {
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
      console.error('Transaction error:', e);

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
      } else if (e.message) {
        // Shorten the error message if it's too long
        errorMsg = e.message.slice(0, 80);
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

