// Demo the upload step and HTTP 402 payment handshake.

const API_URL = 'http://127.0.0.1:3000/api';
const DEMO_CREATOR = '0x000000000000000000000000000000000000dEaD';

async function runDemo() {
    console.log("=== Second Brain x402 Handshake Demo ===\n");

    console.log("1. Uploading a small source archive...");
    const uploadResponse = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uploaderAddress: DEMO_CREATOR,
            text: "Second Brain turns a creator archive into a paid AI interface. Readers ask questions, the API returns HTTP 402 payment terms, and the creator earns when the answer is unlocked."
        })
    });

    const uploadData = await uploadResponse.json();
    console.log("Upload response:", uploadData, "\n");

    if (!uploadResponse.ok) {
        process.exitCode = 1;
        return;
    }

    console.log("2. Querying without payment to trigger x402 terms...");
    const queryResponse = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${uploadData.apiKey}`
        },
        body: JSON.stringify({ question: "What does Second Brain let creators do?" })
    });

    console.log(`Status: ${queryResponse.status}`);
    console.log("Response:", await queryResponse.json(), "\n");
    console.log("3. To complete the paid path, use the frontend embed so a wallet can send payForQuery(address).");
}

runDemo().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
