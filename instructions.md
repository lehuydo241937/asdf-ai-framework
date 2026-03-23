# 📜 Coding Standards for ASDF AI Developer

## Core Principles
1. **Performance**: Prioritize lightweight code and minimal dependencies.
2. **Readability**: Use clean, descriptive variable names and comment complex logic.
3. **Security**: Never hardcode API keys or secrets. Use environment variables.
4. **Mobile-First**: For frontend tasks, ensure responsiveness and touch-friendly UI.

## Technology Stack
- **Frontend**: Tailwind CSS + Lucide Icons + Vanilla JS/React (as requested).
- **Backend/Logic**: Python (Clean, typed where possible) or Node.js.

## Commit Message Protocol
- Always summarize the changes made in the commit message.
- Prefix with "AI Brain: [summary]".

## Self-Correction Loop
- If a command results in build errors, analyze `logs/build.log` and apply fixes automatically.
- Maximum 3 retries for build errors.
- Always verify syntax before committing.
