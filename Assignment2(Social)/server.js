import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 9876;
const BASE_URL = 'http://20.244.56.144/evaluation-service';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

app.use(cors());
app.use(express.json());

// Middleware to check for the auth token
const checkAuthToken = (req, res, next) => {
  if (!AUTH_TOKEN) {
    return res.status(403).json({ error: 'Missing authorization token' });
  }
  next();
};

// Reusable fetch function with timeout
const fetchData = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

// ✅ Get all users
app.get('/users', checkAuthToken, async (req, res) => {
  try {
    const data = await fetchData(`${BASE_URL}/users`);
    const users = Object.entries(data.users || {}).map(([id, name]) => ({ id, name }));
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(error.name === 'AbortError' ? 504 : 500).json({ error: error.message });
  }
});

// ✅ Get posts by user ID
app.get('/users/:userid/posts', checkAuthToken, async (req, res) => {
  const { userid } = req.params;
  try {
    const data = await fetchData(`${BASE_URL}/users/${userid}/posts`);
    res.json(data.posts);
  } catch (error) {
    console.error(`Error fetching posts for user ${userid}:`, error.message);
    res.status(error.name === 'AbortError' ? 504 : 500).json({ error: error.message });
  }
});

// ✅ Get comments by post ID
app.get('/posts/:postid/comments', checkAuthToken, async (req, res) => {
  const { postid } = req.params;
  try {
    const data = await fetchData(`${BASE_URL}/posts/${postid}/comments`);
    res.json(data.comments);
  } catch (error) {
    console.error(`Error fetching comments for post ${postid}:`, error.message);
    res.status(error.name === 'AbortError' ? 504 : 500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
