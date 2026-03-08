---
name: llm-json-bridge
description: "Asynchronous JSON-based communication architecture with a Local LLM (Ollama/LM Studio)."
---
# LLM Controller Rules
- The general "mood" of the audio (e.g., BPM, Bass intensity) must be sent to a local LLM endpoint (e.g., `http://localhost:11434/api/generate`) via the `fetch()` API at specific intervals (e.g., every 10 seconds).
- The prompt sent to the LLM must ALWAYS include this strict instruction: "RETURN ONLY A VALID JSON OBJECT. Do not include markdown formatting, backticks, or any conversational text."
- The LLM response must be parsed safely using a `try-catch` block (`JSON.parse`). If successful, instantly update `appState` variables like `color`, `speed`, and `complexity`.
- LLM network calls MUST NOT block the main render loop. Always use non-blocking `async/await` and separate the fetching logic from the 60fps animation loop.