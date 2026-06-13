# Training Guide — FishingLog.ai

## Overview

FishingLog.ai learns from the captain and crew to improve species classification accuracy. The training pipeline collects corrections, validates them, and fine-tunes the edge model.

## How Corrections Work

### Voice Corrections
The captain corrects classifications using natural voice commands:

- **"That was a coho"** — Corrects the last classification
- **"Actually a king salmon"** — Correction with emphasis
- **"This is a yellowtail rockfish, not vermilion"** — Detailed correction

Each correction captures:
- The original image
- The wrong classification
- The correct species
- GPS location, depth, water temperature
- Audio recording of the correction

### Crew Corrections
Crew can acknowledge or reject alerts on the tablet:
1. Alert appears: "Species mismatch: AI says king, crew sorted as coho"
2. Crew taps "Correct" or "AI was right"
3. Correction feeds into training pipeline

### Cloud Validation
When connected, the cloud model validates edge classifications:
- Edge and cloud agree → strengthens confidence
- Edge and cloud disagree → queued for captain review
- Cloud identifies unknown species → added to training queue

## Training Pipeline

```
[Captain Correction] → Ground Truth Label
[Cloud Validation]   → Ground Truth Label
[Crew Correction]    → Ground Truth Label
        ↓
[Replay Buffer] — Prevents catastrophic forgetting
        ↓
[Format for Training] — (image, wrong_label, correct_label)
        ↓
[Fine-tune Edge Model] — On cloud infrastructure
        ↓
[Validate on Held-out Set]
        ↓
[Deploy OTA Update] — If accuracy improved
```

## Viewing Training Data

### Via API
```bash
# Training status
curl http://localhost:3000/api/training/status

# Ground truth stats
curl http://localhost:3000/api/training/stats
```

### Via Files
Training data is stored in `cocapn/training-data.json`:

```json
{
  "labels": [
    {
      "id": "...",
      "imageHash": "abc123...",
      "species": "king_salmon",
      "source": "captain_voice",
      "confidence": 1.0,
      "timestamp": "2026-03-31T10:30:00Z",
      "validated": true
    }
  ]
}
```

## Best Practices for Training

### 1. Correct Early and Often
The more corrections you make in the first week, the faster the model adapts to your vessel's specific catch.

### 2. Correct in Good Conditions
Make corrections when fish are clearly visible (good lighting, clean table). Poor-condition corrections confuse the model.

### 3. Verify Critical Corrections
The system validates captain corrections against cloud models. If there's disagreement, you'll be asked to confirm.

### 4. Seasonal Retraining
At the start of each season:
- Review accuracy trends per species
- Request a model refresh
- Spend the first week actively correcting

## Confidence Thresholds

| Level | Range | Behavior |
|-------|-------|----------|
| Confident | ≥ 70% | Auto-classify, log the catch |
| Uncertain | 50-70% | Ask captain to confirm |
| Low | < 50% | Flag for review, don't classify |

## Monitoring Accuracy

```bash
# Per-species accuracy
curl http://localhost:3000/api/training/accuracy

# Confidence trends
curl http://localhost:3000/api/training/trends
```

Watch for:
- **Declining trends** — Model needs retraining for that species
- **Low-confidence species** — Collect more training samples
- **Frequent mismatches** — Check camera calibration

## Privacy

- All training data belongs to the vessel
- Faces are automatically blurred in cloud uploads
- Captain can delete all training data at any time
- No data leaves the vessel without explicit permission
