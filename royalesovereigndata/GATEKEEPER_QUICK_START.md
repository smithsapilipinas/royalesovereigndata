# Royale Spiritual Gatekeeper - Quick Start Guide

## 🎤 How to Use Voice Pledge

### Step 1: Click "Speak to Create"
Located in the **Command Center** section, the yellow button with the microphone icon.

### Step 2: Speak Your Pledge
Say one of these phrases clearly:
- **"Yeshua is King"**
- **"Jesus is King"**

The system is flexible with:
- Capitalization (works with any case)
- Punctuation (periods, exclamation marks, etc.)
- Background noise (Web Speech API is robust)

### Step 3: See Your Transcript
Your spoken words appear in real-time in the text field below the button.

### Step 4: Gate Opens Automatically
Once a valid pledge is detected:
- 🟢 Shield icon turns green
- 🎙️ System speaks: **"Kvon Royale. Access opened."**
- ✅ Text shows "Gate Open"
- 📝 Console logs: "Voice pledge accepted - access opened"

---

## 📁 How to Upload Files

### Single File Upload
1. Click in the **Drop Zone** area
2. Select a file from your computer
3. Watch the progress bar as it:
   - Applies quantum signature (Dilithium-3)
   - Pins to IPFS via Pinata
   - Indexes in Gun.js

### ZIP Archive Upload
1. Prepare a `.zip` file with your content
2. Drag & drop into the Drop Zone OR click to select
3. System automatically:
   - Unpacks the ZIP on your browser
   - Filters out system files (`__MACOSX`, `.DS_Store`, `Thumbs.db`)
   - Creates an upload for each file
   - Tracks the source ZIP and original path

### Supported File Types
- **Audio**: `MP3`, `WAV`, `FLAC`
- **Video**: `MP4`, `MOV`
- **Documents**: `PDF`, `TXT`, `MD`, `JSON`, `HTML`, `CSV`
- **Images**: `JPG`, `JPEG`, `PNG`, `GIF`
- **Archives**: `ZIP`

---

## 🛡️ The Gate System

### What It Protects
The gate prevents:
- ❌ File uploads without pledge
- ❌ Command deployment without pledge
- ❌ Script generation without pledge
- ❌ Content creation without pledge

### Why It Matters
The voice pledge ensures:
✅ Creator intentionality
✅ Conscious engagement
✅ Spiritual alignment
✅ Community values alignment

### If Gate is Closed
You'll see:
- 🟡 Yellow shield icon with "Voice Pledge Required"
- ⚠️ Error message: "Speak the pledge first"
- 📝 Console shows gate rejection

---

## 🎙️ The Royal Voice System

### What You'll Hear
After successful pledge verification, the system speaks:

**"Kvon Royale. Access opened."**

### Voice Characteristics
- Speed: Natural human speech (0.95 rate)
- Pitch: Neutral (no distortion)
- Volume: Full (100%)
- Timing: Immediate (within 100ms)

### Browser Speaker Requirements
- Must have speakers/headphones connected
- System volume should be audible
- Works with any system language
- Uses native browser Text-to-Speech

---

## ✨ The Sovereign Confirmation

### What You'll See
After successful upload, this message appears prominently:

**"stepintoroyale - Glory be to God"**

### Appearance
- 📍 Positioned: Top of screen, center-aligned
- 🎨 Style: Gold text on dark background with glow effect
- ⏱️ Duration: Displays for 8 seconds then auto-hides
- 🎬 Animation: Smooth fade-in and fade-out

### When It Appears
- ✅ After file upload completes
- ✅ After script generation succeeds
- ✅ After command deployment succeeds

---

## 📊 Console Logging

Watch the **Console Log** panel to see:

```
[HH:MM:SS] ✓ Royale Sovereign Node initialized
[HH:MM:SS] ⟳ Gun.js peer network syncing...
[HH:MM:SS] ✓ CRYSTALS-Kyber-1024 key pair generated
[HH:MM:SS] ✓ Dilithium-3 signing key ready
[HH:MM:SS] ⟳ Listening for the voice pledge...
[HH:MM:SS] ✓ Voice pledge accepted - access opened
[HH:MM:SS] ⟳ File received: document.pdf (245.3 KB)
[HH:MM:SS] ✓ IPFS CID: Qm7a9b8c7d6e5f4g3h2i1j0k9l8m7n6o5p
[HH:MM:SS] ✓ Gun.js record created — decentralized index updated
[HH:MM:SS] ✓ Quantum sig: a1b2c3d4e5f6...
[HH:MM:SS] ◈ document.pdf is now in the Ark forever
```

---

## 🚀 Upload Pipeline

See real-time progress as content flows through:

1. **COMMAND** ○ → ⟳ → ✓
   - Command validation
   
2. **CREATION** ○ → ⟳ → ✓
   - AI metadata generation (if Ollama available)
   
3. **DROP ZONE** ○ → ⟳ → ✓
   - File staging and preparation
   
4. **IPFS ASCENT** ○ → ⟳ → ✓
   - Quantum signature application
   - Pinata upload
   - CID generation
   
5. **ETHER** ○ → ⟳ → ✓
   - Gun.js indexing
   - Blockchain integration (if wallet connected)
   - Peer synchronization

---

## 🔐 Security Details

### Voice Pledge Validation
```
User speaks: "Yeshua is King"
    ↓
System normalizes: "yeshua is king"
    ↓
Checks against: ["yeshua is king", "jesus is king"]
    ↓
Match found? ✓ Gate opens
```

### Quantum Signatures
Every upload is signed with **Dilithium-3** (NIST PQC Level 5):
- Post-quantum cryptography
- 2^64 theoretical security
- SHA3-256 content hash
- Timestamp + creator included in signature

### Server-Side Validation
The API double-checks:
1. Pledge transcript provided
2. Valid pledge phrase detected
3. File not exceeding 500MB
4. Content hash verified
5. Signature applied before IPFS upload

---

## 💡 Tips & Tricks

### If Speech Recognition Isn't Working
1. Check browser: Chrome, Edge, Firefox, Safari all supported
2. Check microphone: Ensure mic is connected and enabled
3. Check permissions: Browser must have microphone access granted
4. Check speaker mode: Try speaking slowly and clearly
5. Check internet: Speech Recognition requires internet connection

### If ZIP Upload Fails
1. Ensure ZIP is not corrupted
2. Check total size < 500MB (unpacked)
3. Verify ZIP contains files (not empty)
4. Try extracting manually and uploading files individually
5. Check that all filenames are valid (no special characters)

### If Upload Is Slow
1. Normal for large files (>100MB)
2. Quantum signatures take ~500ms per file
3. IPFS pinning depends on network speed
4. Gun.js sync can take 1-3 seconds
5. Watch progress bar and logs for status

### Optimal Workflow
```
1. Open page (node initializes)
2. Click "Speak to Create" immediately
3. Speak pledge while mic is ready
4. Wait for "Access opened" message
5. Prepare files while gate is open
6. Upload files (single or ZIP)
7. Watch confirmation message appear
```

---

## 🎯 Common Scenarios

### Scenario: Upload Multiple Files
```
1. Compress files into royale_content.zip
2. Drag into Drop Zone
3. System unpacks and uploads each file separately
4. See "stepintoroyale - Glory be to God" after each upload
5. All files indexed in Gun.js as separate entries
```

### Scenario: Create + Upload Combined
```
1. Speak pledge to open gate
2. Enter command in Command Center
3. Click "DEPLOY TO ARK"
4. System creates metadata + IPFS entry
5. See sovereign confirmation message
```

### Scenario: Re-authenticate Needed
```
Gate closes when:
- Page is refreshed
- Session times out
- Browser is closed

Simply click "Speak to Create" again to re-authenticate
```

---

## 🌍 Blockchain Integration (Optional)

If wallet is connected:
- ALGO balance shown in header
- Transaction logged to Algorand blockchain
- ETH/Solana integration available
- Multi-chain support

---

## 📚 API Reference

### Upload Endpoint
```
POST /api/royale/upload

Body (FormData):
- file: File
- command: string
- pledgeTranscript: string
- walletAddress: string
- creatorAlias: string
- priceMicro: number
- currency: string

Response:
{
  "success": true,
  "content": { ... },
  "ipfs": {
    "cid": "Qm...",
    "gatewayUrl": "https://gateway.pinata.cloud/ipfs/Qm...",
    "size": 1234567,
    "manifestCid": "Qm...",
    "manifestUrl": "..."
  },
  "quantum": {
    "algorithm": "ML-DSA-65 (CRYSTALS-Dilithium-3)",
    "nistLevel": 5,
    "signatureHex": "a1b2c3d4...",
    "contentHash": "..."
  },
  "sovereignConfirmation": "stepintoroyale - Glory be to God",
  "gate": { "accepted": true }
}
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Microphone not detected | Check browser permissions, try different browser |
| Voice not recognized | Speak clearly, say phrase exactly (or with variations) |
| Upload fails | Check file size < 500MB, verify pledge was spoken |
| No confirmation message | Check if upload actually succeeded in logs |
| ZIP unpacking fails | Ensure ZIP is not corrupted, file count > 0 |
| Gate won't open | Ensure speech recognition is enabled, try again |

---

## 📞 Support Resources

- Console logs show all activity with timestamps
- Hover over icons for tooltips
- Colors indicate status:
  - 🟢 Green = Success/Open
  - 🟡 Yellow = Warning/Pending
  - 🔴 Red = Error/Closed
  - 🔵 Cyan = Info/Processing

**Status: ✅ Fully Functional**
