# Second Brain

Second Brain lets creators monetize their knowledge as a pay-per-answer AI embed.

Upload a text archive, publish the generated iframe, and let readers unlock answers through an x402-style HTTP 402 payment flow. Venice AI generates the response from retrieved source context, and a MegaETH escrow contract credits the creator for every paid query.

## Why It Matters

Valuable knowledge usually sits in essays, transcripts, docs, research notes, and community archives. Search is slow, generic chatbots do not pay creators, and subscriptions are too heavy for one-off questions.

Second Brain turns an archive into a paid API surface:

- Creators earn per answer.
- Readers pay only when they ask.
- The app returns machine-readable payment terms before serving gated content.
- The escrow contract keeps creator earnings claimable on-chain.

## Demo Flow

1. Connect a wallet in the creator studio.
2. Upload a `.txt` archive.
3. Copy the generated embed URL or iframe snippet.
4. Open the embed and ask a question.
5. The API returns `402 Payment Required` with amount, network, creator, and escrow details.
6. The frontend pays `payForQuery(address uploader)` on MegaETH.
7. The frontend retries the request with `X-Payment: <txHash>`.
8. The API verifies the payment, retrieves context, calls Venice AI, and returns the answer.
9. The creator claims accumulated escrow earnings.

## Architecture

```text
Creator browser
  -> React Brain Studio
  -> POST /api/upload
  -> in-memory API key map
  -> local Xenova embeddings
  -> isolated in-memory vector store

Reader browser
  -> React paid iframe
  -> POST /api/query
  -> HTTP 402 payment terms
  -> MegaETH X402Escrow.payForQuery(creator)
  -> retry with X-Payment tx hash
  -> payment verification
  -> vector retrieval
  -> Venice chat completion
  -> paid answer
```

## Tech Stack

- React, Vite, Tailwind CSS
- Express
- ethers v6
- Xenova `all-MiniLM-L6-v2` embeddings
- Venice AI chat completions
- Solidity escrow contract
- Hardhat
- MegaETH RPC and chain ID `4326`

## Run Locally

Create `.env` in the repo root:

```bash
VENICE_API_KEY=your_venice_key
ETHEREUM_PRIVATE_KEY_MEGAETH=optional_deployer_key
```

Start the API:

```bash
npm install
npm run dev
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Contract

The frontend and backend currently point at:

```text
0xb1F7b214c4701478ED89DB478111f082b262b344
```

The contract exposes:

- `payForQuery(address uploader)` for reader payments
- `balances(address)` for creator earnings
- `claimFunds()` for creator withdrawals

## API

`POST /api/upload`

```json
{
  "text": "source text",
  "uploaderAddress": "0x..."
}
```

Returns:

```json
{
  "message": "Context successfully added and bot created.",
  "chunks": 12,
  "apiKey": "..."
}
```

`POST /api/query`

Headers:

```text
Authorization: Bearer <apiKey>
X-Payment: <txHash>
```

Body:

```json
{
  "question": "What is the strongest idea in this archive?"
}
```

Without `X-Payment`, the API returns `402` with payment terms.

## Current MVP Limits

- API keys, uploaded brains, and used payment hashes are stored in process memory.
- Restarting the API clears uploaded brains.
- Payment replay protection is in-memory and should move to a database for production.
- The retrieval store is intentionally simple for the hackathon demo.
- Only `.txt` uploads are supported in the frontend.

## Product Direction

The strongest framing is creator-owned paid knowledge infrastructure. The next production step is persistence: store brains, creator profiles, payment receipts, and analytics in a database so creators can run durable paid knowledge embeds across their sites and communities.
