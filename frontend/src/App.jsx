import { useState } from 'react';
import { ethers } from 'ethers';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import brainVisual from './assets/hero.png';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ESCROW_CONTRACT_ADDRESS = '0xb1F7b214c4701478ED89DB478111f082b262b344';
const MEGAETH_CHAIN_ID = 4326;
const QUERY_PRICE_ETH = '0.00001';

const ESCROW_ABI = [
  'function balances(address) view returns (uint256)',
  'function claimFunds() nonpayable',
  'function payForQuery(address uploader) payable',
];

const sampleQuestions = [
  'What would you say about AI agents as paid media?',
  'Which idea from your archive matters most right now?',
  'How should a reader act on this knowledge?',
];

const productSteps = [
  ['1', 'Upload source text', 'Turn essays, notes, docs, transcripts, or research into a queryable brain.'],
  ['2', 'Publish the embed', 'Drop a wallet-native iframe into any site, profile, or community page.'],
  ['3', 'Earn per answer', 'Readers pay the escrow contract and the creator claims accumulated revenue.'],
];

function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(balance) {
  const numeric = Number(balance);
  if (!Number.isFinite(numeric)) return balance;
  if (numeric === 0) return '0';
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

async function ensureMegaEthNetwork() {
  const network = await window.ethereum.request({ method: 'eth_chainId' });
  if (Number(network) === MEGAETH_CHAIN_ID) return;

  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: ethers.toBeHex(MEGAETH_CHAIN_ID) }],
  });
}

function WalletButton({ wallet, onConnect, compact = false }) {
  return (
    <button
      type="button"
      onClick={onConnect}
      className={`inline-flex items-center justify-center border border-slate-950 bg-slate-950 font-semibold text-white transition hover:bg-slate-800 ${
        compact ? 'h-9 rounded-md px-3 text-xs' : 'h-11 rounded-lg px-4 text-sm'
      }`}
    >
      {wallet ? shortAddress(wallet) : 'Connect Wallet'}
    </button>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function ProcessStep({ number, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
        {number}
      </div>
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </div>
  );
}

function UploaderDashboard() {
  const [wallet, setWallet] = useState(null);
  const [provider, setProvider] = useState(null);
  const [balance, setBalance] = useState('0');
  const [contextStatus, setContextStatus] = useState('Upload a .txt archive to deploy your first paid brain.');
  const [apiKey, setApiKey] = useState('');
  const [uploadMeta, setUploadMeta] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState('');

  const embedUrl = apiKey ? `${window.location.origin}/embed/${apiKey}` : '';
  const iframeSnippet = apiKey
    ? `<iframe src="${embedUrl}" width="420" height="620" frameborder="0"></iframe>`
    : '';

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install a Web3 wallet.');
      return;
    }

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await ensureMegaEthNetwork();
      const accounts = await browserProvider.send('eth_requestAccounts', []);

      setProvider(browserProvider);
      setWallet(accounts[0]);
      checkBalance(accounts[0], browserProvider);
    } catch (err) {
      console.error('Connection failed', err);
      alert('Wallet connection failed. Confirm MegaETH is available in your wallet.');
    }
  };

  const checkBalance = async (address, ethProvider) => {
    try {
      const contract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, ethProvider);
      const bal = await contract.balances(address);
      setBalance(ethers.formatEther(bal));
    } catch (err) {
      console.error('Failed to fetch balance', err);
    }
  };

  const claimFunds = async () => {
    if (!wallet || !provider) return;

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, signer);
      const tx = await contract.claimFunds();
      await tx.wait();
      await checkBalance(wallet, provider);
      alert('Funds claimed successfully.');
    } catch (err) {
      console.error('Claim failed', err);
      alert('Failed to claim funds. Check the console for details.');
    }
  };

  const copyText = async (label, text) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1400);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  };

  const handleFileUpload = async (event) => {
    if (!wallet) {
      alert('Connect your wallet before deploying a brain.');
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const text = loadEvent.target.result;
      setIsUploading(true);
      setContextStatus('Embedding source text and preparing the paid query endpoint...');

      try {
        const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, uploaderAddress: wallet }),
        });

        const data = await res.json();

        if (res.ok) {
          setApiKey(data.apiKey);
          setUploadMeta({
            fileName: file.name,
            chunks: data.chunks,
            characters: text.length,
          });
          setContextStatus('Brain deployed. The embed now requires payment before each answer.');
        } else {
          setContextStatus(data.error || `Failed to upload context: ${res.statusText}`);
        }
      } catch (error) {
        setContextStatus(`Error: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <img src={brainVisual} alt="" className="h-14 w-14 object-contain" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Second Brain</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Monetize an archive as a paid AI embed.
              </h1>
            </div>
          </div>
          <WalletButton wallet={wallet} onConnect={connectWallet} />
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          <Metric label="Price per answer" value={`${QUERY_PRICE_ETH} ETH`} detail="Returned as HTTP 402 terms" />
          <Metric label="Network" value="MegaETH" detail="eip155:4326" />
          <Metric label="Escrow" value={shortAddress(ESCROW_CONTRACT_ADDRESS)} detail="Creator balances on-chain" />
          <Metric label="Pending earnings" value={`${formatBalance(balance)} ETH`} detail={wallet ? shortAddress(wallet) : 'Connect to read'} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Brain Studio</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Upload a text archive, generate an isolated API key, and publish an iframe that unlocks answers only after a reader pays the escrow contract.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={claimFunds}
                  disabled={!wallet || Number(balance) === 0}
                  className="h-10 rounded-lg border border-emerald-700 bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Claim Earnings
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {productSteps.map(([number, title, body]) => (
                  <ProcessStep key={number} number={number} title={title} body={body} />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Source Upload</h2>
                  <p className="mt-1 text-sm text-slate-600">Use a clean text export for the strongest retrieval and voice match.</p>
                </div>
                {uploadMeta && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {uploadMeta.chunks} chunks from {uploadMeta.fileName}
                  </div>
                )}
              </div>

              <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-slate-500 hover:bg-white">
                <span className="text-sm font-semibold text-slate-950">
                  {isUploading ? 'Deploying brain...' : 'Choose .txt archive'}
                </span>
                <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Essays, transcripts, docs, research notes, support knowledge bases, or creator archives work well for the demo.
                </span>
                <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>
              <p className="mt-3 text-sm font-medium text-slate-700">{contextStatus}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Deployment Package</h2>
                  <p className="mt-1 text-sm text-slate-600">Everything needed to put the paid brain in front of readers.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${apiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  {apiKey ? 'Ready' : 'Waiting for upload'}
                </span>
              </div>

              {apiKey ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Embed URL</p>
                      <button type="button" onClick={() => copyText('url', embedUrl)} className="text-sm font-semibold text-violet-700">
                        {copied === 'url' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-sm text-slate-100">{embedUrl}</pre>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Iframe snippet</p>
                      <button type="button" onClick={() => copyText('iframe', iframeSnippet)} className="text-sm font-semibold text-violet-700">
                        {copied === 'iframe' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-sm text-slate-100">{iframeSnippet}</pre>
                  </div>
                </div>
              ) : (
                <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  After upload, this section will show the public embed URL, iframe snippet, and API key-backed route for the deployed brain.
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-950">Paid Embed Preview</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This is the reader-facing experience: ask, receive payment terms, pay, and unlock the archive-backed answer.
              </p>
              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-950">Paid Brain</p>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">{QUERY_PRICE_ETH} ETH</span>
                  </div>
                </div>
                <div className="space-y-3 p-4 text-sm">
                  <div className="rounded-lg bg-white p-3 text-slate-600 shadow-sm">
                    What is the strongest argument in this archive?
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-violet-900">
                    HTTP 402 returned payment terms. Send escrow payment to unlock the answer.
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                    Payment verified. Venice response generated from retrieved source chunks.
                  </div>
                </div>
              </div>
              {embedUrl && (
                <a
                  href={embedUrl}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-950 bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open Live Embed
                </a>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-950">Demo Questions</h2>
              <div className="mt-4 space-y-2">
                {sampleQuestions.map((question) => (
                  <div key={question} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {question}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ChatMessage({ role, children }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 ${
          isUser ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function EmbedChatbot() {
  const { apiKey } = useParams();
  const [wallet, setWallet] = useState(null);
  const [provider, setProvider] = useState(null);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ask this paid brain a question. Each answer is unlocked by an escrow payment.',
    },
  ]);
  const [isQuerying, setIsQuerying] = useState(false);

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install a Web3 wallet.');
      return;
    }

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await ensureMegaEthNetwork();
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      setProvider(browserProvider);
      setWallet(accounts[0]);
    } catch (err) {
      console.error('Connection failed', err);
      alert('Wallet connection failed. Confirm MegaETH is available in your wallet.');
    }
  };

  const pushMessage = (role, content) => {
    setMessages((current) => [...current, { role, content }]);
  };

  const handleQuery = async () => {
    const question = query.trim();
    if (!question) return;

    if (!wallet || !provider) {
      alert('Connect your wallet before asking a paid question.');
      return;
    }

    setIsQuerying(true);
    setQuery('');
    pushMessage('user', question);

    try {
      let res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ question }),
      });

      if (res.status === 402) {
        const data = await res.json();
        const terms = data.x402_terms;
        pushMessage('assistant', `Payment required: ${terms.amount} ${terms.currency} on ${terms.network}. Confirm the escrow payment to continue.`);

        const signer = await provider.getSigner();
        const contract = new ethers.Contract(terms.destination_address, ESCROW_ABI, signer);
        const tx = await contract.payForQuery(terms.uploader_address, {
          value: ethers.parseEther(terms.amount),
          gasLimit: 150000,
        });

        pushMessage('assistant', `Payment submitted: ${tx.hash}. Waiting for confirmation.`);
        await tx.wait();

        res = await fetch(`${API_URL}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-Payment': tx.hash,
          },
          body: JSON.stringify({ question }),
        });
      }

      if (res.ok) {
        const finalData = await res.json();
        pushMessage('assistant', finalData.response);
      } else {
        const errText = await res.text();
        pushMessage('assistant', `Request failed: ${errText}`);
      }
    } catch (error) {
      console.error(error);
      pushMessage('assistant', `Error: ${error.message}`);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 p-3 text-slate-900">
      <section className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-md flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Paid Brain Embed</p>
              <p className="mt-1 text-xs text-slate-500">{QUERY_PRICE_ETH} ETH per answer on MegaETH</p>
            </div>
            <WalletButton wallet={wallet} onConnect={connectWallet} compact />
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {messages.map((message, index) => (
            <ChatMessage key={`${message.role}-${index}`} role={message.role}>
              <span className="whitespace-pre-wrap">{message.content}</span>
            </ChatMessage>
          ))}
        </div>

        <footer className="border-t border-slate-200 bg-white p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleQuery();
              }}
              placeholder="Ask this archive..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-950"
            />
            <button
              type="button"
              onClick={handleQuery}
              disabled={isQuerying || !wallet}
              className="h-10 rounded-lg border border-violet-700 bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isQuerying ? 'Paying' : 'Ask'}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploaderDashboard />} />
        <Route path="/embed/:apiKey" element={<EmbedChatbot />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
