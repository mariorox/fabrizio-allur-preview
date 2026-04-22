/**
 * Google Gemini Adapter — 3 etapas (pipeline híbrido):
 *   1. gemini-2.5-flash (visão): descreve o tecido em detalhes
 *   2. gemini-3.1-flash-image-preview (edição): gera preview com roupa trocada (para sombras/dobras)
 *   3. gemini-3.1-flash-image-preview (máscara): pinta a roupa de verde para segmentação
 *   4. Sharp (texture-mapper): aplica a textura REAL sobre a foto original usando a máscara
 *      e as sombras extraídas do resultado da IA — padrão pixel-perfect
 *
 * O sistema monta os prompts automaticamente — o operador não digita nada.
 *
 * Setup:
 *   AI_PROVIDER=gemini
 *   AI_API_KEY=AIzaSy...   ← chave do Google AI Studio (aistudio.google.com/apikey)
 */
import fs from 'fs';
import https from 'https';
import sharp from 'sharp';
import type { AIAdapter, TryOnParams, TryOnResult } from './adapter';
import type { GarmentType } from '@/types';

const GEMINI_HOST  = 'generativelanguage.googleapis.com';
const VISION_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL  = 'gemini-3.1-flash-image-preview';

const GARMENT_EN: Record<GarmentType, string> = {
  terno:  'a suit JACKET and TROUSERS ONLY (do NOT touch the shirt/undershirt underneath)',
  blazer: 'a blazer jacket ONLY (do NOT touch the shirt underneath)',
  camisa: 'a dress shirt ONLY',
  polo:   'a polo shirt ONLY',
  calca:  'dress trousers ONLY',
};

export class GeminiAdapter implements AIAdapter {
  constructor(private apiKey: string) {}

  async generateTryOn(params: TryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, fabricTexturePath, garmentType, outputPath } = params;
    const fabricName = params.fabricName ?? 'selected fabric';

    // ── Etapa 1: descrever o tecido com foco em proporções ──
    console.log('[Gemini] Etapa 1/3: descrevendo tecido...');
    const fabricDescription = await this.describeFabric(fabricTexturePath, fabricName);

    // ── Etapa 2: gerar preview inicial ──
    console.log('[Gemini] Etapa 2/3: gerando preview inicial...');
    const firstPassB64 = await this.editClothing(
      clientPhotoPath,
      fabricTexturePath,
      fabricDescription,
      garmentType,
    );

    // ── Etapa 3: auto-correção — compara resultado com swatch e refina ──
    console.log('[Gemini] Etapa 3/3: refinando — comparando com swatch original...');
    const refinedB64 = await this.refineResult(
      firstPassB64,
      fabricTexturePath,
      garmentType,
    );

    const imageBuffer = Buffer.from(refinedB64, 'base64');
    // Salva no AR nativo que a Gemini devolveu — sem resize, sem padding, sem stretch.
    // O prompt já força a Gemini a preservar o enquadramento da foto original,
    // e o BeforeAfterSlider exibe respeitando o AR nativo da imagem.
    await sharp(imageBuffer).rotate().jpeg({ quality: 92 }).toFile(outputPath);

    console.log('[Gemini] ✅ Resultado refinado salvo');
    return { resultImagePath: outputPath };
  }

  /** Etapa 1 — usa gemini-2.5-flash para descrever o tecido com foco em proporções exatas */
  private async describeFabric(fabricPath: string, fabricName: string): Promise<string> {
    const fabricB64 = fs.readFileSync(fabricPath).toString('base64');
    const mime      = guessMime(fabricPath);

    const body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mime, data: fabricB64 } },
          { text: `Analyze this fabric swatch with EXTREME PRECISION for pattern reproduction. The fabric is called "${fabricName}".

Describe EXACTLY:
1. PATTERN TYPE: (solid, windowpane, glen check, pinstripe, herringbone, houndstooth, plaid, etc.)
2. LINE THICKNESS: Measure how thin/thick the lines are RELATIVE to the spacing. Example: "the lines are extremely thin — about 1/40th of the gap between them" or "the stripes are about 1/10th the width of the solid areas"
3. LINE SPACING: How far apart are the pattern lines? Are they widely spaced (lots of solid area between lines) or closely spaced?
4. COLORS: Exact base color and exact line colors (with undertones)
5. TEXTURE: Weave structure visible? Matte/sheen?
6. CRITICAL RATIO: What percentage of the fabric surface is solid base color vs pattern lines? Example: "95% solid base, 5% thin accent lines" or "70% base, 30% thick stripes"

BE EXTREMELY SPECIFIC about how THIN or THICK the lines are. This is the most important detail.` },
        ],
      }],
    });

    return this.callGeminiText(VISION_MODEL, body);
  }

  /** Etapa 2 — edita a foto real do cliente, trocando APENAS a roupa */
  private async editClothing(
    clientPhotoPath: string,
    fabricTexturePath: string,
    fabricDescription: string,
    garmentType: GarmentType,
  ): Promise<string> {
    const photoB64  = fs.readFileSync(clientPhotoPath).toString('base64');
    const photoMime = guessMime(clientPhotoPath);
    const garment   = GARMENT_EN[garmentType];

    // Ampliar textura 2× para preservar detalhes finos nas linhas
    const fabricBuf = fs.readFileSync(fabricTexturePath);
    const meta = await sharp(fabricBuf).metadata();
    const upscaled = await sharp(fabricBuf)
      .resize(Math.round((meta.width ?? 500) * 2), Math.round((meta.height ?? 500) * 2), {
        kernel: sharp.kernel.lanczos3,
      })
      .jpeg({ quality: 95 })
      .toBuffer();
    const fabricB64  = upscaled.toString('base64');
    const fabricMime = 'image/jpeg';

    console.log('[Gemini] Textura ampliada: %dx%d → %dx%d',
      meta.width, meta.height, Math.round((meta.width ?? 500) * 2), Math.round((meta.height ?? 500) * 2));

    // Prompt com over-correction: pedir linhas MAIS FINAS que o natural
    // (a IA tende a engrossar, então pedimos extra-fino para compensar)
    const prompt = `Edit this photo of a person. Change ONLY their ${garment} to be custom tailored from the EXACT fabric shown in the second image.

ABSOLUTE PRIORITY — PATTERN FIDELITY:
Look very carefully at the fabric swatch (second image). Notice how THIN and DELICATE the pattern lines are.
- The lines in the fabric are EXTREMELY FINE — almost hair-thin
- There is A LOT of solid base color between the lines
- You MUST make the lines on the garment EVEN THINNER than you think they should be
- If you think a line should be 3 pixels wide, make it 1 pixel wide instead
- The most common error is making lines TOO THICK — actively fight this tendency
- The spacing between lines must be WIDE — the base color dominates the fabric
- Match the EXACT colors: base color, primary line color, secondary line color

Detailed fabric analysis: ${fabricDescription}

GARMENT RULES:
- The ${garment} must look naturally tailored on the person's body
- Include realistic draping, folds, shadows, and fabric behavior
- Buttons, lapels, pockets, and seams should look natural

PRESERVATION (DO NOT CHANGE):
- Face, hair, skin tone, body shape, pose, hands — pixel-perfect identical
- Background, floor, shoes, accessories — completely unchanged
- IMPORTANT: Do NOT change the shirt, undershirt, or any clothing UNDERNEATH the ${garment}. If the person is wearing a shirt under a blazer/suit, that shirt must remain EXACTLY as it is in the original photo — same color, same fabric, same appearance
- Only the OUTER ${garment} fabric changes, nothing else

CRITICAL — FRAMING AND DIMENSIONS (HIGHEST PRIORITY):
- The output image MUST have EXACTLY the same dimensions, aspect ratio, framing, crop, and camera angle as the input photo
- Do NOT zoom in, do NOT zoom out, do NOT re-crop, do NOT reframe, do NOT change the composition
- The person must appear at the EXACT same scale, position, and location within the image as in the input photo
- If the input shows the person from head to mid-thigh, the output must show the person from head to mid-thigh — same exact framing
- Every pixel outside the garment (head position, background, borders, margins) must be in the EXACT same location as the input
- The image boundaries must match the input pixel-for-pixel — treat this as an in-place edit, not a regeneration`;

    const body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: photoMime, data: photoB64 } },
          { inline_data: { mime_type: fabricMime, data: fabricB64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return this.callGeminiImage(IMAGE_MODEL, body);
  }

  /** Etapa 3 — auto-correção: compara resultado com swatch e refina */
  private async refineResult(
    firstPassB64: string,
    fabricTexturePath: string,
    garmentType: GarmentType,
  ): Promise<string> {
    const resultMime = 'image/jpeg';
    const garment = GARMENT_EN[garmentType];

    // Ampliar textura 2× para referência de detalhe fino
    const fabricBuf = fs.readFileSync(fabricTexturePath);
    const meta = await sharp(fabricBuf).metadata();
    const upscaled = await sharp(fabricBuf)
      .resize(Math.round((meta.width ?? 500) * 2), Math.round((meta.height ?? 500) * 2), {
        kernel: sharp.kernel.lanczos3,
      })
      .jpeg({ quality: 95 })
      .toBuffer();
    const fabricB64 = upscaled.toString('base64');

    const prompt = `You are a fabric pattern quality inspector. Compare these two images:

IMAGE 1: A photo of a person wearing ${garment}. This was generated by AI.
IMAGE 2: The ORIGINAL fabric swatch that the garment should match.

YOUR TASK: Refine Image 1 so the fabric pattern EXACTLY matches Image 2.

COMMON ERRORS TO FIX:
- Lines/stripes are TOO THICK → make them thinner to match the swatch
- Lines/stripes are TOO BOLD or SATURATED → make them more subtle like the swatch
- Pattern scale is wrong → adjust to match the swatch proportions
- Wrong number of lines or wrong spacing → fix to match swatch exactly
- Colors slightly off → correct to match swatch precisely

WHAT TO KEEP UNCHANGED:
- The person (face, body, pose, hands, skin) — do not alter at all
- The background — keep identical
- The garment SHAPE, draping, folds, shadows — keep the realistic 3D appearance
- CRITICAL: Do NOT change the shirt/undershirt beneath the ${garment}. It must stay exactly as it appears — same color, same fabric. Only the OUTER ${garment} gets refined
- Only refine the fabric PATTERN within the existing garment shape

CRITICAL — FRAMING AND DIMENSIONS (HIGHEST PRIORITY):
- The output image MUST have EXACTLY the same dimensions, aspect ratio, framing, and crop as Image 1
- Do NOT zoom, do NOT reframe, do NOT recompose. The person must stay at the EXACT same scale and position
- Treat this as an in-place pixel edit — every pixel outside the garment must stay in its original location

Output the corrected photo with the refined fabric pattern.`;

    const body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: resultMime, data: firstPassB64 } },
          { inline_data: { mime_type: 'image/jpeg', data: fabricB64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return this.callGeminiImage(IMAGE_MODEL, body);
  }

  /** Gera máscara: pinta a área da roupa de verde sólido (#00FF00) — reservado */
  private async generateMask(
    clientPhotoPath: string,
    garmentType: GarmentType,
  ): Promise<string> {
    const photoB64 = fs.readFileSync(clientPhotoPath).toString('base64');
    const mime = guessMime(clientPhotoPath);
    const garment = GARMENT_EN[garmentType];

    const prompt = `Edit this photo. Paint the entire area of the person's ${garment} with a solid, uniform bright green color (exactly #00FF00).

RULES:
- Fill ONLY the ${garment} area with solid green (#00FF00) — no gradients, no texture, just flat solid green
- Include the FULL garment: all parts of the ${garment} (front, sides, sleeves, collar, lapels, trouser legs if applicable)
- Do NOT paint the shirt/undershirt beneath a blazer or suit jacket — only the outer garment
- Keep EVERYTHING ELSE exactly pixel-perfect identical: face, hair, skin, hands, background, shoes, accessories
- The green area should precisely follow the garment's edges and silhouette
- No feathering or transparency at edges — sharp clean boundary between green and non-green`;

    const body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mime, data: photoB64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return this.callGeminiImage(IMAGE_MODEL, body);
  }

  // ── Helpers HTTP ──

  private callGeminiText(model: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const path = `/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const req  = https.request(
        { hostname: GEMINI_HOST, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              if ((res.statusCode ?? 0) >= 400) {
                reject(new Error(`Gemini visão HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
                return;
              }
              const parsed = JSON.parse(data);
              const text   = parsed?.candidates?.[0]?.content?.parts?.find(
                (p: { text?: string }) => p.text
              )?.text ?? '';
              if (!text) reject(new Error(`Gemini visão sem texto: ${data.slice(0, 200)}`));
              else resolve(text);
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.setTimeout(60_000, () => req.destroy(new Error('Timeout Gemini visão (60s)')));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private callGeminiImage(model: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const path = `/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const req  = https.request(
        { hostname: GEMINI_HOST, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              if ((res.statusCode ?? 0) >= 400) {
                reject(new Error(`Gemini imagem HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
                return;
              }
              const parsed = JSON.parse(data);
              const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string }; inlineData?: { mimeType: string; data: string } }> =
                parsed?.candidates?.[0]?.content?.parts ?? [];

              const blocked  = parsed?.candidates?.[0]?.finishReason;
              const feedback = parsed?.promptFeedback?.blockReason;

              // A API pode retornar snake_case (inline_data) ou camelCase (inlineData)
              const imagePart = parts.find((p) => p.inline_data?.data ?? p.inlineData?.data);
              const imageData = imagePart?.inline_data?.data ?? imagePart?.inlineData?.data;
              if (!imageData) {
                const txt = parts.find((p) => p.text)?.text ?? '';
                reject(new Error(
                  `Gemini não gerou imagem. ` +
                  (blocked  ? `Motivo: ${blocked}. ` : '') +
                  (feedback ? `Bloqueio: ${feedback}. ` : '') +
                  (txt ? `Texto: ${txt.slice(0, 200)}` : `Resposta: ${data.slice(0, 300)}`)
                ));
                return;
              }
              resolve(imageData);
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.setTimeout(120_000, () => req.destroy(new Error('Timeout Gemini imagem (120s)')));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

function guessMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' } as Record<string, string>)[ext] ?? 'image/jpeg';
}
