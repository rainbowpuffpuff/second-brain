# X402Escrow Contract

This Hardhat package contains the escrow contract used by Second Brain.

Readers pay the contract for a query with `payForQuery(address uploader)`. The contract credits the uploader's internal balance, and creators withdraw accumulated funds with `claimFunds()`.

## Contract

`contracts/X402Escrow.sol`

Core methods:

- `payForQuery(address uploader)` payable
- `balances(address uploader)` view
- `claimFunds()`

Events:

- `PaymentReceived(address user, address uploader, uint256 amount)`
- `FundsClaimed(address uploader, uint256 amount)`

## Commands

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network megaeth
```

The Hardhat config loads environment variables from the repo root `.env`.

```bash
ETHEREUM_PRIVATE_KEY_MEGAETH=your_deployer_private_key
ETHERSCAN_API_KEY=optional_verification_key
```

## Network

The app targets MegaETH:

```text
RPC: https://mainnet.megaeth.com/rpc
Chain ID: 4326
```

The frontend and backend currently point at:

```text
0xb1F7b214c4701478ED89DB478111f082b262b344
```
