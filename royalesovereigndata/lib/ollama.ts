/**
 * ROYALE — OLLAMA LOCAL AI ENGINE
 *
 * Ollama runs on YOUR machine — your AI, your data, no API bills.
 * The AI sovereignty engine for the On Demand Loop.
 *
 * Supported models (install with: ollama pull <model>):
 *   - llama3.2        (default, great for scripts)
 *   - mistral         (fast, good for metadata)
 *   - phi3            (small, efficient)
 *   - qwen2.5         (multilingual — good for Ilonggo/Filipino)
 *   - nomic-embed-text (embeddings for semantic search)
 */

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export interface OllamaGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ContentScript {
  title: string;
  script: string;
  description: string;
  tags: string[];
  targetAudience: string;
  tone: string;
  language: string;
  estimatedDuration: string;
  callToAction: string;
}

export interface ContentMetadata {
  title: string;
  description: string;
  tags: string[];
  category: string;
  sentiment: string;
  keywords: string[];
  suggestedPrice: { amount: number; currency: string };
  languages: string[];
  regions: string[];
}

// ─── CORE GENERATION ─────────────────────────────────────────────────────────

/**
 * Generate text from Ollama (streaming-capable)
 */
export async function generate(
  prompt: string,
  options: OllamaGenerateOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2048,
    stream = false,
  } = options;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream,
      options: {
        temperature,
        num_predict: maxTokens,
        top_p: 0.9,
        repeat_penalty: 1.1,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response?.trim() || '';
}

/**
 * Generate with streaming — yields tokens as they arrive
 * Use for real-time typewriter effect in the UI
 */
export async function* generateStream(
  prompt: string,
  options: OllamaGenerateOptions = {}
): AsyncGenerator<string> {
  const { model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 2048 } = options;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      options: { temperature, num_predict: maxTokens },
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama stream error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.response) yield data.response;
        if (data.done) return;
      } catch {
        // skip malformed lines
      }
    }
  }
}

// ─── SCRIPT GENERATION ───────────────────────────────────────────────────────

/**
 * Generate a complete content script from a sovereign command
 * e.g. "Create a 30-second video on Perseverance for the kids in Bacolod"
 */
export async function generateScript(command: string): Promise<ContentScript> {
  const prompt = `You are the sovereign AI engine for ROYALE — a decentralized content platform.
A creator has issued this command: "${command}"

Generate a complete content script. Respond ONLY with valid JSON matching this exact structure:
{
  "title": "compelling title",
  "script": "the full script text, word for word",
  "description": "2-3 sentence description for the content listing",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "targetAudience": "who this is for",
  "tone": "inspirational|educational|entertaining|devotional|informational",
  "language": "primary language (e.g. English, Filipino, Ilonggo)",
  "estimatedDuration": "e.g. 30 seconds, 2 minutes",
  "callToAction": "what you want the audience to do next"
}

Make the script powerful, authentic, and sovereign. No corporate language. Speak from the soul.`;

  const raw = await generate(prompt, { temperature: 0.8, maxTokens: 1500 });

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]) as ContentScript;
  } catch {
    // Fallback structure if JSON parsing fails
    return {
      title: command.slice(0, 60),
      script: raw,
      description: raw.slice(0, 200),
      tags: ['royale', 'sovereign', 'content'],
      targetAudience: 'Global sovereign audience',
      tone: 'inspirational',
      language: 'English',
      estimatedDuration: '60 seconds',
      callToAction: 'Download and share in your community',
    };
  }
}

/**
 * Generate metadata for an uploaded file
 * (AI analyzes filename/type and generates rich metadata)
 */
export async function generateMetadata(
  fileName: string,
  fileType: string,
  creatorContext?: string
): Promise<ContentMetadata> {
  const prompt = `You are the metadata AI for ROYALE sovereign data cloud.
File uploaded: "${fileName}" (type: ${fileType})
Creator context: ${creatorContext || 'Independent sovereign creator'}

Generate rich metadata. Respond ONLY with valid JSON:
{
  "title": "clean title from filename",
  "description": "compelling 2-3 sentence description",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "category": "music|video|education|devotional|podcast|art|document",
  "sentiment": "inspiring|educational|uplifting|informational|devotional",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "suggestedPrice": { "amount": 0.99, "currency": "ALGO" },
  "languages": ["English"],
  "regions": ["Global"]
}`;

  const raw = await generate(prompt, { temperature: 0.5, maxTokens: 800 });

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]) as ContentMetadata;
  } catch {
    return {
      title: fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      description: `Sovereign content by a Royale creator. ${fileType} format.`,
      tags: ['royale', 'sovereign', fileType.split('/')[0]],
      category: fileType.startsWith('audio') ? 'music' : fileType.startsWith('video') ? 'video' : 'document',
      sentiment: 'informational',
      keywords: ['royale', 'decentralized', 'sovereign'],
      suggestedPrice: { amount: 0.99, currency: 'ALGO' },
      languages: ['English'],
      regions: ['Global'],
    };
  }
}

/**
 * Train custom voice — fine-tune responses to match creator's style
 * Achieved via few-shot prompting with creator's existing content
 */
export async function generateInCreatorVoice(
  command: string,
  creatorSamples: string[],
  creatorName: string
): Promise<string> {
  const samplesText = creatorSamples
    .slice(0, 5)
    .map((s, i) => `Sample ${i + 1}: "${s}"`)
    .join('\n');

  const prompt = `You are writing in the exact voice of ${creatorName}, a sovereign creator on ROYALE.

Study these samples of their writing:
${samplesText}

Now write the following in ${creatorName}'s exact style, cadence, and vocabulary:
"${command}"

Match their: tone, word choice, sentence rhythm, personality. Write as if you ARE them.`;

  return generate(prompt, { temperature: 0.85, maxTokens: 1000 });
}

// ─── EMBEDDING (Semantic Search) ─────────────────────────────────────────────

export async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
      prompt: text,
    }),
  });

  if (!response.ok) throw new Error(`Embed error: ${response.status}`);
  const data = await response.json();
  return data.embedding;
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

export async function checkOllamaHealth(): Promise<{
  online: boolean;
  models: string[];
  version?: string;
}> {
  try {
    const [healthRes, modelsRes] = await Promise.all([
      fetch(`${OLLAMA_URL}/`),
      fetch(`${OLLAMA_URL}/api/tags`),
    ]);

    const modelsData = await modelsRes.json();
    return {
      online: healthRes.ok,
      models: modelsData.models?.map((m: any) => m.name) || [],
      version: healthRes.headers.get('x-ollama-version') || undefined,
    };
  } catch {
    return { online: false, models: [] };
  }
}
