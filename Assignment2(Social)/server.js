import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'http://20.244.56.144/evaluation-service';

// Extract credentials from environment variables
const userCredentials = {
  email: process.env.EMAIL,
  name: process.env.NAME,
  rollNo: process.env.ROLL_NO,
  accessCode: process.env.ACCESS_CODE,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
};

let authToken = '';

// Fetch authorization token
async function fetchAuthToken() {
  try {
    const response = await axios.post(`${BASE_URL}/auth`, userCredentials);
    authToken = response.data.access_token;
    console.log('Authorization token obtained.');
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error('Failed to fetch token:', errMsg);
    process.exit(1);
  }
}

// Axios instance with base config
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 1000
});

// Generate auth header for each request
const authHeader = () => ({
  Authorization: `Bearer ${authToken}`
});

// Get all users
app.get('/users', async (req, res) => {
  try {
    const response = await apiClient.get('/users', { headers: authHeader() });
    res.status(200).json({ users: response.data.users });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Could not fetch users.' });
  }
});

// Get posts by user ID
app.get('/users/:id/posts', async (req, res) => {
  const userId = req.params.id;

  if (!userId) return res.status(400).json({ error: 'User ID is required.' });

  try {
    const response = await apiClient.get(`/users/${userId}/posts`, { headers: authHeader() });
    res.status(200).json({ posts: response.data.posts });
  } catch (error) {
    console.error(`Error fetching posts for user ${userId}:`, error.message);
    res.status(500).json({ error: 'Could not fetch posts for this user.' });
  }
});

app.get('/posts/:id/comments', async (req, res) => {
    const postId = req.params.id;
  
    if (!postId) return res.status(400).json({ error: 'Post ID is required.' });
  
    try {
      const response = await apiClient.get(`/posts/${postId}/comments`, {
        headers: authHeader(),
      });
  
      console.log('API response:', response.data); // ADD THIS
  
      res.status(200).json({ comments: response.data.comments });
    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error.message);
      res.status(500).json({ error: 'Could not fetch comments for this post.' });
    }
  });
  
fetchAuthToken().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
