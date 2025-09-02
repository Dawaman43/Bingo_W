import express from 'express';
import 'dotenv/config';
import connectDB from './configs/db.js';

// Initialize express
const app = express();

// Connect to database
await connectDB();



app.use(express.json());


// Test route
app.get('/', (req, res) => res.send("Server is running"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));