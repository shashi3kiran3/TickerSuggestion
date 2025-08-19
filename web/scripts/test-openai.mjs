import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY env var. Run: OPENAI_API_KEY=sk-... node scripts/test-openai.mjs");
  process.exit(1);
}

const client = new OpenAI({ apiKey });

async function test() {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello! Can you reply with just 'Hi there'?" }],
      temperature: 0,
      max_tokens: 10,
    });
    console.log("OK:", response.choices[0]?.message?.content || response);
  } catch (err) {
    console.error("ERROR:", err?.response?.data || err?.message || err);
    process.exit(2);
  }
}

test();


