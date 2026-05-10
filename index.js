import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import apiRoutes from './src/routes/api.js';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies and enable CORS
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Health check route
app.get('/', (req, res) => {
    res.json({ status: "Second Brain API is running" });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Make sure your VENICE_API_KEY is set in the .env file!`);
});
