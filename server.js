import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const BYTEZ_KEY = process.env.BYTEZ_KEY; // ✅ set in Render dashboard

let currentAbortController = null;

// Function to call Bytez model
async function callBytezModel(prompt, signal) {
  const res = await fetch(
    "https://api.bytez.com/run/deepseek-ai/deepseek-coder-1.3b-instruct",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BYTEZ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: prompt,
        model_params: { max_new_tokens: 200 }
      }),
      signal,
    }
  );
  return res.json();
}

app.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    // Abort previous request if running
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    const output = await callBytezModel(prompt, currentAbortController.signal);
    res.json(output);
  } catch (err) {
    res.status(500).json({ error: "Request failed", details: err.message });
  }
});

// Keep-alive endpoint
app.get("/ping", async (_, res) => {
  try {
    await callBytezModel("Hello", new AbortController().signal);
    res.send("Model kept alive!");
  } catch {
    res.send("Ping failed, but server alive.");
  }
});

app.get("/", (req, res) => {
  res.send("✅ Arc AI Backend is Live! Use POST /chat to interact.");
});

app.listen(3000, () => console.log("✅ Backend running on http://localhost:3000"));
