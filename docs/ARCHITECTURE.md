# Architecture — FishingLog.ai

## System Overview

FishingLog.ai is an **edge AI system for commercial fishing vessels**. It watches every fish that crosses the sorting table, learns from the captain's corrections, alerts on species mismatches, and generates regulatory catch reports — all running locally on a Jetson Orin Nano.

**Core Philosophy**: "AI as First Mate" — always assists, never autonomously decides. All critical decisions remain with the captain.

## Component Architecture

### Vision Pipeline

```
[Camera Stream] → (Jetson: Frame Selection @ 2Hz)
                → Local YOLOv8-nano (FP16) → [Detections]
                → Async Upload → Cloud → Ensemble → [Validated Labels]
```

**Dual-Model Architecture**:

| Model | Runs On | Species | Speed | When |
|-------|---------|---------|-------|------|
| Edge (YOLOv8-nano FP16) | Jetson Orin | 25 common species | 15 FPS | Always |
| Cloud (ResNet50 + ViT) | Cloudflare AI | 300+ species | 2 FPS async | When connected |

**Failure Modes**:
- Salt occlusion → Camera wash system + daily calibration
- Low light → IR illuminators auto-trigger
- Edge model drift → Weekly cloud validation

### Captain Voice Interface

```
[Headset Mic] → Noise Suppression (RNNoise) → Wake Word ("Hey Cap")
              → Local Whisper-tiny → Intent Recognition → Action
```

**Intent Types**: `label`, `correct`, `query`, `question`, `report`, `navigate`

### Alert System

Three priority levels:
- **CRITICAL**: Bycatch of protected species, species mismatches
- **OPERATIONAL**: Quota approaching, weather changes
- **INFORMATIONAL**: Price changes, new fishing data

### Catch Reporting

```
[Vision Detection] + [Voice Confirmation] → Catch Record
→ Local SQLite + JSON backup
→ Auto-sync when connected
→ Regulatory format conversion (ADFG, NOAA eVTR)
```

### Multi-Vessel Coordination

VHF data exchange for nearby vessels + cloud-synced fleet intelligence. Privacy controls: captain selects sharing level.

## Data Flow

```
Local (Jetson):
  SQLite + 30-day rolling storage → Async upload queue

Cloud (Cloudflare Workers):
  KV: Vessel memory, config
  R2: Raw images
  D1: Catch records
  Workers AI: Classification, transcription

Sync Protocol:
  Priority: Alerts > Corrections > Catch data > Images
  Differential sync, resume broken transfers
```

## Deployment

| Mode | Where | Features |
|------|-------|----------|
| **Edge** | Jetson Orin Nano | Full: vision, voice, logging, alerts |
| **Cloud** | Cloudflare Workers | Enhanced models, fleet sync, reporting |
| **Hybrid** | Edge + Cloud | Best of both, seamless offline fallback |

## Captain UX Principles

1. Voice-first, not voice-only — physical buttons for critical functions
2. Confirm, don't assume — always seek confirmation for uncertain classifications
3. Progressive disclosure — advanced features unlock over time
4. Maritime idioms — fishing terminology, not AI jargon
5. Glove-compatible — large touch targets, high contrast
