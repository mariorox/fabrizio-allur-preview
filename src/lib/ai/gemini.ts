/**
 * Google Gemini Adapter — 3 etapas (pipeline híbrido):
 *   1. VISION_MODEL (visão): descreve o tecido em detalhes
 *   2. IMAGE_MODEL (edição): gera preview com roupa trocada (para sombras/dobras)
 *   3. IMAGE_MODEL (máscara): pinta a roupa de verde para segmentação
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
import type { AIAdapter, TryOnParams, TryOnResult, MultiTryOnParams } from './adapter';
import type { GarmentType } from '@/types';

const GEMINI_HOST  = 'generativelanguage.googleapis.com';
// gemini-2.5-flash não é mais liberado para contas novas; ambos sobrescrevíveis por env
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash';
// Sobrescrevível por env para comparar/trocar modelos sem mexer no código
const IMAGE_MODEL  = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';

const GARMENT_EN: Record<GarmentType, string> = {
  terno:  'a suit JACKET and TROUSERS ONLY (do NOT touch the shirt/undershirt underneath)',
  blazer: 'a blazer jacket ONLY (do NOT touch the shirt underneath)',
  camisa: 'a dress shirt ONLY',
  polo:   'a polo shirt ONLY',
  calca:  'dress trousers ONLY',
  sapato: 'the SHOES ONLY (do NOT touch the socks, trousers, or anything above the ankle)',
};

/** Sapatos são peças únicas (produto), não texturas repetíveis de tecido. */
function isShoe(g: GarmentType): boolean {
  return g === 'sapato';
}

export class GeminiAdapter implements AIAdapter {
  constructor(private apiKey: string) {}

  async generateTryOn(params: TryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, fabricTexturePath, garmentType, outputPath } = params;
    const fabricName = params.fabricName ?? 'selected fabric';

    // ── Etapa 1: descrever o tecido com foco em proporções ──
    console.log('[Gemini] Etapa 1/3: descrevendo %s...', isShoe(garmentType) ? 'sapato' : 'tecido');
    const fabricDescription = await this.describeFabric(fabricTexturePath, fabricName, garmentType);

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

  /**
   * Aplica VÁRIAS peças numa única passada, SEMPRE a partir da foto base
   * (original). Mesmo número de renders (edit + refine) independentemente
   * da quantidade de peças — sem degradação acumulada nem zoom progressivo.
   */
  async generateMultiTryOn(params: MultiTryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, garments, outputPath } = params;
    if (garments.length === 0) throw new Error('Nenhuma peça para aplicar');

    console.log('[Gemini] Multi 1/3: descrevendo %d tecido(s)...', garments.length);
    const descriptions = await Promise.all(
      garments.map((g) => this.describeFabric(g.fabricTexturePath, g.fabricName ?? 'selected fabric', g.garmentType)),
    );

    console.log('[Gemini] Multi 2/3: aplicando todas as peças em uma edição (a partir da foto original)...');
    const firstPassB64 = await this.editClothingMulti(clientPhotoPath, garments, descriptions);

    console.log('[Gemini] Multi 3/3: refinando padrões...');
    const refinedB64 = await this.refineResultMulti(firstPassB64, garments);

    const imageBuffer = Buffer.from(refinedB64, 'base64');
    await sharp(imageBuffer).rotate().jpeg({ quality: 92 }).toFile(outputPath);
    console.log('[Gemini] ✅ Look multi-peça salvo');
    return { resultImagePath: outputPath };
  }

  /** Amplia a textura 2× (lanczos) e devolve base64 JPEG. */
  private async upscaleFabricB64(fabricTexturePath: string): Promise<string> {
    const fabricBuf = fs.readFileSync(fabricTexturePath);
    const meta = await sharp(fabricBuf).metadata();
    const upscaled = await sharp(fabricBuf)
      .resize(Math.round((meta.width ?? 500) * 2), Math.round((meta.height ?? 500) * 2), {
        kernel: sharp.kernel.lanczos3,
      })
      .jpeg({ quality: 95 })
      .toBuffer();
    return upscaled.toString('base64');
  }

  /** Edita todas as peças de uma vez (Image 1 = foto; Image 2..N = swatches). */
  private async editClothingMulti(
    clientPhotoPath: string,
    garments: { fabricTexturePath: string; garmentType: GarmentType; fabricName?: string }[],
    descriptions: string[],
  ): Promise<string> {
    const photoB64 = fs.readFileSync(clientPhotoPath).toString('base64');
    const photoMime = guessMime(clientPhotoPath);
    const swatches = await Promise.all(garments.map((g) => this.upscaleFabricB64(g.fabricTexturePath)));

    const garmentLines = garments
      .map((g, i) => isShoe(g.garmentType)
        ? `- Image ${i + 2} is a PHOTO OF A SPECIFIC SHOE PRODUCT (a unique piece). Replace the person's footwear with THIS EXACT shoe — same type, silhouette, toe shape, color(s), material/finish, sole, closure and distinctive details. Do NOT treat it as a repeating fabric texture. Product analysis: ${descriptions[i]}`
        : `- Image ${i + 2} is the fabric for ${GARMENT_EN[g.garmentType]}. Apply THIS fabric to THAT garment. Fabric analysis: ${descriptions[i]}`)
      .join('\n');
    const changedList = garments.map((g) => GARMENT_EN[g.garmentType]).join(' AND ');

    const hasFabric = garments.some((g) => !isShoe(g.garmentType));
    const hasShoe = garments.some((g) => isShoe(g.garmentType));

    const fabricFidelity = hasFabric ? `
ABSOLUTE PRIORITY — PATTERN FIDELITY (fabric garments):
- The pattern lines in each swatch are EXTREMELY FINE — almost hair-thin, with lots of solid base color between them.
- Make the lines on each garment EVEN THINNER than you think. The most common error is lines too thick — actively fight it.
- Match the EXACT colors of each swatch (base color + line colors).` : '';
    const shoeFidelity = hasShoe ? `
ABSOLUTE PRIORITY — SHOE PRODUCTS (unique pieces):
- Any shoe reference image is a SPECIFIC product, NOT a repeating texture. Reproduce the EXACT same shoe on the feet (type, color, material, toe shape, sole, closure, details), fitted naturally with correct perspective, ground contact and realistic shadows.` : '';
    // Se um sapato ESTÁ sendo trocado, não peça para manter os sapatos originais.
    const preserveList = hasShoe ? 'accessories' : 'shoes, accessories';

    const prompt = `Edit this photo of a person (Image 1). Apply the following item(s), each from its OWN reference image: ${changedList}.

ASSIGNMENTS (match each item to its own reference image):
${garmentLines}
${fabricFidelity}${shoeFidelity}

ITEM RULES:
- Each garment must look naturally tailored: realistic draping, folds, shadows, seams, buttons, lapels, pockets. Shoes must sit naturally on the feet with correct perspective and ground contact.

PRESERVATION (DO NOT CHANGE):
- Face, hair, skin tone, body shape, pose, hands — pixel-perfect identical.
- Background, floor, ${preserveList} — completely unchanged.
- Any garment NOT listed above stays EXACTLY as in the original (e.g., if only trousers and blazer change, the shirt underneath stays identical).

CRITICAL — FRAMING, ZOOM AND DIMENSIONS (HIGHEST PRIORITY):
- The output MUST have EXACTLY the same dimensions, aspect ratio, framing, crop, camera angle and ZOOM/DISTANCE as Image 1.
- Do NOT zoom in, do NOT zoom out, do NOT re-crop, do NOT reframe. The person must appear at the EXACT same scale and position within the frame as Image 1.
- Treat this as an in-place pixel edit — the head position, shoulders and body must align pixel-for-pixel with Image 1; every pixel outside the changed garments stays in its original location.`;

    const parts = [
      { inline_data: { mime_type: photoMime, data: photoB64 } },
      ...swatches.map((s) => ({ inline_data: { mime_type: 'image/jpeg', data: s } })),
      { text: prompt },
    ];
    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    return this.callGeminiImage(IMAGE_MODEL, body);
  }

  /** Refina os padrões de todas as peças comparando com seus swatches. */
  private async refineResultMulti(
    firstPassB64: string,
    garments: { fabricTexturePath: string; garmentType: GarmentType }[],
  ): Promise<string> {
    const swatches = await Promise.all(garments.map((g) => this.upscaleFabricB64(g.fabricTexturePath)));
    const garmentLines = garments
      .map((g, i) => isShoe(g.garmentType)
        ? `- Image ${i + 2}: the ORIGINAL shoe product the footwear must match.`
        : `- Image ${i + 2}: the ORIGINAL swatch for ${GARMENT_EN[g.garmentType]}.`)
      .join('\n');

    const hasFabric = garments.some((g) => !isShoe(g.garmentType));
    const hasShoe = garments.some((g) => isShoe(g.garmentType));
    const fabricErrors = hasFabric ? `
FABRIC GARMENTS — fix:
- Lines/stripes too thick → make thinner to match the swatch
- Pattern too bold/saturated → make subtler
- Wrong scale, spacing or colors → correct to match the swatch precisely` : '';
    const shoeErrors = hasShoe ? `
SHOES — fix:
- Wrong color, material, finish or toe shape → correct to match the product
- Invented or wrong closure, sole, stitching, hardware or logos → correct to match the product exactly
- Left/right shoes inconsistent → make both match the same product` : '';

    const prompt = `You are a quality inspector. Image 1 is an AI-generated photo of a person. The remaining images are the ORIGINAL references each item must match:
${garmentLines}

YOUR TASK: Refine Image 1 so each item EXACTLY matches its reference (fabric pattern for garments; the exact product for shoes).
${fabricErrors}${shoeErrors}

KEEP UNCHANGED:
- The person (face, body, pose, hands, skin) — do not alter.
- The background — identical.
- Each item's SHAPE, fit, draping, folds, shadows — keep the realistic 3D look (do not move or resize the shoes).
- Any item without a reference above stays exactly as-is.

CRITICAL — FRAMING/ZOOM (HIGHEST PRIORITY):
- Same dimensions, aspect ratio, framing, crop and ZOOM/DISTANCE as Image 1. Do NOT zoom or reframe. In-place pixel edit only — the person stays at the EXACT same scale and position.

Output the corrected photo.`;

    const parts = [
      { inline_data: { mime_type: 'image/jpeg', data: firstPassB64 } },
      ...swatches.map((s) => ({ inline_data: { mime_type: 'image/jpeg', data: s } })),
      { text: prompt },
    ];
    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    return this.callGeminiImage(IMAGE_MODEL, body);
  }

  /**
   * Etapa 1 — descreve o item de referência com VISION_MODEL.
   * Tecido → foco em padrão/proporções. Sapato → foco no produto (tipo, cor,
   * material, forma, solado, fecho, detalhes), pois é uma peça única e não uma
   * textura repetível.
   */
  private async describeFabric(fabricPath: string, fabricName: string, garmentType?: GarmentType): Promise<string> {
    const fabricB64 = fs.readFileSync(fabricPath).toString('base64');
    const mime      = guessMime(fabricPath);

    if (garmentType && isShoe(garmentType)) {
      const shoeBody = JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mime, data: fabricB64 } },
            { text: `Analyze this SHOE PRODUCT photo with EXTREME PRECISION so the exact same shoe can be recreated on a person's feet. The shoe is called "${fabricName}".

Describe EXACTLY:
1. TYPE: (oxford, derby, loafer, monk strap, brogue, sneaker, boot, sandal, etc.)
2. COLORS: exact color(s) of the upper, plus any contrast panels
3. MATERIAL / FINISH: (smooth leather, suede, patent, canvas, nubuck…) and matte vs glossy
4. TOE SHAPE: (round, almond, pointed, square, cap toe)
5. CLOSURE: (laces, buckle/monk strap, slip-on, zipper, velcro) and number of eyelets if visible
6. SOLE: color, type (leather/rubber), height/thickness, welt if visible
7. DISTINCTIVE DETAILS: brogue perforations, stitching, hardware, buckles, logos, patterns

This is a UNIQUE product — describe it factually and specifically so it can be reproduced identically, not approximated.` },
          ],
        }],
      });
      return this.callGeminiText(VISION_MODEL, shoeBody);
    }

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

    // Sapato = peça única (produto): substitui o calçado pelo modelo exato,
    // sem tratar a imagem como textura repetível.
    const prompt = isShoe(garmentType) ? `Edit this photo of a person. Replace ONLY their footwear with the EXACT shoe product shown in the second image. Everything above the ankle stays untouched.

SHOE PLACEMENT — PRODUCT FIDELITY (ABSOLUTE PRIORITY):
- The second image is a SPECIFIC shoe product (a unique piece), NOT a fabric texture. Do NOT tile, repeat, or use it as a pattern.
- Recreate the SAME shoe on the person's feet: same type, silhouette, toe shape, color(s), material/finish, sole, closure and every distinctive detail.
- Fit BOTH shoes naturally to the feet and the pose — correct perspective, size, ground contact and realistic shadows.
- Show only what the framing allows (if the feet are cropped, do not invent them).

Detailed product analysis: ${fabricDescription}

PRESERVATION (DO NOT CHANGE):
- Face, hair, skin, body shape, pose, hands — pixel-perfect identical.
- ALL clothing above the ankle (socks, trousers, everything) stays EXACTLY as in the original.
- Background, floor, accessories — unchanged, except where the new shoes naturally rest.

CRITICAL — FRAMING AND DIMENSIONS (HIGHEST PRIORITY):
- The output image MUST have EXACTLY the same dimensions, aspect ratio, framing, crop, and camera angle as the input photo.
- Do NOT zoom in, do NOT zoom out, do NOT re-crop, do NOT reframe. The person must appear at the EXACT same scale and position.
- Treat this as an in-place pixel edit — every pixel outside the shoes stays in its original location.` : `Edit this photo of a person. Change ONLY their ${garment} to be custom tailored from the EXACT fabric shown in the second image.

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

    const prompt = isShoe(garmentType) ? `You are a footwear quality inspector. Compare these two images:

IMAGE 1: An AI-generated photo of a person. Look at the SHOES.
IMAGE 2: The ORIGINAL shoe product the footwear must match.

YOUR TASK: Refine the shoes in Image 1 so they EXACTLY match the product in Image 2.

COMMON ERRORS TO FIX:
- Wrong color, material or finish → correct to match the product
- Wrong toe shape or silhouette → reshape to match
- Wrong or invented closure, sole, stitching, hardware or logos → correct to match the product exactly
- Left/right shoes inconsistent with each other → make both match the same product

WHAT TO KEEP UNCHANGED:
- The person (face, body, pose, hands, skin) — do not alter.
- ALL clothing above the ankle (socks, trousers) and the background — identical.
- The shoes' natural fit, perspective, ground contact and realistic shadows — keep the 3D look.
- Only refine the shoe APPEARANCE to match the product; do not move or resize them.

CRITICAL — FRAMING AND DIMENSIONS (HIGHEST PRIORITY):
- Same dimensions, aspect ratio, framing and crop as Image 1. Do NOT zoom or reframe. In-place pixel edit only — the person stays at the EXACT same scale and position.

Output the corrected photo.` : `You are a fabric pattern quality inspector. Compare these two images:

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
      const path = `/v1beta/models/${model}:generateContent`;
      const req  = https.request(
        { hostname: GEMINI_HOST, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-goog-api-key': this.apiKey } },
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
      const path = `/v1beta/models/${model}:generateContent`;
      const req  = https.request(
        { hostname: GEMINI_HOST, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-goog-api-key': this.apiKey } },
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
