const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SPOONACULAR_API_KEY;

const RECIPES_FILE_PATH = path.join(__dirname, 'data', 'recipes.json');
const MEMORY_FILE_PATH = path.join(__dirname, 'data', 'memory.json');

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

function getSystemPrompt() {
  return {
    role: 'assistente intelligente per la ricerca di ricette plant-based sostenibili',
    goal: 'trovare e presentare ricette pertinenti in modo chiaro, naturale e utile',
    rules: [
      'usa solo dati reali',
      'non inventare ricette',
      'usa le preferenze utente',
      'risposte chiare e leggibili'
    ]
  };
}

function truncateText(text, maxLength = 180) {
  if (!text) return '';
  return text.length > maxLength
    ? text.substring(0, maxLength) + '...'
    : text;
}

function buildCharacteristicPhrase(recipe) {
  const title = recipe.title || '';
  const time = recipe.readyInMinutes
    ? `si prepara in ${recipe.readyInMinutes} minuti`
    : 'tempo non specificato';

  return `${title} è una ricetta che ${time}.`;
}

function normalizeRecipe(recipe) {
  return {
    id: recipe.id,
    title: recipe.title || '',
    sourceUrl: recipe.sourceUrl || '',
    summary: stripHtml(recipe.summary || ''),
    characteristicPhrase: buildCharacteristicPhrase(recipe),
    ingredients: recipe.extendedIngredients?.map(i => i.original) || [],
    instructions: recipe.analyzedInstructions?.[0]?.steps?.map(s => s.step) || [],
    image: recipe.image || '',
    readyInMinutes: recipe.readyInMinutes || null,
    servings: recipe.servings || null
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function extractPreferences(text) {
  text = (text || '').toLowerCase();
  return {
    wantsQuick: text.includes('veloce'),
    wantsDinner: text.includes('cena'),
    excludesTofu: text.includes('senza tofu'),
    wantsVegan: text.includes('vegan') || text.includes('vegana')
  };
}

function getSession(sessionId) {
  const memory = readJson(MEMORY_FILE_PATH);
  return memory.find(m => m.sessionId === sessionId);
}

function updateMemory(sessionId, user, reply) {
  const memory = readJson(MEMORY_FILE_PATH);
  let session = memory.find(m => m.sessionId === sessionId);

  if (!session) {
    session = {
      sessionId,
      messages: [],
      preferences: {}
    };
    memory.push(session);
  }

  const prefs = extractPreferences(user);

  session.messages.push({ role: 'user', content: user });
  session.messages.push({ role: 'assistant', content: reply });

  session.preferences = { ...session.preferences, ...prefs };

  writeJson(MEMORY_FILE_PATH, memory);
}

function buildSearchQuery(message, session) {
  const lowerMessage = (message || '').toLowerCase();
  const query = [];

  if (lowerMessage.includes('pasta')) query.push('pasta');
  if (session?.preferences?.wantsVegan) query.push('vegan');
  if (session?.preferences?.wantsDinner) query.push('dinner');
  if (session?.preferences?.wantsQuick) query.push('quick');

  if (query.length === 0) return message;

  return query.join(' ');
}

function scoreRecipe(recipe, query) {
  const text = `${recipe.title} ${recipe.summary}`.toLowerCase();
  let score = 0;

  query.toLowerCase().split(' ').forEach(word => {
    if (word && text.includes(word)) score += 2;
  });

  return score;
}

function searchLocal(query) {
  const recipes = readJson(RECIPES_FILE_PATH);

  return recipes
    .map(r => ({ r, score: scoreRecipe(r, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.r);
}

async function fetchFromAPI(query) {
  const res = await axios.get(
    'https://api.spoonacular.com/recipes/complexSearch',
    { params: { query, number: 3, apiKey: API_KEY } }
  );

  const results = res.data.results || [];
  const detailed = [];

  for (const r of results) {
    const det = await axios.get(
      `https://api.spoonacular.com/recipes/${r.id}/information`,
      { params: { apiKey: API_KEY } }
    );

    detailed.push(normalizeRecipe(det.data));
  }

  return detailed;
}

function mergeRecipes(existingRecipes, newRecipes) {
  const map = new Map();

  existingRecipes.forEach(recipe => {
    map.set(recipe.id, recipe);
  });

  newRecipes.forEach(recipe => {
    map.set(recipe.id, recipe);
  });

  return Array.from(map.values());
}

function formatRecipes(recipes) {
  return recipes.map((r, i) => `
🍽️ Ricetta ${i + 1}: ${r.title}

📝 ${r.characteristicPhrase}

📄 ${truncateText(r.summary)}

🥗 Ingredienti:
${r.ingredients.slice(0, 5).map(i => `- ${i}`).join('\n')}

🔗 ${r.sourceUrl}
`).join('\n---------------------\n');
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working correctly'
  });
});

app.get('/api/system-prompt', (req, res) => {
  res.json({
    success: true,
    systemPrompt: getSystemPrompt()
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        reply: 'message o sessionId mancanti'
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        reply: 'SPOONACULAR_API_KEY non configurata'
      });
    }

    const system = getSystemPrompt();
    const session = getSession(sessionId);
    const query = buildSearchQuery(message, session);

    console.log('--- AGENT DECISION ---');

    let recipes = searchLocal(query);
    let source = 'RAG locale';

    if (recipes.length > 0) {
      console.log('Uso RAG locale');
    } else {
      console.log('Uso API Spoonacular');
      recipes = await fetchFromAPI(query);
      source = 'Spoonacular API';

      const oldRecipes = readJson(RECIPES_FILE_PATH);
      const mergedRecipes = mergeRecipes(oldRecipes, recipes);
      writeJson(RECIPES_FILE_PATH, mergedRecipes);
    }

    const reply = `
${system.role}

${recipes.length === 0
  ? 'Non ho trovato ricette.'
  : `Ho trovato queste ricette (${source}):\n${formatRecipes(recipes)}`
}
`;

    updateMemory(sessionId, message, reply);

    return res.json({
      success: true,
      reply,
      recipes
    });
  } catch (error) {
    console.error('ERRORE /api/chat');
    console.error(error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      reply: 'Errore interno del server'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});