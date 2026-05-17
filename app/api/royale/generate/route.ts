/**
 * ROYALE — API ROUTE: /api/royale/generate
 *
 * The On Demand Loop — AI content generation pipeline:
 *   POST /api/royale/generate
 *   Body: { command, mode, creatorSamples?, language? }
 *
 * Modes:
 *   'script'   — Generate a full content script
 *   'metadata' — Generate metadata for a file
 *   'voice'    — Generate in the creator's voice
 *   'stream'   — Stream tokens in real-time (SSE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateScript, generateMetadata, generateInCreatorVoice, generateStream, checkOllamaHealth } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Health check
export async function GET() {
  const health = await checkOllamaHealth();
  return NextResponse.json(health, { headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      command,
      mode = 'script',
      fileName,
      fileType,
      creatorSamples = [],
      creatorName = 'Sovereign Creator',
      stream = false,
    } = body;

    if (!command && !fileName) {
      return NextResponse.json(
        { error: 'command or fileName required' },
        { status: 400, headers: CORS }
      );
    }

    // ── STREAMING MODE (SSE) ──────────────────────────────────────────────────
    if (stream && mode === 'script') {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const prompt = `You are the sovereign AI engine for ROYALE.
Create powerful content for this command: "${command}"
Write the full script, naturally and authentically. No corporate speak.`;

            for await (const token of generateStream(prompt)) {
              const data = `data: ${JSON.stringify({ token })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          ...CORS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ── STANDARD MODES ────────────────────────────────────────────────────────
    let result: any;

    switch (mode) {
      case 'script':
        result = await generateScript(command);
        break;

      case 'metadata':
        result = await generateMetadata(fileName, fileType, command);
        break;

      case 'voice':
        if (!creatorSamples.length) {
          return NextResponse.json(
            { error: 'creatorSamples required for voice mode' },
            { status: 400, headers: CORS }
          );
        }
        const text = await generateInCreatorVoice(command, creatorSamples, creatorName);
        result = { text, creator: creatorName };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown mode: ${mode}` },
          { status: 400, headers: CORS }
        );
    }

    return NextResponse.json(
      { success: true, mode, result },
      { status: 200, headers: CORS }
    );

  } catch (err: any) {
    console.error('[ROYALE/generate] Error:', err);

    // Ollama offline — return helpful error
    if (err.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'Ollama AI engine offline',
          fix: 'Run: ollama serve && ollama pull llama3.2',
          docs: 'https://ollama.ai',
        },
        { status: 503, headers: CORS }
      );
    }

    return NextResponse.json(
      { error: 'Generation failed', message: err.message },
      { status: 500, headers: CORS }
    );
  }
}
