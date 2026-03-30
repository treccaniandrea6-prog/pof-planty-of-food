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

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

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

function extractPreferences(text) {
  const value = (text || '').toLowerCase();

  return {
    wantsQuick:
      value.includes('quick') ||
      value.includes('fast') ||
      value.includes('veloce'),

    wantsDinner:
      value.includes('dinner') ||
      value.includes('cena'),

    excludesTofu:
      value.includes('without tofu') ||
      value.includes('no tofu') ||
      value.includes('senza tofu'),

    wantsVegan:
      value.includes('vegan') ||
      value.includes('vegana') ||
      value.includes('vegano')
  };
}

function getSession(sessionId) {
  const memory = readJson(MEMORY_FILE_PATH, []);
  return memory.find((m) => m.sessionId === sessionId) || null;
}

function updateMemory(sessionId, userMessage, assistantReply) {
  const memory = readJson(MEMORY_FILE_PATH, []);
  let session = memory.find((m) => m.sessionId === sessionId);

  if (!session) {
    session = {
      sessionId,
      messages: [],
      preferences: {}
    };
    memory.push(session);
  }

  const prefs = extractPreferences(userMessage);

  session.messages.push({
    role: 'user',
    content: userMessage
  });

  session.messages.push({
    role: 'assistant',
    content: assistantReply
  });

  session.messages = session.messages.slice(-12);
  session.preferences = { ...session.preferences, ...prefs };

  writeJson(MEMORY_FILE_PATH, memory);
}

function buildSearchQuery(message, session) {
  const lowerMessage = (message || '').toLowerCase();
  const query = [];

  if (lowerMessage.includes('pasta')) query.push('pasta');
  if (lowerMessage.includes('salad')) query.push('salad');
  if (lowerMessage.includes('burger')) query.push('burger');
  if (lowerMessage.includes('soup')) query.push('soup');
  if (lowerMessage.includes('curry')) query.push('curry');
  if (lowerMessage.includes('rice')) query.push('rice');

  if (session?.preferences?.wantsVegan) query.push('vegan');
  if (session?.preferences?.wantsDinner) query.push('dinner');
  if (session?.preferences?.wantsQuick) query.push('quick');
  if (session?.preferences?.excludesTofu) query.push('without tofu');

  if (query.length === 0) return message;

  return `${message} ${query.join(' ')}`.trim();
}

function buildRecipeDocument(recipe) {
  return [
    `Title: ${recipe.title || ''}`,
    `Summary: ${recipe.summary || ''}`,
    `Characteristic: ${recipe.characteristicPhrase || ''}`,
    `Ready in minutes: ${recipe.readyInMinutes || ''}`,
    `Servings: ${recipe.servings || ''}`,
    `Ingredients: ${(recipe.ingredients || []).join(', ')}`,
    `Instructions: ${(recipe.instructions || []).join(' ')}`,
    `Source URL: ${recipe.sourceUrl || ''}`
  ].join('\n');
}

async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });

  return response.data[0].embedding;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return -1;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return -1;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function syncEmbeddingsIndexForRecipes(recipes) {
  const embeddingsIndex = readJson(EMBEDDINGS_FILE_PATH, []);
  const existingMap = new Map(embeddingsIndex.map((item) => [item.id, item]));

  let changed = false;

  for (const recipe of recipes) {
    if (!recipe?.id) continue;

    if (!existingMap.has(recipe.id)) {
      const document = buildRecipeDocument(recipe);
      const embedding = await createEmbedding(document);

      embeddingsIndex.push({
        id: recipe.id,
        title: recipe.title,
        text: document,
        embedding
      });

      existingMap.set(recipe.id, true);
      changed = true;
    }
  }

  if (changed) {
    writeJson(EMBEDDINGS_FILE_PATH, embeddingsIndex);
  }

  return embeddingsIndex;
}

async function searchLocalRag(query, topK = 3) {
  const recipes = readJson(RECIPES_FILE_PATH, []);
  if (recipes.length === 0) return [];

  const embeddingsIndex = await syncEmbeddingsIndexForRecipes(recipes);
  if (embeddingsIndex.length === 0) return [];

  const queryEmbedding = await createEmbedding(query);
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  return embeddingsIndex
    .map((entry) => ({
      ...entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding)
    }))
    .filter((entry) => entry.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => recipeMap.get(entry.id))
    .filter(Boolean);
}

function formatRecipesForLLM(recipes) {
  return recipes
    .map((recipe, index) => {
      const ingredients = (recipe.ingredients || []).slice(0, 8).join(', ');
      const instructions = (recipe.instructions || []).slice(0, 4).join(' | ');

      return [
        `Recipe ${index + 1}`,
        `Title: ${recipe.title || ''}`,
        `Summary: ${recipe.summary || ''}`,
        `Ready in minutes: ${recipe.readyInMinutes || 'unknown'}`,
        `Servings: ${recipe.servings || 'unknown'}`,
        `Ingredients: ${ingredients || 'not available'}`,
        `Instructions: ${instructions || 'not available'}`,
        `Source URL: ${recipe.sourceUrl || 'not available'}`
      ].join('\n');
    })
    .join('\n\n----------------------\n\n');
}

async function generateLLMReply({ message, session, recipes, source }) {
  const recentMessages = session?.messages?.slice(-6) || [];

  const memoryBlock = recentMessages.length
    ? recentMessages.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join('\n')
    : 'No previous conversation available.';

  const recipesBlock = recipes.length
    ? formatRecipesForLLM(recipes)
    : 'No recipes were retrieved from the local RAG.';

  const instructions = `
You are an AI recipe assistant for sustainable plant-based cooking.

Main rules:
- answer in clear English
- prioritize vegan or clearly plant-based options
- do not recommend meat, tuna, fish, cheese, milk, yogurt, eggs, or other obvious animal-based ingredients
- if local RAG recipes are available, use only those recipes as factual context
- if no local RAG recipes are available, generate 3 original plant-based recipe suggestions directly with the LLM
- when generating suggestions without RAG, make them realistic, concise, and practical
- keep the answer readable and natural
- if the user asks for quick recipes, prefer recipes under 30 minutes
- if useful, recommend the best option based on the user request

If local RAG recipes exist:
- compare them
- highlight preparation time
- highlight why they match the request

If local RAG recipes do not exist:
- return 3 recipe ideas with:
  1) title
  2) short description
  3) approximate time
  4) key ingredients
  5) first preparation step
`;

  const input = `
User message:
${message}

Conversation memory:
${memoryBlock}

Retrieved recipe context:
${recipesBlock}

Source used:
${source}

Now answer the user in English.
`;

  const response = await openai.responses.create({
    model: CHAT_MODEL,
    instructions,
    input
  });

  return (response.output_text || 'I could not generate a response right now.').trim();
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working correctly'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        reply: 'Missing message or sessionId'
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        reply: 'OPENAI_API_KEY is not configured'
      });
    }

    console.log('--- AI AGENT DECISION ---');
    console.log('User message:', message);

    const session = getSession(sessionId);
    const query = buildSearchQuery(message, session);

    console.log('Search query:', query);

    let recipes = await searchLocalRag(query, 3);
    let source = 'local embeddings RAG';

    if (recipes.length > 0) {
      console.log('Using local embeddings RAG');
    } else {
      console.log('No local RAG match, using LLM only');
      recipes = [];
      source = 'LLM only';
    }

    const reply = await generateLLMReply({
      message,
      session,
      recipes,
      source
    });

    updateMemory(sessionId, message, reply);

    return res.json({
      success: true,
      reply,
      recipes,
      source
    });
  } catch (error) {
    console.error('ERROR /api/chat');
    console.error(error.response?.data || error.message || error);

    return res.status(500).json({
      success: false,
      reply: 'Internal server error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});