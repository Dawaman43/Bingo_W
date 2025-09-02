import express from 'express';
import 'dotenv/config';
import connectDB from './configs/db.js';
import cors from 'cors';

// Initialize express
const app = express();

// Connect to database
await connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Frontend origin
  credentials: true                // Allow credentials 
}));



app.use(express.json());


// Test route
app.get('/', (req, res) => res.send("Server is running"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));