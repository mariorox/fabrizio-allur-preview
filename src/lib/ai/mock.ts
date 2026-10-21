/**
 * Mock AI Adapter
 * Produces a visually clear demo image: fabric texture applied semi-transparently
 * over the clothing area, with a fabric swatch panel at the bottom.
 * Used in development and when AI_PROVIDER=mock.
 */
import sharp from 'sharp';
import fs from 'fs';
import type { AIAdapter, TryOnParams, TryOnResult, MultiTryOnParams } from './adapter';
import type { GarmentType } from '@/types';

// Proportion of image height where clothing starts / ends
const CLOTHING_TOP: Record<GarmentType, number> = {
  terno:  0.22,
  blazer: 0.22,
  camisa: 0.22,
  polo:   0.22,
  calca:  0.50,
  sapato: 0.93,
};
const CLOTHING_BOTTOM: Record<GarmentType, number> = {
  terno:  0.92,
  blazer: 0.70,
  camisa: 0.65,
  polo:   0.62,
  calca:  0.95,
  sapato: 0.99,
};

const GARMENT_LABEL: Record<GarmentType, string> = {
  terno: 'TERNO',
  blazer: 'BLAZER',
  camisa: 'CAMISA',
  polo: 'POLO',
  calca: 'CALÇA',
  sapato: 'SAPATO',
};

export class MockAdapter implements AIAdapter {
  async generateTryOn(params: TryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, fabricTexturePath, garmentType, outputPath } = params;

    // Simulate processing delay (1.5–3s)
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));

    const clientImage = sharp(clientPhotoPath);
    const { width = 512, height = 768 } = await clientImage.metadata();

    const topY    = Math.round(height * CLOTHING_TOP[garmentType]);
    const bottomY = Math.round(height * CLOTHING_BOTTOM[garmentType]);
    const zoneH   = bottomY - topY;

    // ── 1. Build semi-transparent fabric overlay for the clothing zone ──
    const { data: rawFabric, info: fabInfo } = await sharp(fabricTexturePath)
      .resize(width, zoneH, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Set alpha to ~55% so person is still visible beneath fabric
    for (let i = 3; i < rawFabric.length; i += 4) {
      rawFabric[i] = Math.round(rawFabric[i] * 0.55);
    }

    const fabricOverlay = await sharp(Buffer.from(rawFabric), {
      raw: { width: fabInfo.width, height: fabInfo.height, channels: 4 },
    }).png().toBuffer();

    // ── 2. Bottom swatch panel (fabric thumbnail + label) ──
    const swatchSize = 64;
    const panelH = 80;
    const swatchBuf = await sharp(fabricTexturePath)
      .resize(swatchSize, swatchSize, { fit: 'cover' })
      .png()
      .toBuffer();

    const labelSvg = Buffer.from(`
      <svg width="${width}" height="${panelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${panelH}" fill="rgba(10,10,10,0.75)"/>
        <text x="${swatchSize + 20}" y="28" font-family="Arial" font-size="16"
              fill="white" font-weight="bold">SIMULAÇÃO — ${GARMENT_LABEL[garmentType]}</text>
        <text x="${swatchSize + 20}" y="50" font-family="Arial" font-size="12" fill="#aaa">
          Tecido aplicado via sobreposição • configure AI_PROVIDER para resultado real
        </text>
        <text x="${swatchSize + 20}" y="68" font-family="Arial" font-size="11" fill="#666">
          AI_PROVIDER=huggingface (grátis) | replicate | fashn
        </text>
      </svg>
    `);

    // ── 3. Compose: base photo → fabric overlay → swatch panel ──
    const result = await clientImage
      .clone()
      .composite([
        // Fabric over clothing area (respects alpha)
        { input: fabricOverlay, top: topY, left: 0, blend: 'over' },
        // Dark panel at bottom
        { input: labelSvg,      top: height - panelH, left: 0 },
        // Fabric swatch thumbnail inside panel
        { input: swatchBuf,     top: height - panelH + (panelH - swatchSize) / 2, left: 8 },
      ])
      .jpeg({ quality: 88 })
      .toBuffer();

    fs.writeFileSync(outputPath, result);
    return { resultImagePath: outputPath };
  }

  /** Aplica todas as peças (zonas) sobre a foto ORIGINAL numa só composição. */
  async generateMultiTryOn(params: MultiTryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, garments, outputPath } = params;
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));

    const clientImage = sharp(clientPhotoPath);
    const { width = 512, height = 768 } = await clientImage.metadata();

    const overlays: sharp.OverlayOptions[] = [];
    for (const g of garments) {
      const topY = Math.round(height * CLOTHING_TOP[g.garmentType]);
      const bottomY = Math.round(height * CLOTHING_BOTTOM[g.garmentType]);
      const zoneH = bottomY - topY;

      const { data: rawFabric, info: fabInfo } = await sharp(g.fabricTexturePath)
        .resize(width, zoneH, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 3; i < rawFabric.length; i += 4) rawFabric[i] = Math.round(rawFabric[i] * 0.55);

      const fabricOverlay = await sharp(Buffer.from(rawFabric), {
        raw: { width: fabInfo.width, height: fabInfo.height, channels: 4 },
      }).png().toBuffer();

      overlays.push({ input: fabricOverlay, top: topY, left: 0, blend: 'over' });
    }

    const labelSvg = Buffer.from(`
      <svg width="${width}" height="48" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="48" fill="rgba(10,10,10,0.75)"/>
        <text x="12" y="30" font-family="Arial" font-size="15" fill="white" font-weight="bold">
          SIMULAÇÃO — ${garments.map((g) => GARMENT_LABEL[g.garmentType]).join(' + ')}
        </text>
      </svg>`);
    overlays.push({ input: labelSvg, top: height - 48, left: 0 });

    const result = await clientImage.clone().composite(overlays).jpeg({ quality: 88 }).toBuffer();
    fs.writeFileSync(outputPath, result);
    return { resultImagePath: outputPath };
  }
}
