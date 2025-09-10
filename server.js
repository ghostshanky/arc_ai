// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const BYTEZ_KEY ="24af7bce660c20fc13cca1d155cee614"; // set in Render env vars
if (!BYTEZ_KEY) {
  console.warn("⚠️ BYTEZ_KEY not set. Set BYTEZ_KEY env var in Render.");
}

let currentAbortController = null;

// Change model path here if you want a different model from Bytez catalog
const BYTEZ_MODEL_RUN_URL =
  "https://api.bytez.com/run/deepseek-ai/deepseek-coder-1.3b-instruct";

async function callBytezModel(prompt, signal) {
  const body = {
    input: prompt,
    model_params: { max_new_tokens: 300 }
  };

  const res = await fetch(BYTEZ_MODEL_RUN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BYTEZ_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal
  });

  // If aborted, node-fetch throws a DOMException with name 'AbortError'
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bytez API error: ${res.status} ${text}`);
  }
  return res.json();
}

// Root route - friendly message
app.get("/", (req, res) => {
  res.send("✅ Arc AI Backend is running. POST /chat with JSON { prompt: '...' }");
});

// chat route - abort previous request if new one arrives
app.post("/chat", async (req, res) => {
  const { prompt } = req.body;
  if (typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "prompt must be a non-empty string" });
  }

  // abort previous running request (if any)
  if (currentAbortController) {
    try {
      currentAbortController.abort();
    } catch (e) {
      console.warn("Error aborting previous controller:", e?.message || e);
    }
  }

  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    const data = await callBytezModel(prompt, signal);
    // Return Bytez response directly (adjust mapping if you want a simpler shape)
    res.json(data);
  } catch (err) {
    if (err.name === "AbortError") {
      // The previous request was aborted to make way for a new one.
      // Inform the caller that their request was cancelled (optional).
      // For the new request, the client will receive the response.
      return res.status(499).json({ error: "Request aborted by server due to a newer request." });
    }
    console.error("chat error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    // Clear controller only if it matches this signal (defensive)
    if (currentAbortController && currentAbortController.signal === signal) {
      currentAbortController = null;
    }
  }
});

// keep-alive endpoint
app.get("/ping", async (_req, res) => {
  try {
    // use short prompt and new abort controller so ping won't hold the main controller
    const pingController = new AbortController();
    await callBytezModel("ping", pingController.signal);
    res.send("pong - model warmed");
  } catch (err) {
    // ignore errors from ping
    res.send("pong - ping attempt failed (ignored)");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
