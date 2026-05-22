/**
 * ROYALE — API ROUTE: /api/compute
 *
 * Sovereign Compute job management endpoint.
 *
 * GET  /api/compute          — health check across all providers
 * GET  /api/compute?jobId=x  — get status of a specific job
 * GET  /api/compute?list=1   — list recent jobs
 * POST /api/compute          — submit a new compute job
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  submitComputeJob,
  getComputeHealth,
  getJob,
  listRecentJobs,
  ComputeJobType,
  ComputeProvider,
} from '@/lib/compute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const list = searchParams.get('list');

  if (jobId) {
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404, headers: CORS });
    }
    return NextResponse.json({ job }, { headers: CORS });
  }

  if (list) {
    const jobs = listRecentJobs(parseInt(list) || 20);
    return NextResponse.json({ jobs, count: jobs.length }, { headers: CORS });
  }

  // Default: health check
  const health = await getComputeHealth();
  return NextResponse.json({ health }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      prompt,
      model,
      inputCid,
      forceProvider,
      timeoutMs,
    } = body as {
      type: ComputeJobType;
      prompt: string;
      model?: string;
      inputCid?: string;
      forceProvider?: ComputeProvider;
      timeoutMs?: number;
    };

    if (!type || !prompt) {
      return NextResponse.json(
        { error: 'type and prompt are required' },
        { status: 400, headers: CORS }
      );
    }

    const validTypes: ComputeJobType[] = ['metadata', 'script', 'voice', 'embed', 'transcribe', 'summarize'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400, headers: CORS }
      );
    }

    const result = await submitComputeJob(type, prompt, {
      model,
      inputCid,
      forceProvider,
      timeoutMs,
    });

    return NextResponse.json({ result }, { headers: CORS });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[COMPUTE API]', message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS }
    );
  }
}
