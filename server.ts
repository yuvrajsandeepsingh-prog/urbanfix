import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CATEGORIES = [
  'Roads',
  'Waste Management',
  'Drainage',
  'Water Supply',
  'Streetlights'
] as const;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

const GEMINI_TEXT_MODEL = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI | null {
  const rawKey = process.env.GEMINI_API_KEY?.trim();
  if (!rawKey || rawKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

function scrubPotentialPii(text: unknown, maxLen = 1200): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, '[redacted-phone]')
    .trim()
    .slice(0, maxLen);
}

function isAllowedCategory(val: unknown): val is AllowedCategory {
  return (
    typeof val === 'string' &&
    (ALLOWED_CATEGORIES as readonly string[]).includes(val)
  );
}

interface FactorPayloadItem {
  label: string;
  awardedPoints: number;
  maxPoints: number;
  available: boolean;
  evidenceSummary: string;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '256kb' }));

  // ---------------------------------------------------------------------------
  // Server-Side Admin AI Status Check (Never exposes API key)
  // ---------------------------------------------------------------------------
  app.get('/api/admin/ai/status', (_req: Request, res: Response) => {
    const client = getGeminiClient();
    res.json({
      available: Boolean(client),
      model: client ? GEMINI_TEXT_MODEL : null
    });
  });

  // ---------------------------------------------------------------------------
  // Server-Side Admin Complaint Analysis (Summary + Category + Priority Narrative)
  // ---------------------------------------------------------------------------
  app.post('/api/admin/ai/analyze-complaint', async (req: Request, res: Response) => {
    const client = getGeminiClient();
    if (!client) {
      res.status(503).json({
        ok: false,
        error: 'Server-side Gemini API key is not configured. Using deterministic fallback.'
      });
      return;
    }

    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const referenceNumber = scrubPotentialPii(body.referenceNumber, 40) || 'UF-RECORD';
      const currentCategory: AllowedCategory = isAllowedCategory(body.category)
        ? body.category
        : 'Roads';
      const title = scrubPotentialPii(body.title, 240);
      const description = scrubPotentialPii(body.description, 1200);
      const locality = scrubPotentialPii(body.locality, 200);
      const landmark = scrubPotentialPii(body.landmark, 200);
      const status = scrubPotentialPii(body.status, 40);
      const recordedSeverity = scrubPotentialPii(body.recordedSeverity, 40) || 'Not explicitly set';
      const hasFieldPhoto = Boolean(body.hasFieldPhoto);
      const hasStreetLevelPin = Boolean(body.hasStreetLevelPin);
      const computedScore =
        typeof body.computedScore === 'number' && Number.isFinite(body.computedScore)
          ? Math.max(0, Math.min(100, Math.round(body.computedScore)))
          : 50;
      const computedLevel = scrubPotentialPii(body.computedLevel, 24) || 'Medium';

      const rawFactors = Array.isArray(body.factors) ? body.factors : [];
      const factors: FactorPayloadItem[] = rawFactors.slice(0, 8).map((f: unknown) => {
        const item = (f || {}) as Record<string, unknown>;
        return {
          label: scrubPotentialPii(item.label, 80),
          awardedPoints: Number(item.awardedPoints) || 0,
          maxPoints: Number(item.maxPoints) || 0,
          available: Boolean(item.available),
          evidenceSummary: scrubPotentialPii(item.evidenceSummary, 220)
        };
      });

      const missingEvidence = Array.isArray(body.missingEvidence)
        ? body.missingEvidence.slice(0, 6).map((m) => scrubPotentialPii(m, 160)).filter(Boolean)
        : [];

      if (!title && !description) {
        res.status(400).json({ ok: false, error: 'Complaint title or description is required.' });
        return;
      }

      const factorLines = factors
        .map(
          (f) =>
            `- ${f.label}: ${
              f.available ? `${f.awardedPoints}/${f.maxPoints} pts` : 'Unavailable (excluded from denominator)'
            } — ${f.evidenceSummary}`
        )
        .join('\n');

      const prompt = [
        `Analyze this municipal civic service complaint strictly using ONLY the recorded fields below.`,
        ``,
        `COMPLAINT RECORD (${referenceNumber}):`,
        `- Recorded Category: ${currentCategory}`,
        `- Current Lifecycle Status: ${status}`,
        `- Citizen Recorded Severity: ${recordedSeverity}`,
        `- Title: ${title}`,
        `- Description: ${description}`,
        `- Locality / Ward: ${locality}`,
        `- Nearby Landmark: ${landmark}`,
        `- Field Photograph Attached: ${hasFieldPhoto ? 'Yes' : 'No'}`,
        `- Street-Level Coordinate Pin Available: ${hasStreetLevelPin ? 'Yes' : 'No'}`,
        ``,
        `DETERMINISTIC PRIORITY ENGINE OUTPUT (DO NOT CHANGE THIS NUMERIC SCORE):`,
        `- Final Score: ${computedScore}/100 (${computedLevel})`,
        `Factor Breakdown:`,
        factorLines || '- Standard triage evaluation',
        `Missing / Incomplete Context: ${
          missingEvidence.length > 0 ? missingEvidence.join('; ') : 'None flagged'
        }`
      ].join('\n');

      const response = await client.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: {
          temperature: 0.15,
          systemInstruction:
            'You are an explainable municipal operations triage assistant for UrbanFix. ' +
            'STRICT RULES: ' +
            '1) Never invent facts, dimensions, casualties, traffic counts, sensor data, or dispatch actions not explicitly present in the provided complaint record. ' +
            '2) For categorization, select suggestedCategory strictly from: "Roads", "Waste Management", "Drainage", "Water Supply", "Streetlights". Base rationale strictly on terms in Title and Description. Never output fake confidence percentages. ' +
            '3) For priorityNarrative, explain why the complaint received its exact deterministic score using ONLY the provided Factor Breakdown and Missing Context. Never propose a different score. ' +
            '4) Keep every field concise, factual, and administrative in tone.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.OBJECT,
                properties: {
                  mainProblem: {
                    type: Type.STRING,
                    description: 'One concise sentence stating the core reported defect.'
                  },
                  potentialImpact: {
                    type: Type.STRING,
                    description:
                      'One concise sentence describing potential public impact strictly supported by the complaint text and location.'
                  },
                  importantDetails: {
                    type: Type.STRING,
                    description:
                      'Specific landmarks, duration, or physical details mentioned in the complaint.'
                  },
                  missingInformation: {
                    type: Type.STRING,
                    description:
                      'Missing verification context (such as no field photo, missing exact pin, or unconfirmed field inspection), or "No critical intake fields missing" if complete.'
                  }
                },
                required: [
                  'mainProblem',
                  'potentialImpact',
                  'importantDetails',
                  'missingInformation'
                ]
              },
              categorization: {
                type: Type.OBJECT,
                properties: {
                  suggestedCategory: {
                    type: Type.STRING,
                    description:
                      'Must be exactly one of: Roads, Waste Management, Drainage, Water Supply, Streetlights.'
                  },
                  rationale: {
                    type: Type.STRING,
                    description:
                      'Plain-language explanation citing specific words in the complaint without numeric confidence percentages.'
                  }
                },
                required: ['suggestedCategory', 'rationale']
              },
              priorityNarrative: {
                type: Type.STRING,
                description:
                  '2-sentence natural-language explanation of the deterministic priority score grounded strictly in the provided factor points.'
              }
            },
            required: ['summary', 'categorization', 'priorityNarrative']
          }
        }
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini model.');
      }

      const parsed = JSON.parse(rawText) as {
        summary?: {
          mainProblem?: string;
          potentialImpact?: string;
          importantDetails?: string;
          missingInformation?: string;
        };
        categorization?: {
          suggestedCategory?: string;
          rationale?: string;
        };
        priorityNarrative?: string;
      };

      const safeCategory: AllowedCategory = isAllowedCategory(
        parsed.categorization?.suggestedCategory
      )
        ? parsed.categorization.suggestedCategory
        : currentCategory;

      res.json({
        ok: true,
        model: GEMINI_TEXT_MODEL,
        analysis: {
          summary: {
            mainProblem: scrubPotentialPii(parsed.summary?.mainProblem, 320),
            potentialImpact: scrubPotentialPii(parsed.summary?.potentialImpact, 320),
            importantDetails: scrubPotentialPii(parsed.summary?.importantDetails, 320),
            missingInformation: scrubPotentialPii(parsed.summary?.missingInformation, 320)
          },
          categorization: {
            suggestedCategory: safeCategory,
            rationale: scrubPotentialPii(parsed.categorization?.rationale, 360)
          },
          priorityNarrative: scrubPotentialPii(parsed.priorityNarrative, 460)
        }
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete Gemini complaint analysis.';
      res.status(502).json({
        ok: false,
        error: message
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Server-Side Daily Operations Brief (Aggregated PII-Free Operational Metrics)
  // ---------------------------------------------------------------------------
  app.post('/api/admin/ai/daily-brief', async (req: Request, res: Response) => {
    const client = getGeminiClient();
    if (!client) {
      res.status(503).json({
        ok: false,
        error: 'Server-side Gemini API key is not configured. Using deterministic fallback.'
      });
      return;
    }

    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const snapshotJson = JSON.stringify({
        isDemoMode: Boolean(body.isDemoMode),
        totalComplaints: Number(body.totalComplaints) || 0,
        pendingSubmitted: Number(body.pendingCount) || 0,
        inProgress: Number(body.inProgressCount) || 0,
        resolved: Number(body.resolvedCount) || 0,
        reopened: Number(body.reopenedCount) || 0,
        criticalPriorityUnresolved: Number(body.criticalCount) || 0,
        highPriorityUnresolved: Number(body.highCount) || 0,
        overdueSlaUnresolved: Number(body.overdueSlaCount) || 0,
        unassignedCount: Number(body.unassignedCount) || 0,
        categoryBreakdown: Array.isArray(body.categoryBreakdown)
          ? body.categoryBreakdown.slice(0, 6)
          : [],
        localityHotspots: Array.isArray(body.localityHotspots)
          ? body.localityHotspots.slice(0, 6)
          : [],
        topUrgentQueueItems: Array.isArray(body.topUrgentItems)
          ? body.topUrgentItems.slice(0, 6)
          : []
      });

      const response = await client.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: `Generate a concise municipal Daily Operations Brief from this exact dataset snapshot:\n${snapshotJson}`,
        config: {
          temperature: 0.15,
          systemInstruction:
            'You are a municipal control-room briefing assistant for UrbanFix. ' +
            'Strictly separate recorded operational facts from suggested administrative follow-up actions. ' +
            'Use ONLY the numbers, reference IDs, categories, and localities provided in the snapshot. ' +
            'Never invent external weather alerts, unrecorded budgets, or field crew headcounts. ' +
            'If isDemoMode is true, acknowledge that figures reflect the demonstration civic dataset.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recordedFactsSummary: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '3 concise bullet statements reporting exact recorded queue totals, SLA breaches, and category counts.'
              },
              hotspotObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '2-3 concise bullet statements highlighting localities and categories with concentrated unresolved or high-priority reports.'
              },
              suggestedFollowUpActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '3 actionable administrative review or dispatch steps clearly phrased as suggested follow-ups referencing specific queue items or departments.'
              }
            },
            required: [
              'recordedFactsSummary',
              'hotspotObservations',
              'suggestedFollowUpActions'
            ]
          }
        }
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini model.');
      }

      const parsed = JSON.parse(rawText) as {
        recordedFactsSummary?: string[];
        hotspotObservations?: string[];
        suggestedFollowUpActions?: string[];
      };

      res.json({
        ok: true,
        model: GEMINI_TEXT_MODEL,
        brief: {
          recordedFactsSummary: (parsed.recordedFactsSummary || [])
            .slice(0, 4)
            .map((s) => scrubPotentialPii(s, 280))
            .filter(Boolean),
          hotspotObservations: (parsed.hotspotObservations || [])
            .slice(0, 4)
            .map((s) => scrubPotentialPii(s, 280))
            .filter(Boolean),
          suggestedFollowUpActions: (parsed.suggestedFollowUpActions || [])
            .slice(0, 4)
            .map((s) => scrubPotentialPii(s, 280))
            .filter(Boolean)
        }
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to generate Gemini daily brief.';
      res.status(502).json({
        ok: false,
        error: message
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Frontend Serving: Vite Middleware in Development, Static dist/ in Production
  // ---------------------------------------------------------------------------
  const distPath = path.resolve(__dirname, 'dist');
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    (process.env.NODE_ENV !== 'production' && !fs.existsSync(path.join(distPath, 'index.html')));

  if (isDevelopment) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '1y'
      })
    );
    app.use(express.static(distPath, { index: false }));

    // Never return index.html for missing static asset requests
    app.use(['/assets', '/src'], (_req: Request, res: Response) => {
      res.status(404).end();
    });

    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UrbanFix server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
