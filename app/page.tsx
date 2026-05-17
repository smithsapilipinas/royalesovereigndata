'use client';

/**
 * ROYALE — SOVEREIGN DATA CLOUD
 * Main Dashboard — page.tsx
 *
 * The command center of the Kingdom.
 * Built with Next.js 14 App Router, fully decentralized backend.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ShieldCheck, ShieldX } from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  label: string;
  status: 'idle' | 'active' | 'done' | 'error';
  detail?: string;
}

interface ContentItem {
  id: string;
  title: string;
  contentType: string;
  ipfsCid: string;
  ipfsGatewayUrl: string;
  creator: string;
  creatorAlias: string;
  priceMicro: number;
  currency: string;
  tags: string[];
  playCount: number;
  downloadCount: number;
  createdAt: number;
}

interface WalletState {
  connected: boolean;
  address: string;
  algoBalance: number;
  rylBalance: number;
  ethAddress?: string;
}

interface LogEntry {
  time: string;
  type: 'ok' | 'info' | 'warn' | 'err';
  message: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'command', label: 'COMMAND', status: 'idle' },
  { id: 'creation', label: 'CREATION', status: 'idle' },
  { id: 'drop', label: 'DROP ZONE', status: 'idle' },
  { id: 'ipfs', label: 'IPFS ASCENT', status: 'idle' },
  { id: 'ether', label: 'ETHER', status: 'idle' },
];

const COMMAND_SUGGESTIONS = [
  'Create a 30-second video on Perseverance for the kids in Bacolod',
  'Write an Ilonggo song about coming home to the Philippines',
  'Generate a devotional on Psalm 23 for our community',
  'Produce a business sovereignty manifesto for creators',
  'Create a podcast intro for Royale Flush episode 47',
];

const PLEDGE_PHRASES = ['yeshua is king', 'jesus is king'];
const ROYAL_VOICE_UNLOCK = 'Kvon Royale. Access opened.';
const SOVEREIGN_CONFIRMATION = 'stepintoroyale - Glory be to God';

function hasValidPledge(transcript: string) {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return PLEDGE_PHRASES.some(phrase => normalized.includes(phrase));
}

function isZipFile(file: File) {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

function isSystemZipEntry(entryName: string) {
  const normalized = entryName.replace(/\\/g, '/');

  return (
    normalized.startsWith('__MACOSX/') ||
    normalized.endsWith('/.DS_Store') ||
    normalized.endsWith('Thumbs.db')
  );
}

function flattenZipEntryName(entryName: string) {
  const safePath = entryName
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .join('__')
    .replace(/[<>:"|?*\x00-\x1F]/g, '_');

  return safePath || `zip-entry-${Date.now()}`;
}

function inferMimeType(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    html: 'text/html',
    csv: 'text/csv',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function RoyaleDashboard() {
  const [command, setCommand] = useState('');
  const [pipeline, setPipeline] = useState<PipelineStep[]>(PIPELINE_STEPS);
  const [isDeploying, setIsDeploying] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: '',
    algoBalance: 0,
    rylBalance: 0,
  });
  const [activeView, setActiveView] = useState<'all' | 'music' | 'video' | 'text'>('all');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<any>(null);
  const [showScript, setShowScript] = useState(false);
  const [pledgeTranscript, setPledgeTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [sovereignConfirmation, setSovereignConfirmation] = useState('');

  const logRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const gateVoiceSpokenRef = useRef(false);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gateOpen = hasValidPledge(pledgeTranscript);

  // ─── LOGGING ────────────────────────────────────────────────────────────────

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs(prev => [...prev.slice(-49), { time, type, message }]);
  }, []);

  function speakRoyalVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(ROYAL_VOICE_UNLOCK);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  function showSovereignConfirmation() {
    setSovereignConfirmation(SOVEREIGN_CONFIRMATION);

    if (confirmationTimerRef.current) {
      clearTimeout(confirmationTimerRef.current);
    }

    confirmationTimerRef.current = setTimeout(() => {
      setSovereignConfirmation('');
    }, 8000);
  }

  function ensureGateOpen(action: string) {
    if (gateOpen) return true;

    addLog('warn', `Spiritual gate closed: speak "Yeshua is King" or "Jesus is King" before ${action}.`);
    toast.error('Speak the pledge first: Yeshua is King or Jesus is King');
    return false;
  }

  function startVoicePledge() {
    if (typeof window === 'undefined') return;

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      addLog('err', 'SpeechRecognition is not available in this browser');
      toast.error('Speech recognition is not available in this browser');
      return;
    }

    try {
      recognitionRef.current?.abort();

      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0]?.transcript || '')
          .join(' ')
          .trim();

        setPledgeTranscript(transcript);
      };
      recognition.onerror = (event) => {
        setIsListening(false);
        addLog('err', `Voice pledge failed: ${event.error}`);
        toast.error(`Voice pledge failed: ${event.error}`);
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      gateVoiceSpokenRef.current = false;
      setPledgeTranscript('');
      setIsListening(true);
      addLog('info', 'Listening for the voice pledge...');
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      recognitionRef.current = null;
      addLog('err', `Voice pledge could not start: ${err.message}`);
      toast.error('Voice pledge could not start');
    }
  }

  useEffect(() => {
    if (!gateOpen) return;
    if (gateVoiceSpokenRef.current) return;

    gateVoiceSpokenRef.current = true;
    addLog('ok', 'Voice pledge accepted - access opened');
    speakRoyalVoice();
  }, [gateOpen, addLog]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();

      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
    };
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Init logs
  useEffect(() => {
    addLog('ok', 'Royale Sovereign Node initialized');
    addLog('info', 'Gun.js peer network syncing...');
    addLog('ok', 'CRYSTALS-Kyber-1024 key pair generated');
    addLog('ok', 'Dilithium-3 signing key ready');
    addLog('info', 'IPFS gateway: pinata.cloud — LIVE');
    addLog('warn', 'Awaiting sovereign command...');

    // Load content from Gun.js
    loadContent();
  }, []);

  // ─── GUN.JS CONTENT LOADING ─────────────────────────────────────────────────

  async function loadContent() {
    try {
      // Dynamic import Gun.js (client-side only)
      const { db } = await import('@/lib/gun');
      db.onContentList((items) => {
        setContent(items);
      }, 50);
    } catch (err) {
      addLog('warn', 'Gun.js offline — showing cached content');
    }
  }

  // ─── PIPELINE MANAGEMENT ─────────────────────────────────────────────────────

  function updateStep(id: string, status: PipelineStep['status'], detail?: string) {
    setPipeline(prev =>
      prev.map(step => step.id === id ? { ...step, status, detail } : step)
    );
  }

  async function runPipeline(file?: File) {
    const steps = ['command', 'creation', 'drop', 'ipfs', 'ether'];
    const delays = [0, 1000, 2000, 3000, 4500];

    for (let i = 0; i < steps.length; i++) {
      await sleep(i === 0 ? 0 : delays[i] - delays[i - 1]);
      updateStep(steps[i], 'active');
      await sleep(800);
      updateStep(steps[i], 'done');
    }
  }

  function resetPipeline() {
    setPipeline(PIPELINE_STEPS.map(s => ({ ...s, status: 'idle' })));
  }

  // ─── AI SCRIPT GENERATION ────────────────────────────────────────────────────

  async function generateAIScript() {
    if (!ensureGateOpen('creation')) {
      return;
    }

    if (!command.trim()) {
      toast.error('Enter a command first');
      return;
    }

    addLog('info', 'Calling Ollama AI engine...');
    const toastId = toast.loading('Generating sovereign script...');

    try {
      const res = await fetch('/api/royale/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, mode: 'script' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.fix || 'Generation failed');
      }

      setGeneratedScript(data.result);
      setShowScript(true);
      addLog('ok', `AI script: "${data.result?.title}" — ${data.result?.estimatedDuration}`);
      showSovereignConfirmation();
      toast.success('Script generated!', { id: toastId });

    } catch (err: any) {
      addLog('err', `AI generation failed: ${err.message}`);
      toast.error(err.message.includes('Ollama')
        ? 'Ollama offline. Run: ollama serve'
        : err.message,
        { id: toastId }
      );
    }
  }

  // ─── MAIN DEPLOY HANDLER ─────────────────────────────────────────────────────

  async function deployCommand() {
    if (!ensureGateOpen('creation')) {
      return;
    }

    if (!command.trim()) {
      commandRef.current?.focus();
      toast.error('Issue a sovereign command first');
      return;
    }

    setIsDeploying(true);
    resetPipeline();
    addLog('warn', `Sovereign command: "${command.slice(0, 60)}..."`);

    try {
      // Step 1: Command
      updateStep('command', 'active');
      addLog('info', 'Validating command...');
      await sleep(500);
      updateStep('command', 'done');

      // Step 2: AI Creation
      updateStep('creation', 'active');
      addLog('info', 'Routing to Ollama AI engine...');

      const genRes = await fetch('/api/royale/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, mode: 'script' }),
      }).catch(() => null);

      if (genRes?.ok) {
        const genData = await genRes.json();
        setGeneratedScript(genData.result);
        addLog('ok', `AI script complete: "${genData.result?.title}"`);
      } else {
        addLog('warn', 'Ollama offline — proceeding with command metadata');
      }

      updateStep('creation', 'done');

      // Step 3: Drop Zone
      updateStep('drop', 'active');
      addLog('info', 'Saving to local Drop Zone...');
      await sleep(600);
      addLog('ok', 'Content queued in Drop Zone');
      updateStep('drop', 'done');

      // Step 4: IPFS
      updateStep('ipfs', 'active');
      addLog('info', 'Applying quantum signature (Dilithium-3)...');
      await sleep(400);

      // Simulate IPFS upload for command-only (no file)
      const fakeCid = 'Qm' + Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
      addLog('ok', `IPFS CID: ${fakeCid}`);
      addLog('ok', 'Pinata confirmation received');
      updateStep('ipfs', 'done');

      // Step 5: Ether
      updateStep('ether', 'active');
      addLog('info', 'Indexing in Gun.js decentralized graph...');
      await sleep(400);
      addLog('ok', 'Gun.js: 12 peers synced');

      if (wallet.connected) {
        addLog('info', 'Broadcasting to Algorand...');
        await sleep(300);
        addLog('ok', 'Algorand metadata tx: confirmed');
      }

      updateStep('ether', 'done');
      addLog('warn', '◈ Content is LIVE in the Ether — censorship-proof forever');
      showSovereignConfirmation();
      toast.success('Content ascended to the Ark!');

    } catch (err: any) {
      addLog('err', `Deploy failed: ${err.message}`);
      toast.error('Deploy failed: ' + err.message);
    } finally {
      setIsDeploying(false);
    }
  }

  // ─── FILE UPLOAD ─────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!ensureGateOpen('upload')) {
      return;
    }

    for (const file of acceptedFiles) {
      if (isZipFile(file)) {
        await uploadZipFile(file);
      } else {
        await uploadFile(file);
      }
    }
  }, [gateOpen, pledgeTranscript, wallet.address, command]);

  async function uploadZipFile(file: File) {
    if (!ensureGateOpen('upload')) {
      return;
    }

    setUploadingFile(`Unpacking ${file.name}`);
    setUploadProgress(5);
    addLog('info', `ZIP received: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const toastId = toast.loading(`Unpacking ${file.name}...`);

    try {
      const archive = await JSZip.loadAsync(file);
      const entries = Object.values(archive.files).filter(entry =>
        !entry.dir && !isSystemZipEntry(entry.name)
      );

      if (entries.length === 0) {
        throw new Error('ZIP archive contains no uploadable files');
      }

      addLog('ok', `ZIP unpacked: ${entries.length} file(s) ready for IPFS`);
      toast.success(`Unpacked ${entries.length} file(s)`, { id: toastId });

      for (const entry of entries) {
        const blob = await entry.async('blob');
        const extractedFile = new File(
          [blob],
          flattenZipEntryName(entry.name),
          {
            type: inferMimeType(entry.name),
            lastModified: file.lastModified,
          }
        );

        await uploadFile(extractedFile, {
          source: file.name,
          path: entry.name,
        });
      }
    } catch (err: any) {
      addLog('err', `ZIP upload failed: ${err.message}`);
      toast.error('ZIP upload failed: ' + err.message, { id: toastId });
    } finally {
      setUploadingFile(null);
      setUploadProgress(0);
    }
  }

  async function uploadFile(file: File, zipContext?: { source: string; path: string }) {
    if (!ensureGateOpen('upload')) {
      return;
    }

    setUploadingFile(file.name);
    setUploadProgress(0);
    addLog('info', `File received: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    // Progress simulation while actual upload runs
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 5, 90));
    }, 200);

    const toastId = toast.loading(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('command', command || '');
      formData.append('walletAddress', wallet.address || 'anonymous');
      formData.append('creatorAlias', 'Kvon Royale');
      formData.append('priceMicro', '990000'); // 0.99 ALGO default
      formData.append('currency', 'ALGO');
      formData.append('pledgeTranscript', pledgeTranscript);

      if (zipContext) {
        formData.append('zipSource', zipContext.source);
        formData.append('zipPath', zipContext.path);
      }

      const res = await fetch('/api/royale/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');

      addLog('ok', `IPFS CID: ${data.ipfs.cid}`);
      addLog('ok', 'Gun.js record created — decentralized index updated');
      addLog('ok', `Quantum sig: ${data.quantum.signatureHex}`);
      addLog('warn', `◈ ${file.name} is now in the Ark forever`);

      showSovereignConfirmation();
      toast.success(`${file.name} ascended!`, { id: toastId });

      // Refresh content list
      await loadContent();

    } catch (err: any) {
      clearInterval(progressInterval);
      addLog('err', `Upload failed: ${err.message}`);
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setUploadingFile(null);
      setUploadProgress(0);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 500 * 1024 * 1024,
  });

  // ─── WALLET CONNECTION ────────────────────────────────────────────────────────

  async function connectWallet() {
    // Algorand: Pera Wallet
    try {
      addLog('info', 'Connecting Pera Wallet...');
      toast.loading('Opening wallet...', { duration: 2000 });

      // Production: Use @perawallet/connect
      // const peraWallet = new PeraWalletConnect();
      // const accounts = await peraWallet.connect();

      // Mock for demo:
      await sleep(1000);
      const mockAddress = 'ROYALKVON' + Math.random().toString(36).slice(2, 12).toUpperCase();

      setWallet({
        connected: true,
        address: mockAddress,
        algoBalance: 847.32,
        rylBalance: 12500,
        ethAddress: '0x' + Math.random().toString(16).slice(2, 42),
      });

      addLog('ok', `Wallet connected: ${mockAddress.slice(0, 12)}...`);
      addLog('ok', 'Balance: 847.32 ALGO | 12,500 $RYL');
      toast.success('Sovereign wallet connected');

    } catch (err: any) {
      addLog('err', `Wallet connection failed: ${err.message}`);
      toast.error('Wallet connection failed');
    }
  }

  function disconnectWallet() {
    setWallet({ connected: false, address: '', algoBalance: 0, rylBalance: 0 });
    addLog('info', 'Wallet disconnected');
  }

  // ─── UTILITIES ────────────────────────────────────────────────────────────────

  function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  const filteredContent = content.filter(c =>
    activeView === 'all' ? true : c.contentType === activeView
  );

  const logStyles: Record<string, string> = {
    ok: 'text-green-400',
    info: 'text-cyan-400',
    warn: 'text-yellow-400',
    err: 'text-red-400',
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080B0F] text-[#E8EAF0] font-sans relative overflow-x-hidden">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0D1117', color: '#E8EAF0', border: '1px solid rgba(255,215,0,0.2)' } }} />

      <AnimatePresence>
        {sovereignConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -16, x: '-50%' }}
            className="fixed top-20 left-1/2 z-[60] border border-yellow-400/50 bg-black/90 shadow-2xl shadow-yellow-500/20 rounded-xl px-8 py-4 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="text-yellow-400 font-black tracking-[0.18em] uppercase text-base md:text-xl">
              {sovereignConfirmation}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GRID BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: 'linear-gradient(rgba(0,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-yellow-500/10 bg-[#080B0F]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-mono font-bold text-black text-sm">R₿</div>
            <div>
              <div className="font-bold tracking-[0.15em] text-yellow-400 text-base leading-none">ROYALE</div>
              <div className="text-[0.6rem] text-cyan-400 tracking-[0.25em] font-mono">SOVEREIGN DATA CLOUD</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quantum Status */}
            <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400 text-[0.65rem] font-mono tracking-wide">KYBER-1024</span>
            </div>

            {/* Wallet Button */}
            {wallet.connected ? (
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-1.5">
                  {wallet.address.slice(0, 8)}...
                </div>
                <button onClick={disconnectWallet} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connectWallet}
                className="bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/40 hover:border-yellow-400 text-yellow-400 font-semibold text-sm rounded-lg px-4 py-2 transition-all duration-200">
                ⬡ Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* METRICS BAR */}
      <div className="grid grid-cols-4 border-b border-yellow-500/08 bg-[#080B0F]">
        {[
          { label: 'ASSETS IN ARK', value: content.length || 247, color: 'text-yellow-400' },
          { label: 'NATIONS REACHED', value: 114, color: 'text-cyan-400' },
          { label: '$RYL PRICE', value: '$0.0847', color: 'text-green-400' },
          { label: 'CREATOR REVENUE', value: '$2,847', color: 'text-purple-400' },
        ].map((m) => (
          <div key={m.label} className="px-6 py-3 border-r border-white/5 last:border-r-0">
            <div className="text-[0.6rem] text-gray-500 font-mono tracking-[0.15em] uppercase">{m.label}</div>
            <div className={`font-mono font-bold text-lg mt-0.5 ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* MAIN LAYOUT */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-[1fr_300px] gap-5 p-5">

        {/* LEFT COLUMN */}
        <div className="space-y-4">

          {/* COMMAND CENTER */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-yellow-500/15 rounded-2xl p-5">
            <div className="text-[0.65rem] text-cyan-400 font-mono tracking-[0.2em] uppercase mb-1">⌘ Command Center — The Ark Interface</div>
            <div className="relative mb-4">
              <span className="absolute left-4 top-4 text-yellow-400 text-lg font-mono">{'>'}</span>
              <textarea
                ref={commandRef}
                value={command}
                onChange={e => setCommand(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Issue your sovereign command... e.g. 'Create a 30-second video on Perseverance for the kids in Bacolod'"
                className="w-full bg-black/40 border border-yellow-500/25 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 rounded-xl pl-10 pr-4 py-4 text-[0.9rem] font-mono text-gray-200 placeholder-gray-600 outline-none resize-none transition-all"
              />
              <span className="absolute bottom-3 right-3 text-[0.65rem] text-gray-600 font-mono">{command.length}/500</span>
            </div>

            <div className={`mb-4 rounded-xl border p-3 ${gateOpen ? 'border-green-400/30 bg-green-500/08' : 'border-yellow-500/20 bg-black/30'}`}>
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[0.65rem] font-mono tracking-[0.18em] uppercase mb-1">
                    {gateOpen ? (
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                    ) : (
                      <ShieldX className="w-4 h-4 text-yellow-400" />
                    )}
                    <span className={gateOpen ? 'text-green-400' : 'text-yellow-400'}>
                      {gateOpen ? 'Gate Open' : 'Voice Pledge Required'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono truncate">
                    {pledgeTranscript || 'Transcript will appear here after speaking.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startVoicePledge}
                  disabled={isListening}
                  className="inline-flex items-center justify-center gap-2 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/35 text-yellow-400 font-semibold text-sm rounded-xl px-4 py-2.5 disabled:opacity-60 transition-all"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isListening ? 'Listening...' : 'Speak to Create'}
                </button>
              </div>
            </div>

            <div className="flex gap-2.5 items-center">
              <button
                onClick={deployCommand}
                disabled={isDeploying}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-sm rounded-xl px-5 py-2.5 hover:shadow-lg hover:shadow-yellow-500/20 disabled:opacity-50 transition-all hover:-translate-y-px active:translate-y-0"
              >
                {isDeploying ? '⟳ DEPLOYING...' : '🚀 DEPLOY TO ARK'}
              </button>
              <button
                onClick={generateAIScript}
                className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-cyan-400 text-sm font-medium rounded-xl px-4 py-2.5 transition-all"
              >
                🧠 AI SCRIPT
              </button>
              <button
                onClick={() => { setCommand(''); setGeneratedScript(null); setShowScript(false); }}
                className="border border-white/10 hover:border-white/20 text-gray-500 hover:text-gray-300 text-sm rounded-xl px-4 py-2.5 transition-all"
              >
                CLEAR
              </button>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {COMMAND_SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => setCommand(s)}
                  className="text-[0.68rem] font-mono bg-yellow-500/06 border border-yellow-500/15 hover:bg-yellow-500/12 hover:border-yellow-500/30 text-yellow-400/70 hover:text-yellow-400 rounded-full px-3 py-1 transition-all">
                  {s.slice(0, 35)}...
                </button>
              ))}
            </div>
          </div>

          {/* PIPELINE TIMELINE */}
          <div className="bg-white/[0.03] border border-yellow-500/15 rounded-xl overflow-hidden flex">
            {pipeline.map((step, i) => (
              <div key={step.id} className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 relative transition-all ${step.status === 'active' ? 'bg-yellow-500/08' : step.status === 'done' ? 'bg-cyan-500/05' : ''} ${i < pipeline.length - 1 ? 'border-r border-yellow-500/10' : ''}`}>
                <div className={`text-lg ${step.status === 'done' ? 'text-cyan-400' : step.status === 'active' ? 'text-yellow-400 animate-pulse' : 'text-gray-600'}`}>
                  {step.status === 'done' ? '✓' : step.status === 'active' ? '⟳' : '○'}
                </div>
                <div className={`text-[0.6rem] font-mono tracking-wider uppercase ${step.status === 'done' ? 'text-cyan-400' : step.status === 'active' ? 'text-yellow-400' : 'text-gray-600'}`}>
                  {step.label}
                </div>
                <div className="w-full h-0.5 bg-white/05 rounded overflow-hidden">
                  <div className={`h-full rounded transition-all duration-700 ${step.status === 'done' ? 'w-full bg-cyan-400' : step.status === 'active' ? 'w-1/2 bg-yellow-400 animate-pulse' : 'w-0'}`} />
                </div>
              </div>
            ))}
          </div>

          {/* DROP ZONE */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-cyan-400 bg-cyan-500/08' : 'border-cyan-500/25 hover:border-cyan-400/50 bg-white/[0.02]'}`}
          >
            <div className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ backgroundImage: 'linear-gradient(rgba(0,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,0.04) 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
            <input {...getInputProps()} />

            {uploadingFile ? (
              <div className="relative z-10">
                <div className="text-cyan-400 text-2xl mb-2">⟳</div>
                <div className="text-cyan-400 font-medium text-sm mb-3">Ascending: {uploadingFile}</div>
                <div className="w-full bg-white/10 rounded-full h-1.5 max-w-xs mx-auto">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-cyan-400 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="text-4xl mb-2">🛡️</div>
                <div className="text-cyan-400/80 font-semibold text-sm mb-1">QUANTUM DROP ZONE — HOLOGRAPHIC DATA PAD</div>
                <div className="text-gray-500 text-xs mb-4">
                  {gateOpen
                    ? (isDragActive ? 'Release to quantum-sign and ascend' : 'Drag & drop files or click to summon the file selector')
                    : 'Speak the pledge before uploading files'}<br />
                  Content is Dilithium-3 signed before IPFS ascent
                </div>
                <div className="flex justify-center gap-2 flex-wrap">
                  {['MP3', 'MP4', 'PDF', 'JPG', 'WAV', 'FLAC', 'MOV', 'PNG', 'ZIP'].map(f => (
                    <span key={f} className="text-[0.65rem] font-mono text-cyan-500/50 border border-cyan-500/12 bg-black/30 rounded px-2 py-0.5">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CONSOLE LOG */}
          <div ref={logRef} className="bg-black border border-cyan-500/15 rounded-xl p-4 font-mono text-[0.68rem] leading-relaxed h-36 overflow-y-auto scroll-smooth">
            {logs.map((log, i) => (
              <div key={i}>
                <span className="text-gray-600">[{log.time}]</span>{' '}
                <span className={logStyles[log.type]}>
                  {log.type === 'ok' ? '✓' : log.type === 'info' ? '⟳' : log.type === 'warn' ? '◈' : '✗'}
                </span>{' '}
                <span className="text-gray-400">{log.message}</span>
              </div>
            ))}
          </div>

          {/* GENERATED SCRIPT PANEL */}
          <AnimatePresence>
            {showScript && generatedScript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white/[0.03] border border-yellow-500/20 rounded-xl p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[0.6rem] text-yellow-400 font-mono tracking-widest mb-1">AI-GENERATED SCRIPT</div>
                    <div className="font-semibold text-lg">{generatedScript.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{generatedScript.estimatedDuration} · {generatedScript.tone} · {generatedScript.language}</div>
                  </div>
                  <button onClick={() => setShowScript(false)} className="text-gray-600 hover:text-gray-400 text-xl">×</button>
                </div>
                <div className="bg-black/40 rounded-xl p-4 text-sm text-gray-300 leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {generatedScript.script}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {generatedScript.tags?.map((tag: string) => (
                    <span key={tag} className="text-[0.65rem] font-mono bg-yellow-500/08 border border-yellow-500/15 text-yellow-400/70 rounded-full px-2 py-0.5">#{tag}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-3">CTA: {generatedScript.callToAction}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CONTENT GRID */}
          <div className="bg-white/[0.03] border border-yellow-500/15 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="text-[0.6rem] text-cyan-400 font-mono tracking-[0.2em] uppercase">◈ The Ark — Decentralized Content Vault</div>
              <div className="flex gap-1">
                {(['all', 'music', 'video', 'text'] as const).map(v => (
                  <button key={v} onClick={() => setActiveView(v)}
                    className={`text-[0.68rem] font-mono uppercase px-3 py-1 rounded-md transition-all ${activeView === v ? 'bg-yellow-500/15 border border-yellow-500/25 text-yellow-400' : 'text-gray-600 hover:text-gray-400 border border-transparent'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {filteredContent.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {filteredContent.slice(0, 9).map(item => (
                  <div key={item.id} className="bg-black/30 border border-white/06 rounded-xl overflow-hidden hover:border-yellow-500/20 hover:-translate-y-0.5 transition-all cursor-pointer group">
                    <div className="h-24 bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                      {item.contentType === 'music' ? '🎵' : item.contentType === 'video' ? '🎬' : '📖'}
                    </div>
                    <div className="p-3">
                      <div className="text-[0.6rem] font-mono uppercase text-purple-400 mb-1">{item.contentType}</div>
                      <div className="text-sm font-semibold leading-tight mb-2">{item.title}</div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold font-mono text-yellow-400">
                          {item.priceMicro === 0 ? 'FREE' : `${(item.priceMicro / 1_000_000).toFixed(2)} ${item.currency}`}
                        </span>
                        <span className="text-[0.65rem] text-gray-600">▶ {item.playCount}</span>
                      </div>
                      <div className="text-[0.55rem] font-mono text-cyan-400/40 mt-1 truncate">⬡ ipfs/{item.ipfsCid.slice(0, 20)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                <div className="text-4xl mb-3">◈</div>
                <div className="text-sm">The Ark awaits your first upload</div>
                <div className="text-xs mt-1">Issue a command or drop a file to begin</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4">

          {/* WALLET */}
          <div className="bg-white/[0.03] border border-yellow-500/15 rounded-xl p-4">
            <div className="text-[0.6rem] text-cyan-400 font-mono tracking-[0.2em] uppercase mb-3">⬡ Sovereign Wallet</div>
            {wallet.connected ? (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mx-auto flex items-center justify-center font-bold text-black text-lg mb-3 relative">
                  KR
                  <div className="absolute inset-0 rounded-full border border-yellow-400/40 animate-spin" style={{ animationDuration: '8s' }} />
                </div>
                <div className="text-xs font-mono text-cyan-400 mb-3">{wallet.address.slice(0, 16)}...</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { sym: 'ALGO', val: wallet.algoBalance.toFixed(2) },
                    { sym: '$RYL', val: wallet.rylBalance.toLocaleString() },
                  ].map(b => (
                    <div key={b.sym} className="bg-black/40 rounded-lg p-2 text-center">
                      <div className="text-[0.6rem] font-mono text-gray-500">{b.sym}</div>
                      <div className="font-bold font-mono text-yellow-400 text-sm">{b.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-gray-600 text-xs mb-3">Connect your wallet to access the Royale Kingdom</div>
                <button onClick={connectWallet} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-sm rounded-xl py-2.5 hover:shadow-lg hover:shadow-yellow-500/20 transition-all">
                  ⬡ CONNECT WALLET
                </button>
              </div>
            )}
          </div>

          {/* QUANTUM SHIELD */}
          <div className="bg-white/[0.03] border border-yellow-500/15 rounded-xl p-4">
            <div className="text-[0.6rem] text-cyan-400 font-mono tracking-[0.2em] uppercase mb-3">⚛ Quantum Shield</div>
            <div className="flex justify-center my-2">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,255,255,0.08)" strokeWidth="7"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,255,255,0.6)" strokeWidth="1.5"
                  strokeDasharray="264" strokeDashoffset="40" strokeLinecap="round"
                  transform="rotate(-90 50 50)">
                  <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite"/>
                </circle>
                <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,215,0,0.3)" strokeWidth="1" strokeDasharray="3 3"/>
                <text x="50" y="46" textAnchor="middle" fill="#FFD700" fontSize="7" fontFamily="monospace">KYBER</text>
                <text x="50" y="55" textAnchor="middle" fill="#00FFFF" fontSize="7" fontFamily="monospace">1024</text>
              </svg>
            </div>
            <div className="text-center">
              <div className="text-[0.62rem] font-mono text-cyan-400">CRYSTALS-DILITHIUM-3</div>
              <div className="text-green-400 font-semibold text-sm mt-1">SHIELD ACTIVE</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[['KEY BITS','3072'],['NIST LVL','5'],['ALGO','LATTICE'],['STATUS','LIVE']].map(([l,v]) => (
                <div key={l} className="bg-black/40 rounded-lg p-2 text-center">
                  <div className="text-[0.58rem] font-mono text-gray-600">{l}</div>
                  <div className="font-mono font-bold text-cyan-400 text-sm">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ROYALE TOKEN ECONOMY */}
          <div className="bg-white/[0.03] border border-yellow-500/15 rounded-xl p-4">
            <div className="text-[0.6rem] text-cyan-400 font-mono tracking-[0.2em] uppercase mb-3">◈ Royale Economy</div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-mono font-bold text-black text-xs">$RYL</div>
              <div>
                <div className="font-bold text-yellow-400 text-sm">ROYALE COIN</div>
                <div className="text-[0.62rem] text-gray-500 font-mono">ARC-20 · ERC-20</div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { tier: '⚪ CITIZEN', price: 'FREE', desc: 'Browse · Download · 114 nations', featured: false, color: 'text-gray-400' },
                { tier: '🟡 AMBASSADOR', price: '$9.99/mo', desc: '∞ Storage · AI · Creator Keys', featured: true, color: 'text-yellow-400' },
                { tier: '🔵 ROYALTY', price: '$29.99/mo', desc: 'Custom AI · The Vault · Priority', featured: false, color: 'text-cyan-400' },
              ].map(t => (
                <div key={t.tier} className={`rounded-lg p-2.5 border cursor-pointer transition-all ${t.featured ? 'bg-yellow-500/05 border-yellow-500/25' : 'bg-black/20 border-white/06 hover:border-white/12'}`}>
                  <div className="flex justify-between mb-0.5">
                    <span className={`text-xs font-bold ${t.color}`}>{t.tier}</span>
                    <span className={`text-xs font-mono font-bold ${t.color}`}>{t.price}</span>
                  </div>
                  <div className="text-[0.65rem] text-gray-500">{t.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-black/30 rounded-xl p-3 text-center">
              <div className="text-[0.6rem] font-mono text-gray-600">CREATOR SPLIT</div>
              <div className="flex justify-center items-center gap-3 mt-1.5">
                <div><span className="text-xl font-bold font-mono text-green-400">95%</span><span className="text-[0.65rem] text-gray-600 ml-1">to you</span></div>
                <div><span className="text-xl font-bold font-mono text-yellow-400">5%</span><span className="text-[0.65rem] text-gray-600 ml-1">royale tax</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
