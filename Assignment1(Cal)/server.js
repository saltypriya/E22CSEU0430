import express from 'express';
import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 9876;
const WINDOW_SIZE = 10;

app.use(express.json());

// Storage prvious and current numeber sequences for mutple categories
const numberCache = {
    prime: { current: [], previous: [] },
    fibonacci: { current: [], previous: [] },
    even: { current: [], previous: [] },
    random: { current: [], previous: [] }
};

let authToken = null;
let tokenExpiryTime = 0;

//predefined apis to fetch different types of numbers
const numberAPIs = {
    prime: 'http://20.244.56.144/evaluation-service/primes',
    fibonacci: 'http://20.244.56.144/evaluation-service/fibo',
    even: 'http://20.244.56.144/evaluation-service/even',
    random: 'http://20.244.56.144/evaluation-service/rand'
};

// Middleware to validate authentication
//checks for auth token missing or is the token has expired or not then processed to fetch a new token if either is true
app.use(async (req, res, next) => {
    try {
        if (!authToken || Date.now() >= tokenExpiryTime) {
            await requestAuthToken();
        }
        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error.message);
        return res.status(500).json({ error: 'Authentication failure' });
    }
});

//request a new auth token from external API
async function requestAuthToken(retry = false) {
    const credentials = {
        email: process.env.EMAIL,
        name: process.env.NAME,
        rollNo: process.env.ROLL_NO,
        accessCode: process.env.ACCESS_CODE,
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET
    };

    try {
        const response = await fetch('http://20.244.56.144/evaluation-service/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            throw new Error(`Auth request failed: ${errorDetails}`);
        }

        const { access_token, expires_in } = await response.json();
        authToken = access_token;
        tokenExpiryTime = Date.now() + expires_in * 1000;
        console.log('Authentication successful. Token acquired.');
    } catch (error) {
        if (!retry) {
            console.warn('Retrying authentication...');
            return requestAuthToken(true);
        }
        console.error('Authentication retry failed:', error.message);
        throw error;
    }
}

//requests to fetch numbers from the external API
async function retrieveNumbers(type) {
    if (!numberAPIs[type]) {
        throw new Error(`Invalid request type: ${type}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(numberAPIs[type], {
            headers: { Authorization: `Bearer ${authToken}` },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.numbers)) {
            throw new Error('Unexpected API response format.');
        }

        return Array.from(new Set(data.numbers)); // Remove duplicates
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            console.error('Request timeout occurred.');
        } else {
            console.error('Error fetching numbers:', error.message);
        }
        return [];
    }
}

// Route to retrieve numbers
app.get('/numbers/:category', async (req, res) => {
    const typeMapping = { p: 'prime', f: 'fibonacci', e: 'even', r: 'random' }; //converts the short category to full names
    const type = typeMapping[req.params.category];

    if (!type) {
        return res.status(400).json({ error: 'Invalid number category' });
    }

    //updates the number window while keeping a track of previous and current number sequences
    const storage = numberCache[type];
    const previousState = [...storage.current];

    let numbers;
    try {
        numbers = await retrieveNumbers(type);
        if (!numbers.length) {
            return res.status(503).json({ error: 'Failed to retrieve numbers from API' });
        }
    } catch (error) {
        console.error('Number retrieval error:', error.message);
        return res.status(500).json({ error: 'Error fetching numbers' });
    }

    const uniqueNumbers = new Set(storage.current);
    const newEntries = numbers.filter(num => !uniqueNumbers.has(num));
    const updatedWindow = [...storage.current, ...newEntries].slice(-WINDOW_SIZE);

    storage.previous = previousState;
    storage.current = updatedWindow;

    const sum = updatedWindow.reduce((a, b) => a + b, 0);
    const average = updatedWindow.length ? sum / updatedWindow.length : 0;

    res.json({
        previousWindow: previousState,
        currentWindow: updatedWindow,
        retrievedNumbers: numbers,
        average: parseFloat(average.toFixed(2)) //returns a json response which i am viewing in postman
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
