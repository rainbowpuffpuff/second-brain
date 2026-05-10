import { pipeline } from "@xenova/transformers";

// Simple custom memory vector store for MVP
class MemoryVectorStore {
    constructor(embeddings) {
        this.embeddings = embeddings;
        this.docs = [];
    }

    async addDocuments(documents) {
        const texts = documents.map(doc => doc.pageContent);
        const embeddedTexts = await this.embeddings.embedDocuments(texts);
        
        for (let i = 0; i < documents.length; i++) {
            this.docs.push({
                pageContent: documents[i].pageContent,
                embedding: embeddedTexts[i]
            });
        }
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async similaritySearch(query, k = 3) {
        const queryEmbedding = await this.embeddings.embedQuery(query);
        
        const results = this.docs.map(doc => ({
            pageContent: doc.pageContent,
            score: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }
}

// We create a wrapper around Xenova's transformers to match LangChain's Embeddings interface
class XenovaEmbeddings {
    constructor() {
        this.extractor = null;
        this.modelName = 'Xenova/all-MiniLM-L6-v2'; 
    }

    async init() {
        if (!this.extractor) {
            this.extractor = await pipeline('feature-extraction', this.modelName);
        }
    }

    async embedDocuments(texts) {
        await this.init();
        const embeddings = await Promise.all(
            texts.map(async (text) => {
                const output = await this.extractor(text, { pooling: 'mean', normalize: true });
                return Array.from(output.data);
            })
        );
        return embeddings;
    }

    async embedQuery(text) {
        await this.init();
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
}

class VectorStoreService {
    constructor(embeddings) {
        this.embeddings = embeddings;
        this.store = new MemoryVectorStore(this.embeddings);
    }

    // Simple chunking method for MVP
    chunkText(text, chunkSize = 500) {
        const words = text.split(' ');
        const chunks = [];
        let currentChunk = [];

        for (const word of words) {
            currentChunk.push(word);
            if (currentChunk.join(' ').length >= chunkSize) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [];
            }
        }
        
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
        }

        return chunks;
    }

    async addText(text) {
        // Clear previous memory for this specific store
        this.store.docs = [];
        
        const chunks = this.chunkText(text);
        const docs = chunks.map(chunk => ({
            pageContent: chunk,
            metadata: {}
        }));
        
        await this.store.addDocuments(docs);
        return chunks.length;
    }

    async searchContext(query, k = 3) {
        // Return top k matches
        const results = await this.store.similaritySearch(query, k);
        return results.map(r => r.pageContent).join('\n\n');
    }
}

class VectorStoreManager {
    constructor() {
        this.embeddings = new XenovaEmbeddings();
        this.stores = new Map(); // apiKey -> VectorStoreService
    }

    getStore(apiKey) {
        if (!this.stores.has(apiKey)) {
            this.stores.set(apiKey, new VectorStoreService(this.embeddings));
        }
        return this.stores.get(apiKey);
    }
}

// Export a singleton manager instance
export const vectorStoreManager = new VectorStoreManager();
