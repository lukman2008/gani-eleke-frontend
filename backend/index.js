const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const landRentRoutes = require('./routes/landRentRoutes');

const app = express();
const port = process.env.PORT || 5000;

// Allow your Vercel frontend
app.use(cors({
    origin: [
        'https://gani-eleke-project.vercel.app',
        // 'https://gani-eleke-frontend.vercel.app',
        // 'http://localhost:5500',
        // 'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', environment: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/landrents', landRentRoutes);

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation Error',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Local API: http://localhost:${port}/api/health`);
});