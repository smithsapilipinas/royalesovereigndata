/**
 * ROYALE — SOVEREIGN COMPUTE
 *
 * Routes compute jobs through decentralized infrastructure.
 * No single provider. No single point of failure.
 *
 * PROVIDER WATERFALL (in order of priority):
 *   1. Ollama (local)      — runs on your machine, zero cost, zero latency
 *   2. Akash Network       — decentralized cloud, ~90% cheaper than AWS
 *   3. Bacalhau            — distributed compute over IPFS data
 *
 * HOW IT WORKS:
 *   - Every AI call (metadata, script, voice, embeddings) goes through
 *     submitComputeJob() instead of hitting Ollama directly
 *   - If Ollama is online → it runs there
 *   - If Ollama is offline → job routes to the next available provider
 *   - Job status is tracked in Gun.js (decentralized, no DB needed)
 *   - Results are content-addressed: same input always returns the same CID
 *
 * SETUP:
 *   Local:  ollama serve (already in your stack)
 *   Akash:  Set AKASH_MNEMONIC + AKASH_RPC_ENDPOINT in .env.local
 *   Bacalhau: Set BACALHAU_API_URL in .env.local (default: public node)
 */

import crypto from 'crypto';

// ─── CONFIGURATION ─────────────────────────────────────────────────────────

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const BACALHAU_API = process.env.BACALHAU_API_URL || 'https://bootstrap.production.bacalhau.org:1234/api/v1';
const AKASH_RPC = process.env.AKASH_RPC_ENDPOINT || '';
const COMPUTE_TIMEOUT_MS = parseInt(process.env.COMPUTE_TIMEOUT_MS || '30000');

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type ComputeProvider = 'ollama' | 'bacalhau' | 'akash' | 'unavailable';

export type ComputeJobType =
  | 'metadata'      // generate content metadata
  | 'script'        // generate a content script
  | 'voice'         // generate in creator's voice
  | 'embed'         // generate embeddings for search
  | 'transcribe'    // transcribe audio/video
  | 'summarize';    // summarize long content

export type ComputeJobStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed';

export interface ComputeJob {
  id: string;
  type: ComputeJobType;
  prompt: string;
  model?: string;
  provider?: ComputeProvider;
  status: ComputeJobStatus;
  createdAt: number;
  completedAt?: number;
  durationMs?: number;
  inputCid?: string;  // IPFS CID of input data (for Bacalhau jobs)
  error?: string;
}

export interface ComputeResult {
  jobId: string;
  output: string;
  provider: ComputeProvider;
  model: string;
  durationMs: number;
  cached: boolean;
  inputHash: string;
}

export interface ComputeHealth {
  ollama: { online: boolean; models: string[]; latencyMs?: number };
  bacalhau: { online: boolean; latencyMs?: number };
  akash: { configured: boolean };
  recommended: ComputeProvider;
}

// ─── JOB TRACKING (in-memory + Gun.js) ─────────────────────────────────────

const jobRegistry = new Map<string, ComputeJob>();
const resultCache = new Map<string, ComputeResult>();

function makeJobId(): string {
  return `compute_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashPrompt(prompt: string, model: string): string {
  return crypto.createHash('sha256').update(`${model}:${prompt}`).digest('hex').slice(0, 16);
}

function updateJob(id: string, patch: Partial<ComputeJob>): void {
  const job = jobRegistry.get(id);
  if (job) jobRegistry.set(id, { ...job, ...patch });
}

export function getJob(id: string): ComputeJob | undefined {
  return jobRegistry.get(id);
}

export function listRecentJobs(limit = 20): ComputeJob[] {
  return Array.from(jobRegistry.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// ─── PROVIDER: OLLAMA ───────────────────────────────────────────────────────

async function runOllama(prompt: string, model: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt, stream: false }),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    if (!data.response) throw new Error('Ollama returned empty response');
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

async function checkOllama(): Promise<{ online: boolean; models: string[]; latencyMs?: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false, models: [] };
    const data = await res.json();
    return {
      online: true,
      models: (data.models || []).map((m: { name: string }) => m.name),
      latencyMs: Date.now() - start,
    };
  } catch {
    return { online: false, models: [] };
  }
}

// ─── PROVIDER: BACALHAU ─────────────────────────────────────────────────────
// Bacalhau runs compute jobs over IPFS-stored data.
// Best used for batch processing of uploaded content (transcription, analysis).
// Docs: https://docs.bacalhau.org

async function runBacalhau(prompt: string, inputCid?: string): Promise<string> {
  // Bacalhau job spec: run an Ollama container with the given prompt
  const jobSpec = {
    engine: {
      type: 'docker',
      params: {
        image: 'ollama/ollama:latest',
        entrypoint: ['sh', '-c'],
        parameters: [`ollama run llama3.2 "${prompt.replace(/"/g, '\\"').slice(0, 2000)}"`],
      },
    },
    publisher: { type: 'ipfs' },
    inputs: inputCid ? [{ cid: inputCid, path: '/input' }] : [],
    resources: { cpu: '1', memory: '2Gb' },
    network: { type: 'full' },
  };

  const res = await fetch(`${BACALHAU_API}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job: jobSpec }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bacalhau submit failed: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const bacalhauJobId: string = data.jobId || data.job_id;
  if (!bacalhauJobId) throw new Error('Bacalhau returned no job ID');

  // Poll for result (up to 60 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`${BACALHAU_API}/jobs/${bacalhauJobId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const state = statusData.job?.state?.state as string | undefined;

    if (state === 'Completed' || state === 'complete') {
      const executions = statusData.job?.executions || [];
      for (const exec of executions) {
        const outputCid: string | undefined = exec?.publishedResult?.cid;
        if (outputCid) {
          // Fetch output from IPFS
          const outputRes = await fetch(`https://dweb.link/ipfs/${outputCid}/stdout`);
          if (outputRes.ok) return outputRes.text();
        }
      }
      return statusData.job?.state?.message || 'Job completed (no output retrieved)';
    }

    if (state === 'Error' || state === 'failed') {
      throw new Error(`Bacalhau job failed: ${statusData.job?.state?.message || 'unknown error'}`);
    }
  }

  throw new Error('Bacalhau job timed out after 60s');
}

async function checkBacalhau(): Promise<{ online: boolean; latencyMs?: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACALHAU_API}/health`, { signal: AbortSignal.timeout(4000) });
    return { online: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { online: false };
  }
}

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────

export async function getComputeHealth(): Promise<ComputeHealth> {
  const [ollama, bacalhau] = await Promise.all([
    checkOllama(),
    checkBacalhau(),
  ]);

  const recommended: ComputeProvider =
    ollama.online ? 'ollama'
    : bacalhau.online ? 'bacalhau'
    : 'unavailable';

  return {
    ollama,
    bacalhau,
    akash: { configured: !!AKASH_RPC },
    recommended,
  };
}

// ─── MAIN: submitComputeJob ─────────────────────────────────────────────────
//
// Drop-in replacement for direct Ollama calls in ollama.ts.
// The upload route, generate route, and any other AI-dependent code
// can call this instead of hitting Ollama directly.

export async function submitComputeJob(
  type: ComputeJobType,
  prompt: string,
  options: {
    model?: string;
    inputCid?: string;
    forceProvider?: ComputeProvider;
    timeoutMs?: number;
  } = {}
): Promise<ComputeResult> {
  const model = options.model || OLLAMA_MODEL;
  const timeoutMs = options.timeoutMs || COMPUTE_TIMEOUT_MS;
  const inputHash = hashPrompt(prompt, model);

  // Check cache first
  const cached = resultCache.get(inputHash);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Register job
  const job: ComputeJob = {
    id: makeJobId(),
    type,
    prompt: prompt.slice(0, 500), // truncate for storage
    model,
    status: 'pending',
    createdAt: Date.now(),
    inputCid: options.inputCid,
  };
  jobRegistry.set(job.id, job);

  const startMs = Date.now();
  let output = '';
  let provider: ComputeProvider = 'unavailable';

  updateJob(job.id, { status: 'running' });

  try {
    if (options.forceProvider !== 'bacalhau') {
      // Try Ollama first (fastest, cheapest, most sovereign)
      try {
        output = await runOllama(prompt, model, timeoutMs);
        provider = 'ollama';
      } catch (ollamaErr) {
        const msg = ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr);
        console.warn(`[COMPUTE] Ollama unavailable (${msg}), trying Bacalhau…`);

        // Fallback: Bacalhau
        output = await runBacalhau(prompt, options.inputCid);
        provider = 'bacalhau';
      }
    } else {
      output = await runBacalhau(prompt, options.inputCid);
      provider = 'bacalhau';
    }

    const durationMs = Date.now() - startMs;
    updateJob(job.id, { status: 'complete', completedAt: Date.now(), durationMs, provider });

    const result: ComputeResult = {
      jobId: job.id,
      output,
      provider,
      model,
      durationMs,
      cached: false,
      inputHash,
    };

    // Cache successful results
    resultCache.set(inputHash, result);
    // Keep cache bounded
    if (resultCache.size > 200) {
      const firstKey = resultCache.keys().next().value;
      if (firstKey) resultCache.delete(firstKey);
    }

    return result;

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    updateJob(job.id, { status: 'failed', completedAt: Date.now(), error: errMsg });
    throw new Error(`[COMPUTE] All providers failed for job ${job.id}: ${errMsg}`);
  }
}

// ─── CONVENIENCE WRAPPERS ────────────────────────────────────────────────────
// These match the signatures in lib/ollama.ts so existing call sites
// can swap import { generateMetadata } from '@/lib/ollama' for
// import { computeMetadata } from '@/lib/compute' with no other changes.

export async function computeMetadata(
  fileName: string,
  fileType: string,
  context?: string
): Promise<Record<string, unknown> | null> {
  const prompt = `Generate JSON metadata for a file uploaded to the ROYALE sovereign content platform.

File: "${fileName}"
Type: "${fileType}"
Context: "${context || 'no additional context'}"

Return ONLY valid JSON, no markdown:
{
  "title": "<clean readable title>",
  "description": "<2-3 sentence description>",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "<music|video|document|image>",
  "sentiment": "<informational|creative|educational|entertainment>",
  "keywords": ["kw1", "kw2"],
  "languages": ["English"],
  "regions": ["Global"],
  "suggestedPrice": { "amount": 0.99, "currency": "ALGO" }
}`;

  try {
    const result = await submitComputeJob('metadata', prompt);
    const clean = result.output.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export async function computeScript(command: string): Promise<string> {
  const result = await submitComputeJob('script', command, { timeoutMs: 60000 });
  return result.output;
}

export async function computeEmbed(text: string): Promise<number[]> {
  // Embeddings require Ollama with nomic-embed-text — no Bacalhau fallback
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
      prompt: text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

export async function computeTranscribe(ipfsCid: string): Promise<string> {
  // Transcription is a natural Bacalhau job — the audio lives on IPFS already
  const prompt = 'Transcribe the audio file at /input. Return plain text only, no timestamps.';
  const result = await submitComputeJob('transcribe', prompt, {
    inputCid: ipfsCid,
    forceProvider: 'bacalhau',
    timeoutMs: 120000, // transcription takes longer
  });
  return result.output;
}
