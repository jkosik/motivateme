# MotivateMe


Counter dApp on Ink blockchain with WalletConnect v2 support.

## Project Structure
```
.
├── ansible/             # Ansible playbooks for K3s deployment
│   ├── inventory/       # Server inventory
│   ├── roles/           # Ansible roles (common, k3s)
│   ├── playbook.yml     # Main deployment playbook
│   └── README.md        # Deployment guide
├── app/                 # Application code
│   ├── package.json     # NPM dependencies for frontend build
│   ├── vite.config.js   # Vite build configuration
│   ├── dist/            # Built frontend (output by Vite)
│   └── src/
│       ├── static/      # Frontend source
│       │   ├── index.html
│       │   ├── app.js
│       │   └── logo.png
│       └── main.go      # Go web server
└── contract-foundry/    # Smart Contract code
    └── forge/
        └── src/
            ├── Counter.sol
            └── MotivateMe.sol
```


## Todo
- Just smile and time-based release
- Manual confirmation from sender
- Oracle integration
- can we see events in etherscan? or ink explorer?
- makefile?
- unverified contract

## Build Smart Contract
Use Foundry to interact with Ethereum network.
Foundry contains:
- `forge` - deploys smart contracts
- `cast` - CLI for interatciton with blockchain/nodes/contracts
- `anvil` - local Ethereum node
- `chisel` - Solidity playground

### Prepare the Foundry
```
curl -L https://foundry.paradigm.xyz | bash
foundryup

# build forge directory structure
cd motivateme/contract-foundry/forge/
forge init --no-git
```

### Develop the Smart Contract using Forge
While being in `cd motivateme/contract-foundry/forge` run `forge build` which compiles contracts from `src/` and dependencies.

```
forge inspect src/Counter.sol:Counter abi
forge inspect src/Counter.sol:Counter bytecode
```

### Prepare a wallet
```
cast wallet new
Successfully created new keypair.
Address:     0xxxxxx
Private key: 0xxxxxx
```

```
export WALLET_ADDRESS=0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
export WALLET_PRIVATE_KEY=
```

For contract deployment we need some ETH. For testnet, use: https://docs.inkonchain.com/tools/faucets. For mainnet, trasfer from exchange or use Ink Bridge: https://inkonchain.com/bridge

Check wallet balance (balance defaults to Wei - 10^-18 ETH). Contract balance can be checked the same ways.
```
cast balance $WALLET_ADDRESS --rpc-url https://ink-sepolia.drpc.org [--ether]
cast balance $WALLET_ADDRESS --rpc-url https://rpc-gel.inkonchain.com [--ether]
```

### Deploy the contract to Testnet
Note: There are safer ways of handling private key using forge keystore. To dry-run, omit `--broadcast`
```
forge create src/Counter.sol:Counter \
  --rpc-url "https://ink-sepolia.drpc.org" \
  --private-key $WALLET_PRIVATE_KEY \
  --broadcast
[⠊] Compiling...
No files changed, compilation skipped
Deployer: 0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
Deployed to: 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF
Transaction hash: 0x5ec7e54d85e9314c1f971b5d9fa8234fe04c1b36ea9a7543f287e5d88a8d6927
```

Check the contract and transaction:
- https://explorer-sepolia.inkonchain.com/address/0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF


### Interact with contract
Read the variable `number` from the contract:
```
cast call 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF "number()(uint256)" --rpc-url https://ink-sepolia.drpc.org
0
```

Call a function and increment the `number` value
```
cast send 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF "increment()" \
  --rpc-url https://ink-sepolia.drpc.org \
  --private-key $WALLET_PRIVATE_KEY
contractAddress
cumulativeGasUsed    12378464
effectiveGasPrice    253
from                 0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
gasUsed              43482
logs                 []
...SNIPPED...
```

```
cast call 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF "number()(uint256)" --rpc-url https://ink-sepolia.drpc.org
1
```

### Deploy the contract to Mainnet
```
forge create src/Counter.sol:Counter \
  --rpc-url "https://rpc-gel.inkonchain.com" \
  --private-key $WALLET_PRIVATE_KEY \
  --broadcast
[⠊] Compiling...
[⠒] Compiling 1 files with Solc 0.8.30
[⠢] Solc 0.8.30 finished in 6.66ms
Compiler run successful!
Deployer: 0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
Deployed to: 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF
Transaction hash: 0xe6e1469031d858025e8785bf3470d005e29d7d5a928c75b2b29ce09891551706
```

Check the contract and transaction:
- https://explorer.inkonchain.com/address/0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF

Contract address is a result of the private key and the nonce (sequential number of wallet's transactions).
If we use new wallet and deploy the contract as a first transaction on Testnet and also on Mainnet, both contracts will have the same address on both chains.


### Final MotivateMe contract with verification
```
forge create src/MotivateMe-v3.sol:MotivateMe \
  --rpc-url "https://rpc-gel.inkonchain.com" \
  --private-key $WALLET_PRIVATE_KEY \
  --broadcast
[⠊] Compiling...
No files changed, compilation skipped
Deployer: 0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
Deployed to: 0x6a5d3Cd30EfC58C8A864f6536D350521ADAd6f64
Transaction hash: 0x5011169bf0feec7e51e788b2d86503a049680de94d5951b717bb91ea677e9c6f

forge verify-contract \
  --chain-id 57073 \
  --verifier blockscout \
  --verifier-url https://explorer.inkonchain.com/api/ \
  --watch \
  0x6a5d3Cd30EfC58C8A864f6536D350521ADAd6f64 \
  src/MotivateMe-v3.sol:MotivateMe
```

Check the contract and transaction:
- https://explorer.inkonchain.com/address/0x6a5d3Cd30EfC58C8A864f6536D350521ADAd6f64


## Build and run the app

The `app/dist/` directory holds the Vite-built frontend code (bundled Reown AppKit, ethers.js, etc.)

```bash
# Build frontend
cd app/
npm install
npm run build

# Run Go server (serves from app/dist/)
cd src/
go run main.go

# Or for development (Vite dev server)
cd app/
npm run dev
```

## Configuration
### Network Selection
Edit `app/src/static/index.html`:
```javascript
const ACTIVE_NETWORK = INK_SEPOLIA;  // or INK_MAINNET. INK_SEPOLIA seems not supporting write operations for contracts
```

### Contract Address
Edit `app/src/static/index.html`:
```javascript
const CONTRACT_ADDRESS = '0x...';
```

## Production Deployment

### Automated K3s Deployment with Ansible

For production deployment on Hetzner (or any Ubuntu 24.04 VM), use the provided Ansible playbooks.

**Quick Start:**

```bash
cd ansible

# 1. Edit inventory and set your VM's IP
nano inventory/hosts.yml

# 2. Run playbook
ansible-playbook -i inventory/hosts.yml playbook.yml

# 3. SSH to VM - kubectl ready immediately
ssh root@YOUR_VM_IP
kubectl get nodes
```

**Full documentation:** [`ansible/README.md`](ansible/README.md)

## Further notes
### Transaction, View, Event
Solidity function can:
- Trigger transactions which consumes gas.
- Create views and returns contract state. Gas free if called as a standalone function. If nested within transaction function, it has impact on gas fee.
- Emit events, stored as transaction logs on the blockchain. Emitting cost gas, reading is gas free/

Views and Events are mostly read so-called off-chain (gas free) - by apps e.g. using ethers.js or by block explorers.
Even-though events are technically also stored on chain.

Transaction
├─ Transaction Data
│  ├─ From: 0xBob...
│  ├─ To: 0xContract...
│  ├─ Value: 1.2 ETH
│  ├─ Gas Used: 75,000
│  └─ Function: pocketMoney(0xAlice)
│
└─ Transaction Receipt/Logs
   ├─ Status: Success ✅
   ├─ Block Number: 12345678
   └─ Events (logs):
       └─ PocketMoneyDeposited(0xBob, 0xAlice, 1.2 ETH)


### Ink explorer
https://explorer-sepolia.inkonchain.com/ and https://explorer.inkonchain.com/ is based on Blockscout - an open-source blockchain explorer framework (for EVM-compatible chains). Lets you view transactions, contracts, addresses, blocks, tokens, and more.

### How to connect wallets to apps
https://docs.walletconnect.network/app-sdk/javascript/installation

### Gas
On Ink L2, gas is always paid in ETH. Any ERC-20 (Ethereum-compatible) token can be transacted.

