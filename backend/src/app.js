const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

const RECIPES_FILE_PATH = path.join(__dirname, 'data', 'recipes.json');
const MEMORY_FILE_PATH = path.join(__dirname, 'data', 'memory.json');
const EMBEDDINGS_FILE_PATH = path.join(__dirname, 'data', 'recipe-embeddings.json');

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// ---------- UTILS ----------
function ensureFileExists(filePath, fallbackData = []) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2));
  }
}

ensureFileExists(RECIPES_FILE_PATH, []);
ensureFileExists(MEMORY_FILE_PATH, []);
ensureFileExists(EMBEDDINGS_FILE_PATH, []);

function readJson(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- PREFERENCES ----------
function extractPreferences(text) {
  const value = (text || '').toLowerCase();

  return {
    wantsQuick: value.includes('quick') || value.includes('fast'),
    wantsDinner: value.includes('dinner'),
    wantsVegan: value.includes('vegan'),
    excludesTofu: value.includes('no tofu') || value.includes('without tofu')
  };
}

// ---------- MEMORY ----------
function getSession(sessionId) {
  const memory = readJson(MEMORY_FILE_PATH, []);
  return memory.find((m) => m.sessionId === sessionId) || null;
}

function updateMemory(sessionId, userMessage, assistantReply) {
  const memory = readJson(MEMORY_FILE_PATH, []);
  let session = memory.find((m) => m.sessionId === sessionId);

  if (!session) {
    session = { sessionId, messages: [], preferences: {} };
    memory.push(session);
  }

  const prefs = extractPreferences(userMessage);

  session.messages.push({ role: 'user', content: userMessage });
  session.messages.push({ role: 'assistant', content: assistantReply });

  session.messages = session.messages.slice(-10);
  session.preferences = { ...session.preferences, ...prefs };

  writeJson(MEMORY_FILE_PATH, memory);
}

// ---------- QUERY FIXATA ----------
function buildSearchQuery(message, session) {
  const lowerMessage = (message || '').toLowerCase();

  const detectedKeywords = [];
  const keywordMap = [
    'pasta','salad','burger','soup','curry','rice',
    'broccoli','chickpeas','lentils','mushroom','zucchini','tomato'
  ];

  keywordMap.forEach((keyword) => {
    if (lowerMessage.includes(keyword)) {
      detectedKeywords.push(keyword);
    }
  });

  const preferenceKeywords = [];

  if (session?.preferences?.wantsVegan) preferenceKeywords.push('vegan');
  if (session?.preferences?.wantsDinner) preferenceKeywords.push('dinner');
  if (session?.preferences?.wantsQuick) preferenceKeywords.push('quick');
  if (session?.preferences?.excludesTofu) preferenceKeywords.push('without tofu');

  const finalKeywords = [...new Set([...detectedKeywords, ...preferenceKeywords])];

  if (finalKeywords.length === 0) return message;

  return `${message} ${finalKeywords.join(' ')}`.trim();
}

// ---------- EMBEDDINGS ----------
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });

  return response.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------- RAG ----------
async function searchLocalRag(query) {
  const recipes = readJson(RECIPES_FILE_PATH, []);
  if (!recipes.length) return [];

  const embeddings = [];

  for (const recipe of recipes) {
    const text = `${recipe.title} ${recipe.summary}`;
    const embedding = await createEmbedding(text);
    embeddings.push({ recipe, embedding });
  }

  const queryEmbedding = await createEmbedding(query);

  const scored = embeddings.map(e => ({
    ...e.recipe,
    similarity: cosineSimilarity(queryEmbedding, e.embedding)
  }));

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

// ---------- LLM ----------
async function generateReply(message) {
  const response = await openai.responses.create({
    model: CHAT_MODEL,
    input: `Suggest 3 plant-based recipes for: ${message}`
  });

  return response.output_text;
}

// ---------- ROUTES ----------
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is working correctly' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    const session = getSession(sessionId);
    const query = buildSearchQuery(message, session);

    const recipes = await searchLocalRag(query);

    const reply = await generateReply(message);

    updateMemory(sessionId, message, reply);

    res.json({
      success: true,
      reply,
      recipes
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, reply: 'Server error' });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});