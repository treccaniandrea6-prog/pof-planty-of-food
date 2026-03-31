# 🌱 POF: Planty of Food

AI-powered assistant for sustainable plant-based recipes.

---

## 🚀 Live Demo

- 🌐 Frontend: https://69cbc4285e927f000899afa1--pof-frontend.netlify.app  
- ⚙️ Backend API: https://pof-planty-of-food.onrender.com  

---

## 📌 Overview

POF (Planty of Food) is an AI-driven web application that helps users discover **plant-based recipes** through a conversational interface.

The system combines:
- Natural language interaction
- AI-generated responses
- Local semantic search (RAG)
- Recipe data normalization

---

## 🧠 Key Features

- 💬 Chat-based recipe assistant  
- 🥦 Plant-based recipe suggestions  
- ⚡ Fast responses with local embeddings (RAG)  
- 🧩 Conversational memory (session-based)  
- 🔍 Semantic search with cosine similarity  
- 🌐 Clean and responsive UI  

---

## 🏗️ Tech Stack

### Frontend
- Angular (Standalone Components)
- TypeScript
- HTML / CSS

### Backend
- Node.js
- Express

### AI & Data
- OpenAI API
- Local embeddings (JSON)
- RAG (Retrieval-Augmented Generation)
- Cosine similarity algorithm

---

## 🧩 Architecture

```
User → Angular Frontend → Express Backend → AI + RAG System
```

### Backend Components:
- `/api/chat` → main AI endpoint  
- `/api/health` → service check  
- Local memory (`memory.json`)  
- Recipes dataset (`recipes.json`)  
- Embeddings (`recipe-embeddings.json`)  

---

## ⚙️ How It Works

1. User sends a message (e.g. "quick broccoli dinner")  
2. Backend processes:
   - extracts keywords  
   - applies user preferences  
3. RAG system retrieves similar recipes  
4. AI generates a response  
5. Frontend displays:
   - assistant reply  
   - relevant recipes  

---

## 🛠️ Local Setup

### Clone repository
```bash
git clone https://github.com/treccaniandrea6-prog/pof-planty-of-food.git
cd pof-planty-of-food
```

---

### Backend setup
```bash
cd backend
npm install
npm run dev
```

---

### Frontend setup
```bash
cd frontend
npm install
ng serve
```

---

## 🔐 Environment Variables

Backend requires:

```env
OPENAI_API_KEY=your_api_key_here
```

---

## 📈 Project Goals

- Build a real AI-powered product  
- Implement RAG architecture locally  
- Combine frontend + backend + AI  
- Deliver a production-ready application  

---

## 👨‍💻 Author

Andrea Treccani  

GitHub:  
https://github.com/treccaniandrea6-prog  

---

## 📄 License

This project is for educational and portfolio purposes.
