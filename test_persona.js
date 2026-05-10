import fetch from 'node-fetch';
import fs from 'fs';

const API_URL = 'http://127.0.0.1:3000/api';
const DEMO_CREATOR = '0x000000000000000000000000000000000000dEaD';

async function testPersonaHandshake() {
    console.log("Uploading amir_context.txt...");
    const text = fs.readFileSync('./amir_context.txt', 'utf8');

    const uploadResponse = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, uploaderAddress: DEMO_CREATOR })
    });

    const uploadData = await uploadResponse.json();
    console.log("Upload response:", uploadData);

    if (!uploadResponse.ok) {
        process.exitCode = 1;
        return;
    }

    const question = "What is your perspective on narrative in crypto?";
    console.log(`Querying without payment: '${question}'`);

    const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${uploadData.apiKey}`
        },
        body: JSON.stringify({ question })
    });

    console.log(`Status: ${response.status}`);
    console.log("Response:", await response.json());
    console.log("Use the frontend embed for the full wallet payment and Venice answer path.");
}

testPersonaHandshake().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
