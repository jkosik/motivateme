# MotivateMe

Playground dApp (decentralised application) on Ink blockchain which allows users to send money directly or conditionally using Smart Contract.

## ⚠️ Disclaimer

**This project is an independent, educational application and is NOT affiliated with, endorsed by, or sponsored by:**
- Ink (blockchain network operators)
- Metamask, Kraken, other blockchain entities (company or wallet developers)
- Any other third-party services or trademarks mentioned in this repository

All trademarks, service marks, and company names are the property of their respective owners. This application is provided "as is" for educational and experimental purposes only. **Use at your own risk.**

## How to build Smart Contract
Use Foundry to interact with Ethereum network (L1/L2).
Foundry contains:
- `forge` - deploys smart contracts
- `cast` - CLI for interactiton with blockchain/nodes/contracts
- `anvil` - local Ethereum node
- `chisel` - Solidity playground

### Prepare the Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup

cd motivateme/contract-foundry/forge/

forge init --no-git

forge build # builds contracts form src/ and all deps. Not needed - build happens also when pushing the contract to the blockchain.
forge inspect src/Counter.sol:Counter abi
forge inspect src/Counter.sol:Counter bytecode
```

### Prepare contract deployer's awallet
```bash
cast wallet new
Successfully created new keypair.
Address:     0xxxxxx
Private key: 0xxxxxx

export WALLET_ADDRESS=0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
export WALLET_PRIVATE_KEY= 0xxxxx
```

For contract deployment we need some ETH.
- for Testnet use: https://docs.inkonchain.com/tools/faucets.
- For Mainnet, transfer ETHs from crypt exchange or use Ink Bridge to fund your wallet: https://inkonchain.com/bridge

Wallet balance defaults to Wei. Current contract balance can be checked the same way.
```bash
cast balance $WALLET_ADDRESS --rpc-url https://ink-sepolia.drpc.org [--ether] # balance on Testnet
cast balance $WALLET_ADDRESS --rpc-url https://rpc-gel.inkonchain.com [--ether] # balance on Mainnet
```

### Deploy the testing contract to Testnet
Note: There are safer ways of handling private key using Forge keystore. To dry-run, omit `--broadcast`
```bash
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


### Interact with the smart contract
Read the contract variable `number`:
```bash
cast call 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF "number()(uint256)" --rpc-url https://ink-sepolia.drpc.org
0
```

Call a contract function `increment()` and increment the `number` variable:
```bash
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

cast call 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF "number()(uint256)" --rpc-url https://ink-sepolia.drpc.org
1
```

*Contract address is a result of the private key and the nonce (sequential number of wallet's transactions). If we use new wallet and deploy the contract as a first transaction on Testnet and also on Mainnet, both contracts will have the same address on both chains.*


### Deploy MotivateMe contract with verification on Mainnet
```bash
forge create src/MotivateMe.sol:MotivateMe \
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
  src/MotivateMe.sol:MotivateMe
```

Check the contract and transaction:
- https://explorer.inkonchain.com/address/0x6a5d3Cd30EfC58C8A864f6536D350521ADAd6f64

## Build and run the app
### Local Development

```bash
# Option 1: Go server (production-like)
cd app/
npm install
npm run build
cd src/
go run main.go
# Visit: http://localhost:8080

# Option 2: Vite dev server (with hot reload)
cd app/
npm run dev
# Visit: http://localhost:5173
```

### Configuration
Edit `app/src/static/index.html`:
```javascript
const ACTIVE_NETWORK = INK_SEPOLIA;  // or INK_MAINNET. INK_SEPOLIA seems not supporting write operations for contracts
```

### Contract Address
Edit `app/src/static/index.html`:
```javascript
const CONTRACT_ADDRESS = '0x...';
```

## Further notes
### Transaction, View, Event
Solidity function can:
- Trigger transactions which consumes gas.
- Create views and returns contract state. Gas free if called as a standalone function. If nested within transaction function, it has impact on gas fee.
- Emit events, stored as transaction logs on the blockchain. Emitting cost gas, reading is gas free/

Views and Events are so-called off-chain (gas free) and are used block explorers and similar apps. Even though events are technically also stored on chain.
```
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
```

### Ink explorer
https://explorer-sepolia.inkonchain.com/ and https://explorer.inkonchain.com/ is based on Blockscout - an open-source blockchain explorer framework (for EVM-compatible chains). Lets you view transactions, contracts, addresses, blocks, tokens, and more.

### How to connect wallets to apps
https://docs.walletconnect.network/app-sdk/javascript/installation

### Tokens and Gas
On Ink L2, gas is always paid in ETH. Any ERC-20 (Ethereum-compatible) token can be transacted.

## Todo
- Oracle integration
- can we see events and messages in etherscan? or ink explorer?
- makefile?
- more responsive design for mobile.
