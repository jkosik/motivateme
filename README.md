# MotivateMe


Counter dApp on Ink blockchain with WalletConnect v2 support.

## Project Structure
```
.
├── contract-foundry/    # Smart Contract code
├── src/                 # App source code
│   ├── static/
│   │   └── index.html
│   └── main.go          # Go web server
├── dist/                # AppKit build files (build by npms)
├── package.json         # npm dependencies
└── vite.config.js       # Build configuration
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

Check wallet balance (balance is in Wei - 10^-18 ETH):
```
cast balance $WALLET_ADDRESS --rpc-url https://ink-sepolia.drpc.org [--ether]
cast balance $WALLET_ADDRESS --rpc-url https://rpc-gel.inkonchain.com [--ether]
```

### Deploy the contract to Testnet
Note: There are safer ways of handling private key using forge keystore.
Dry-run:
```
forge create src/Counter.sol:Counter \
  --rpc-url "https://ink-sepolia.drpc.org" \
  --private-key $WALLET_PRIVATE_KEY
```

Deployment:
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


**MotivateMe contract:**
```
forge create src/MotivateMe.sol:MotivateMe \
  --rpc-url "https://rpc-gel.inkonchain.com" \
  --private-key $WALLET_PRIVATE_KEY \
  --broadcast
[⠊] Compiling...
[⠒] Compiling 1 files with Solc 0.8.30
[⠢] Solc 0.8.30 finished in 34.21ms
Compiler run successful!
Deployer: 0x6CdeD5FbefBaAa5A5e885ED7D854c2fBb34bd598
Deployed to: 0xDe3FabeD53AE4D7d90C385621EcdEdc795189ea3
Transaction hash: 0xb0ff21a2e00d7eaf1628a599c587960fe3b2936a5a327353ed80cc1a4e98d357
```

Check the contract and transaction:
- https://explorer.inkonchain.com/address/0x1913E1cdA0814fa2aF01d7637caB81d088a43183

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
logsBloom            0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
root
status               1 (success)
transactionHash      0xfd0adaed8632985befd7583e84615094b4dbb5a38ef07e9f672b140247c77923
transactionIndex     2
type                 2
blobGasPrice
blobGasUsed
to                   0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF
l1BaseFeeScalar      801949
l1BlobBaseFee        1
l1BlobBaseFeeScalar  0
l1Fee                11548
l1GasPrice           9
l1GasUsed            1600
```

```
cast call 0x4fcC5C461B59ECC4786CDa6Ec270bA29Eb657FAF "number()(uint256)" --rpc-url https://ink-sepolia.drpc.org
1
```

## Build and run the app
`src/dist/` holds `@reown/appkit` NPM-built code

```bash
cd src/
npm install
npm run build

go run main.go
#or
npm run dev
```

## Configuration
### Network Selection
Edit `src/static/index.html`:
```javascript
const ACTIVE_NETWORK = INK_SEPOLIA;  // or INK_MAINNET. INK_SEPOLIA seems not supporting write operations for contracts
```

### Contract Address
Edit `src/static/index.html`:
```javascript
const CONTRACT_ADDRESS = '0x...';
```


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

