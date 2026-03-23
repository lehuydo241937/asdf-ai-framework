# 🚀 AI-Serverless Developer Framework (ASDF)

**ASDF** is a lightweight, serverless framework designed for remote web development. It leverages **GitHub Actions** as a virtual workstation and **Gemini 1.5 Pro** as your AI coding brain. Develop, build, and deploy anywhere, anytime—all from a premium mobile-first web interface.

---

## ✨ Features

- 🧠 **AI-Powered Development**: Integrated with Gemini 1.5 Pro for automatic code generation and bug fixes.
- 📱 **Mobile Remote Control**: A stunning, glassmorphism UI to send natural language commands to your repo.
- 🏗️ **Serverless Infrastructure**: Zero cost of maintenance using GitHub Actions as the runner.
- ⚡ **Auto-Suggest Commands**: Use `/gen`, `/fix`, `/build`, `/tree` and more for rapid development.
- 🛡️ **Self-Healing**: Automatic retry logic on build failures using AI analysis of terminal logs.

---

## 🛠️ Quick Setup (5 Minutes)

1. **Fork/Clone this Repo** to your GitHub account.
2. **Configure Secrets**:
   - Go to `Settings` -> `Secrets and variables` -> `Actions`.
   - Add `GEMINI_API_KEY`: Your key from [Google AI Studio](https://aistudio.google.com/).
   - Add `GH_TOKEN`: A Personal Access Token (PAT) with `repo` and `workflow` permissions.
3. **Launch the Remote UI**:
   - Host the contents of `/web_remote` (GitHub Pages or Vercel).
   - Click the **Settings icon** in the UI and enter your Repo info and PAT.
4. **Start Coding**:
   - Type `/gen create a responsive landing page` in the chat!

---

## 📂 Project Structure

- `.github/workflows/`: Automation logic for the AI Brain.
- `ai_scripts/`: Core logic for file scanning and AI communication.
- `web_remote/`: The premium mobile interface (HTML/JS/Vanilla CSS).
- `src/`: Your application source code repository.
- `instructions.md`: Custom coding rules for your AI developer.

---

## 📜 Commands Legend

| Command | Description | Action |
| :--- | :--- | :--- |
| `/gen [req]` | Generate Code | Writes code based on your request + Comits changes. |
| `/fix` | Fix Errors | Analyzes `build.log` and automatically repairs files. |
| `/build` | Test Build | Runs your project's build command to verify integrity. |
| `/tree` | Inspect Source | Returns the current directory structure of `/src`. |
| `/clear` | Refresh Brain | Resets the conversation context for a clean slate. |

---

## 🤝 Contribution

Feel free to fork this project and add new capabilities to the AI Brain. If you find a bug, please open an issue!

---
