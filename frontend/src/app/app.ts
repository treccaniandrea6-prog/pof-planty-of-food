import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgFor, NgClass, NgIf } from '@angular/common';

type ChatMessage = {
  sender: 'user' | 'assistant';
  text: string;
};

type Recipe = {
  id: number;
  title: string;
  sourceUrl: string;
  summary: string;
  characteristicPhrase: string;
  ingredients: string[];
  instructions: string[];
  image: string;
  readyInMinutes: number | null;
  servings: number | null;
};

type HealthResponse = {
  success: boolean;
  message: string;
};

type ChatResponse = {
  success: boolean;
  reply: string;
  recipes?: Recipe[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, NgFor, NgClass, NgIf],
  template: `
    <main class="page">
      <section class="chat-shell">
        <header class="chat-header">
          <h1>POF: Planty of Food</h1>
          <p>AI assistant for sustainable plant-based recipes</p>
        </header>

        <section class="status-box">
          <strong>Backend status:</strong>
          <span>{{ message }}</span>
        </section>

        <section class="chat-body">
          <div
            *ngFor="let msg of messages"
            [ngClass]="{
              'assistant-message': msg.sender === 'assistant',
              'user-message': msg.sender === 'user'
            }"
          >
            {{ msg.text }}
          </div>

          <section class="recipes-section" *ngIf="recipes.length > 0">
            <h2>Ricette trovate</h2>

            <article class="recipe-card" *ngFor="let recipe of recipes">
              <img
                class="recipe-image"
                [src]="recipe.image"
                [alt]="recipe.title"
                *ngIf="recipe.image"
              />

              <div class="recipe-content">
                <h3>{{ recipe.title }}</h3>

                <p class="characteristic-phrase">
                  {{ recipe.characteristicPhrase }}
                </p>

                <p class="recipe-summary">
                  {{ recipe.summary || 'Nessun summary disponibile.' }}
                </p>

                <div class="recipe-meta">
                  <span *ngIf="recipe.readyInMinutes">
                    ⏱ {{ recipe.readyInMinutes }} min
                  </span>
                  <span *ngIf="recipe.servings">
                    👥 {{ recipe.servings }} porzioni
                  </span>
                </div>

                <div class="recipe-block">
                  <strong>Ingredienti principali:</strong>
                  <ul>
                    <li *ngFor="let ingredient of recipe.ingredients.slice(0, 5)">
                      {{ ingredient }}
                    </li>
                  </ul>
                </div>

                <div class="recipe-block" *ngIf="recipe.instructions.length > 0">
                  <strong>Primo step:</strong>
                  <p>{{ recipe.instructions[0] }}</p>
                </div>

                <a
                  class="recipe-link"
                  [href]="recipe.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Vai alla ricetta
                </a>
              </div>
            </article>
          </section>
        </section>

        <section class="chat-input-area">
          <input
            type="text"
            placeholder="Scrivi qui il tuo messaggio..."
            [(ngModel)]="userInput"
            (keyup.enter)="sendMessage()"
          />
          <button (click)="sendMessage()">Invia</button>
        </section>
      </section>
    </main>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    .page {
      min-height: 100vh;
      padding: 40px 16px;
      background: #f4f8f2;
      font-family: Arial, sans-serif;
    }

    .chat-shell {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      border: 1px solid #dfe8d8;
    }

    .chat-header {
      padding: 24px;
      background: #dff3df;
      border-bottom: 1px solid #cfe5cf;
    }

    .chat-header h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #234b2c;
    }

    .chat-header p {
      margin: 0;
      color: #4b6b52;
    }

    .status-box {
      padding: 16px 24px;
      background: #f8fbf7;
      border-bottom: 1px solid #e7efe3;
      color: #2d4733;
    }

    .chat-body {
      min-height: 420px;
      padding: 24px;
      background: #fcfdfb;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .assistant-message {
      align-self: flex-start;
      max-width: 75%;
      padding: 14px 16px;
      border-radius: 14px;
      background: #e8f5e9;
      color: #1f3b25;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .user-message {
      align-self: flex-end;
      max-width: 75%;
      padding: 14px 16px;
      border-radius: 14px;
      background: #c8e6c9;
      color: #1b5e20;
      line-height: 1.5;
      word-break: break-word;
    }

    .recipes-section {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .recipes-section h2 {
      margin: 8px 0 0;
      color: #234b2c;
      font-size: 22px;
    }

    .recipe-card {
      display: flex;
      gap: 16px;
      padding: 16px;
      border: 1px solid #dfe8d8;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }

    .recipe-image {
      width: 180px;
      height: 130px;
      object-fit: cover;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .recipe-content {
      flex: 1;
    }

    .recipe-content h3 {
      margin: 0 0 8px 0;
      color: #234b2c;
    }

    .characteristic-phrase {
      margin: 0 0 10px 0;
      font-style: italic;
      color: #2f7d32;
      line-height: 1.5;
    }

    .recipe-summary {
      margin: 0 0 10px 0;
      color: #37463a;
      line-height: 1.5;
    }

    .recipe-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      color: #4b6b52;
      font-size: 14px;
    }

    .recipe-block {
      margin-bottom: 12px;
    }

    .recipe-block strong {
      display: block;
      margin-bottom: 6px;
      color: #234b2c;
    }

    .recipe-block ul {
      margin: 0;
      padding-left: 18px;
    }

    .recipe-block p {
      margin: 0;
      line-height: 1.5;
      color: #37463a;
    }

    .recipe-link {
      display: inline-block;
      margin-top: 6px;
      color: #2f7d32;
      font-weight: bold;
      text-decoration: none;
    }

    .recipe-link:hover {
      text-decoration: underline;
    }

    .chat-input-area {
      display: flex;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid #e7efe3;
      background: #ffffff;
    }

    .chat-input-area input {
      flex: 1;
      padding: 14px;
      border: 1px solid #cfd8cc;
      border-radius: 10px;
      font-size: 16px;
    }

    .chat-input-area button {
      padding: 14px 20px;
      border: none;
      border-radius: 10px;
      background: #6aa56a;
      color: white;
      font-weight: bold;
      cursor: pointer;
    }

    .chat-input-area button:hover {
      opacity: 0.9;
    }

    @media (max-width: 768px) {
      .recipe-card {
        flex-direction: column;
      }

      .recipe-image {
        width: 100%;
        height: 200px;
      }
    }
  `]
})
export class App implements OnInit {
  private readonly API_BASE_URL = 'https://pof-planty-of-food.onrender.com';

  message = 'Caricamento...';
  userInput = '';
  sessionId = 'session-001';
  messages: ChatMessage[] = [
    {
      sender: 'assistant',
      text: 'Ciao! Sono il tuo assistente per ricette plant-based sostenibili.'
    }
  ];
  recipes: Recipe[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<HealthResponse>(`${this.API_BASE_URL}/api/health`)
      .subscribe({
        next: (res) => {
          this.message = res.message;
        },
        error: () => {
          this.message = 'Errore backend';
        }
      });
  }

  sendMessage() {
    const trimmedMessage = this.userInput.trim();

    if (!trimmedMessage) return;

    this.messages.push({
      sender: 'user',
      text: trimmedMessage
    });

    this.userInput = '';
    this.recipes = [];

    this.http.post<ChatResponse>(`${this.API_BASE_URL}/api/chat`, {
      message: trimmedMessage,
      sessionId: this.sessionId
    }).subscribe({
      next: (res) => {
        this.messages.push({
          sender: 'assistant',
          text: res.reply
        });

        this.recipes = res.recipes || [];
      },
      error: () => {
        this.messages.push({
          sender: 'assistant',
          text: 'Si è verificato un errore nella risposta del backend.'
        });
      }
    });
  }
}