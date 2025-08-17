# 📘 Project Requirements – MarketPulse

> A responsive web application to deliver stock suggestions, trending stocks/sectors, financial news, predictions, upcoming events, and AI-powered Q&A. Intended for personal use with plans to expand into a mobile app.

---

## 🚀 Objective

Build a centralized platform where users can:
- Discover trending stocks and sectors
- View curated stock suggestions
- Read categorized, real-time financial news
- View upcoming events (earnings, IPOs, Fed meetings, etc.)
- Ask natural-language questions and get answers using an AI agent powered by OpenAI + web search
- Access basic predictions and stock trend forecasts

---

## 👥 Users

- **Primary audience**: You, your family, and close friends
- **User Roles**:
  - **Standard User**: View content, ask questions
  - **Admin (You)**: Manage content (optional for MVP)

---

## 🖥️ Pages / Layouts

### 1. Home Dashboard
- Trending stocks and sectors
- Market sentiment indicator

### 2. Suggestions Page
- Stock suggestions with reasoning/tags
- Filter by tag (e.g., AI, Tech, Oversold)

### 3. News Page
- Real-time or near real-time news from financial sources
- Categorized news
- Search/filter functionality

### 4. Events Page
- List of upcoming earnings, IPOs, Fed meetings, etc.
- Filters by event type

### 5. Ask AI Page
- Chat interface to ask questions like:
  - "Why is TSLA down today?"
  - "What sectors are trending?"
- Uses OpenAI GPT-4 and a web search API

### 6. Predictions Page
- Forecasts for selected stocks
- Show basic chart (line/candlestick)
- Display forecast % and trend

### 7. Admin Page (Optional)
- Manage suggestions
- Configure API keys and sources

---

## ✨ Features

- Pull trending stocks/sectors (API or scraped)
- Curated daily stock suggestions
- Real-time news from finance sources
- Event calendar
- AI Q&A assistant using GPT + web search
- Predictions using rule-based logic or placeholder AI
- Responsive layout (mobile + desktop)

---

## 📦 Tech Stack Suggestions

> Cursor can modify or scaffold based on this

| Layer         | Tech Stack                   |
|---------------|------------------------------|
| Frontend      | React + Tailwind CSS         |
| Backend       | Node.js or FastAPI (Python)  |
| AI            | OpenAI GPT-4 API             |
| Stock Data    | Alpha Vantage / Yahoo / Finnhub |
| News Data     | NewsAPI / Bing News / CNBC RSS |
| Events        | Manual list / API / RSS      |
| Database      | SQLite or Firebase (MVP)     |
| Deployment    | Vercel / Netlify / Railway   |
| Search        | Bing Search API / SerpAPI    |

---

## 🔍 Mock Wireframes

### 🏠 Home Dashboard



