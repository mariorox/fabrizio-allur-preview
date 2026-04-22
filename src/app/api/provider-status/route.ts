import { NextResponse } from 'next/server';
import https from 'https';

interface ProviderStatus {
  provider: string;
  label: string;
  hasKey: boolean;
  keyValid: boolean | null; // null = não verificado
  models?: string[];
  credits?: { total: number; subscription: number; on_demand: number };
  balance?: { usd: string };
  dashboardUrl?: string;
}

export async function GET() {
  const provider = process.env.AI_PROVIDER ?? 'mock';
  const apiKey = process.env.AI_API_KEY ?? '';

  let status: ProviderStatus;

  switch (provider) {
    case 'gemini':
      status = await checkGemini(apiKey);
      break;
    case 'fashn':
      status = await checkFashn(apiKey);
      break;
    case 'replicate':
      status = await checkReplicate(apiKey);
      break;
    case 'huggingface':
      status = {
        provider: 'huggingface',
        label: 'HuggingFace IDM-VTON',
        hasKey: !!apiKey,
        keyValid: true,
        models: ['IDM-VTON (Space público)'],
        dashboardUrl: 'https://huggingface.co/settings/tokens',
      };
      break;
    case 'mock':
    default:
      status = {
        provider: 'mock',
        label: 'Simulação Local',
        hasKey: false,
        keyValid: true,
        models: ['Sharp (composição local)'],
      };
      break;
  }

  return NextResponse.json(status);
}

// ── Gemini: ping rápido com generateContent mínimo ──
async function checkGemini(apiKey: string): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    provider: 'gemini',
    label: 'Google Gemini',
    hasKey: !!apiKey,
    keyValid: null,
    models: ['gemini-2.5-flash', 'gemini-3.1-flash-image-preview'],
    dashboardUrl: 'https://aistudio.google.com/apikey',
  };

  if (!apiKey) return base;

  try {
    const valid = await new Promise<boolean>((resolve) => {
      const body = JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });

      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(res.statusCode === 200));
      });

      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.write(body);
      req.end();
    });

    base.keyValid = valid;
  } catch {
    base.keyValid = false;
  }

  return base;
}

// ── Fashn.ai: endpoint dedicado de créditos ──
async function checkFashn(apiKey: string): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    provider: 'fashn',
    label: 'Fashn.ai',
    hasKey: !!apiKey,
    keyValid: null,
    models: ['Fashn Virtual Try-On'],
    dashboardUrl: 'https://app.fashn.ai/billing',
  };

  if (!apiKey) return base;

  try {
    const result = await new Promise<{ credits?: { total: number; subscription: number; on_demand: number } }>((resolve) => {
      const req = https.request({
        hostname: 'api.fashn.ai',
        path: '/utility-endpoints/credits',
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(data)); } catch { resolve({}); }
          } else {
            resolve({});
          }
        });
      });

      req.setTimeout(8000, () => { req.destroy(); resolve({}); });
      req.on('error', () => resolve({}));
      req.end();
    });

    base.keyValid = !!result.credits;
    if (result.credits) base.credits = result.credits;
  } catch {
    base.keyValid = false;
  }

  return base;
}

// ── Replicate: endpoint de conta ──
async function checkReplicate(apiKey: string): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    provider: 'replicate',
    label: 'Replicate',
    hasKey: !!apiKey,
    keyValid: null,
    models: ['IDM-VTON (cuuupid/idm-vton)'],
    dashboardUrl: 'https://replicate.com/account/billing',
  };

  if (!apiKey) return base;

  try {
    const valid = await new Promise<boolean>((resolve) => {
      const req = https.request({
        hostname: 'api.replicate.com',
        path: '/v1/account',
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(res.statusCode === 200));
      });

      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    });

    base.keyValid = valid;
  } catch {
    base.keyValid = false;
  }

  return base;
}
