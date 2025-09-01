import express from 'express';
import 'dotenv/config';

// Initialize express
const app = express();


app.use(express.json());


// Test route
app.get('/', (req, res) => res.send("Server is running"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));