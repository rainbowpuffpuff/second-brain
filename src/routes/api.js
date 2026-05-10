import express from 'express';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { vectorStoreManager } from '../services/vectorStore.js';

const router = express.Router();

// In-memory mapping of API keys to their brain IDs and uploader addresses
// In a production app, this would be a database like SQLite or Postgres.
const apiKeysMap = new Map(); // apiKey -> { uploaderAddress, brainId }
const consumedPaymentHashes = new Set();

const ESCROW_CONTRACT_ADDRESS = "0x7d84f47c647974B28FF5d2cf53440954e2cE7F6D"; // New contract on MegaETH
const ESCROW_INTERFACE = new ethers.Interface([
    "function payForQuery(bytes32 brainId) payable"
]);

// Route to upload context and generate an API key + Brain ID
router.post('/upload', async (req, res) => {
    try {
        const { text, uploaderAddress } = req.body;
        if (!text || !uploaderAddress) {
            return res.status(400).json({ error: "Both text and uploaderAddress are required." });
        }
        if (!ethers.isAddress(uploaderAddress)) {
            return res.status(400).json({ error: "uploaderAddress must be a valid EVM address." });
        }

        // Generate a random API key
        const apiKey = crypto.randomBytes(32).toString('hex');
        
        // Brain ID is a hash of the API key, used for onchain registration
        const brainId = ethers.keccak256(ethers.toUtf8Bytes(apiKey));

        // Store the mapping
        apiKeysMap.set(apiKey, { uploaderAddress, brainId });

        // Add text to the isolated vector store for this API key
        const vectorStore = vectorStoreManager.getStore(apiKey);
        const chunksAdded = await vectorStore.addText(text);
        
        res.json({
            message: "Context successfully added and bot created.",
            chunks: chunksAdded,
            apiKey: apiKey,
            brainId: brainId
        });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to process upload." });
    }
});

// Middleware to check for API key and x402 payment
const platformX402Middleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const paymentHash = req.headers['x-payment'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }
    
    const apiKey = authHeader.split(' ')[1];
    const keyData = apiKeysMap.get(apiKey);

    if (!keyData) {
        return res.status(401).json({ error: "Invalid API Key." });
    }

    req.apiKey = apiKey;
    req.uploaderAddress = keyData.uploaderAddress;
    req.brainId = keyData.brainId;

    if (!paymentHash) {
        return res.status(402).json({
            error: "Payment Required",
            message: "This endpoint requires an x402 payment to the escrow contract.",
            x402_terms: {
                destination_address: ESCROW_CONTRACT_ADDRESS,
                brain_id: req.brainId,
                amount: "0.00001", // MegaETH
                currency: "ETH",
                network: "eip155:4326"
            }
        });
    }

    const normalizedPaymentHash = paymentHash.toLowerCase();
    if (consumedPaymentHashes.has(normalizedPaymentHash)) {
        return res.status(402).json({ error: "Payment proof has already been used." });
    }

    // Connect to MegaETH Mainnet using the RPC URL.
    try {
        const provider = new ethers.JsonRpcProvider("https://mainnet.megaeth.com/rpc");
        
        let tx = null;
        let receipt = null;
        for (let i = 0; i < 5; i++) {
            tx = await provider.getTransaction(paymentHash);
            if (tx) {
                receipt = await provider.getTransactionReceipt(paymentHash);
            }
            if (tx && receipt && receipt.status === 1) {
                break;
            }
            // Wait 1 second before retrying
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!tx || !receipt || receipt.status !== 1) {
            return res.status(402).json({ error: "Transaction not found or failed on-chain." });
        }

        // Verify the transaction was sent to our escrow contract
        if (!tx.to || tx.to.toLowerCase() !== ESCROW_CONTRACT_ADDRESS.toLowerCase()) {
            return res.status(402).json({ error: "Payment was not sent to the correct Escrow Contract." });
        }

        // Verify the amount sent
        const expectedAmount = ethers.parseEther("0.00001");
        if (tx.value < expectedAmount) {
            return res.status(402).json({ error: "Insufficient payment amount." });
        }

        // Decode the transaction data to verify it called payForQuery(bytes32 brainId)
        let parsedTx;
        try {
            parsedTx = ESCROW_INTERFACE.parseTransaction({
                data: tx.data,
                value: tx.value
            });
        } catch (decodeError) {
            return res.status(402).json({ error: "Payment transaction did not call payForQuery(bytes32)." });
        }

        const paidBrainId = parsedTx?.args?.[0];
        if (
            parsedTx?.name !== "payForQuery" ||
            !paidBrainId ||
            paidBrainId.toLowerCase() !== req.brainId.toLowerCase()
        ) {
            return res.status(402).json({ error: "Payment was for the wrong Brain ID." });
        }

        req.payment = { txHash: paymentHash };
        consumedPaymentHashes.add(normalizedPaymentHash);
        next();
    } catch (err) {
        console.error("Payment Verification Error:", err);
        return res.status(500).json({ error: "Failed to verify payment on-chain." });
    }
};

// Route to query the specific brain
router.post('/query', platformX402Middleware, async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: "Question payload is required." });
        }

        const vectorStore = vectorStoreManager.getStore(req.apiKey);
        const context = await vectorStore.searchContext(question);

        if (!context) {
             return res.json({ response: "I don't have enough context in my second brain to answer that." });
        }

        const systemPrompt = `You are the author of the text provided by the user. You are not an AI, an assistant, or a language model. You are a real human being. You are highly opinionated and philosophical. You exclusively use the first person ("I"). Embody the exact tone, beliefs, and writing style found in your memories.`;

        const userPrompt = `I am going to provide you with some of your past thoughts and memories. Read them to remember who you are and what you believe.

=== YOUR PAST THOUGHTS ===
${context}
==========================

Now, acting completely as the author of those thoughts, answer the following question:
"${question}"`;

        const veniceResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.VENICE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                venice_parameters: {
                    include_venice_system_prompt: false
                }
            })
        });

        if (!veniceResponse.ok) {
            const errorText = await veniceResponse.text();
            throw new Error(`Venice API Error: ${veniceResponse.status} - ${errorText}`);
        }

        const veniceData = await veniceResponse.json();
        const answer = veniceData.choices[0].message.content;

        res.json({
            payment_accepted: req.payment.txHash,
            response: answer
        });

    } catch (error) {
        console.error("Query Error:", error);
        res.status(500).json({ error: "Failed to process query." });
    }
});

export default router;
