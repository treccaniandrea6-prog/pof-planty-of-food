# POF: Planty of Food

POF: Planty of Food is a full-stack AI-powered recipe assistant developed as part of the Start2Impact learning path.

The application allows users to discover sustainable plant-based recipes through a conversational chat interface. It integrates an Angular frontend, a Node/Express backend, external APIs, conversational memory, and a RAG-like retrieval system.

---

## 🌐 Live Project

- Frontend: https://pof-planty-frontend.netlify.app
- Backend: https://pof-planty-of-food.onrender.com
- GitHub: https://github.com/treccaniandrea6-prog/pof-planty-of-food

---

## 🎯 Project Goal

The goal of this project is to build an intelligent assistant capable of:

- answering user queries via chat
- retrieving plant-based recipes
- adapting to user preferences
- combining local data and external APIs
- simulating an AI agent workflow

---

## 🧰 Tech Stack

### Frontend

- Angular
- TypeScript
- HTML
- CSS

### Backend

- Node.js
- Express

### External API

- Spoonacular API

### Deployment

- Netlify (frontend)
- Render (backend)

### Version Control

- Git
- GitHub

---

## ⚙️ Main Features

- Chat-based interface
- Real-time frontend ↔ backend communication
- Recipe retrieval from API
- Recipe normalization
- Conversational memory
- Query optimization
- RAG-like retrieval system
- Fully deployed full-stack application

---

## 🔌 API Endpoints

### Health Check

GET /api/health

### Chat Endpoint

POST /api/chat

Example request:
{
"message": "quick vegan pasta",
"sessionId": "session-001"
}

### System Prompt

GET /api/system-prompt

---

## 🧠 AI Agent Logic

The system follows these steps:

1. Receive user message
2. Extract preferences (vegan, quick, dinner, etc.)
3. Build optimized search query
4. Search local dataset
5. If results exist → return them
6. Otherwise → call Spoonacular API
7. Normalize recipe data
8. Store recipes locally
9. Update conversation memory
10. Return structured response

---

## 🧩 Conversational Memory

The backend stores session-based memory in JSON files.

It includes:

- user messages
- assistant replies
- detected preferences (vegan, quick, dinner, etc.)

This allows the assistant to adapt future responses.

---

## 📚 RAG-like Retrieval System

Before calling the external API, the backend:

- reads local recipes
- scores relevance
- returns best matches

If no results are found:

→ fallback to Spoonacular API

This creates a simple RAG-style flow:

- retrieve locally
- augment externally

---

## 🍽️ Recipe Normalization

All recipes are transformed into a consistent structure:

- id
- title
- sourceUrl
- summary
- characteristicPhrase
- ingredients
- instructions
- image
- readyInMinutes
- servings

This ensures consistency and clean frontend rendering.

---

## 💻 Local Setup

Clone repository:
git clone https://github.com/treccaniandrea6-prog/pof-planty-of-food.git
cd pof-planty-of-food

Install backend:
cd backend
npm install

Install frontend:
cd ../frontend
npm install

Environment configuration:

Create a `.env` file inside the backend folder:

SPOONACULAR_API_KEY=your_api_key_here

Run backend:
cd backend
npm run dev

Run frontend:
cd frontend
ng serve

Local URLs:

Frontend:
http://localhost:4200

Backend:
http://localhost:3000

---

## 🚀 Deployment

Frontend:
https://pof-planty-frontend.netlify.app

Backend:
https://pof-planty-of-food.onrender.com

---

## ⚠️ Challenges Faced

- Frontend/backend connection issues
- API integration debugging
- Environment variable setup
- Git submodule / embedded repository bug
- Netlify build errors
- Render deployment configuration
- Production API communication

---

## 🔮 Future Improvements

- Loading spinner
- Better error handling
- Empty state UI
- Advanced filtering
- Improved memory logic
- Better ranking system
- UI/UX improvements

---

## 👤 Author

Andrea Treccani

GitHub:
https://github.com/treccaniandrea6-prog
