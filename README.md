# 🚀 GetHired — Master Coding Interviews

A full-stack web application to help developers get hired faster through AI-powered mock interviews, real-time code review, progress tracking, and a competitive leaderboard.

---

## 🔗 Links

- 🌐 **Live Demo** — [https://ai-interview-prep-y3m3.onrender.com](https://ai-interview-prep-y3m3.onrender.com)
- 💻 **GitHub** — [https://github.com/ashwinmali7781/AI-Interview-Prep](https://github.com/ashwinmali7781/AI-Interview-Prep)

---

## ✨ Features

- 🔐 **Authentication** — Sign up, login, logout via Supabase Auth
- 💻 **Coding Practice** — Solve problems in a VS Code-style Monaco editor
- 🤖 **AI Code Review** — Get instant feedback from Claude AI on your solution
- 🎤 **AI Mock Interviews** — Chat-based technical interview with scoring
- 🔥 **Streak Tracker** — Daily practice streak like LeetCode/Duolingo
- 📊 **Progress Dashboard** — Stats, difficulty bars, category performance chart
- 🏆 **Leaderboard** — Compete with other users, podium for top 3
- 🔖 **Bookmarks** — Save problems to revisit later
- 🏢 **Company Filters** — Filter by Google, Meta, Amazon, Microsoft, Apple
- ⏱️ **Live Timer** — Track time spent on each problem
- 📋 **Copy Code** — One-click copy button in the editor
- 🌙 **Dark Mode** — Toggle dark/light theme, persists in localStorage
- 📱 **Responsive** — Works on mobile, tablet, and desktop

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React 18 + Vite | Frontend framework & build tool |
| Tailwind CSS | Styling |
| shadcn/ui + Radix UI | Component library |
| Framer Motion | Animations |
| Supabase | Database, Auth, Realtime |
| Monaco Editor | VS Code-style code editor |
| Recharts | Dashboard charts |
| Anthropic Claude API | AI code review |
| React Router DOM | Client-side routing |

---

## ⚙️ Local Setup

```bash
git clone https://github.com/ashwinmali7781/AI-Interview-Prep.git
cd AI-Interview-Prep
npm install
```

Create `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

```bash
npm run dev
```

---

## 📜 Scripts

```bash
npm run dev      # localhost:5173
npm run build    # production build → dist/
npm run preview  # preview build
```

---

## 👨‍💻 Author

**Ashwin Mali**
- GitHub — [@ashwinmali7781](https://github.com/ashwinmali7781)
- Live — [ai-interview-prep-y3m3.onrender.com](https://ai-interview-prep-y3m3.onrender.com)

---

## 📄 License

MIT License
