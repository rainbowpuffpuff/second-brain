# Second Brain Frontend

React app for the Second Brain creator studio and paid reader embed.

## Screens

- `/` Creator studio: connect wallet, upload text, view earnings, claim escrow funds, and copy the generated embed.
- `/embed/:apiKey` Reader embed: ask a question, pay the escrow contract, and unlock an archive-backed Venice AI answer.

## Configuration

The frontend uses a relative API path by default:

```text
/api
```

Override it with:

```bash
VITE_API_URL=https://your-api.example/api
```

For local Vite development, `/api` is proxied to `http://localhost:3000`.
For Vercel, `vercel.json` rewrites `/api/*` to the deployed VM backend.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

The wallet flow expects MegaETH chain ID `4326` and the escrow contract address configured in `src/App.jsx`.
