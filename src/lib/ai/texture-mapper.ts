/**
 * Texture Mapper — aplica textura real sobre foto usando máscara de segmentação
 *
 * Estratégia: detecta verde na resolução NATIVA da máscara do Gemini,
 * depois redimensiona a máscara binária para a resolução da foto original.
 * Isso evita problemas de aspect ratio entre a imagem do Gemini e a foto.
 */
import sharp from 'sharp';

interface TextureMapParams {
  originalPhoto: Buffer;
  aiResult: Buffer;
  greenMask: Buffer;
  fabricTexture: Buffer;
  outputPath: string;
}

export async function applyRealTexture(params: TextureMapParams): Promise<void> {
  const { originalPhoto, aiResult, greenMask, fabricTexture, outputPath } = params;

  // ── 1. Auto-rotate EXIF e obter dimensões da foto original ──
  const rotatedOriginal = await sharp(originalPhoto).rotate().toBuffer();
  const { width: W, height: H } = await sharp(rotatedOriginal).metadata() as { width: number; height: number };
  console.log('[TextureMapper] Foto original:', W, '×', H);

  // ── 2. Detectar verde na resolução NATIVA da máscara (evita distorção) ──
  const maskMeta = await sharp(greenMask).metadata();
  const mW = maskMeta.width!;
  const mH = maskMeta.height!;
  console.log('[TextureMapper] Green mask nativa:', mW, '×', mH);

  const maskNativeRaw = await sharp(greenMask).removeAlpha().raw().toBuffer();

  // Criar máscara binária na resolução nativa
  const maskNative = Buffer.alloc(mW * mH);
  for (let i = 0; i < mW * mH; i++) {
    const r = maskNativeRaw[i * 3];
    const g = maskNativeRaw[i * 3 + 1];
    const b = maskNativeRaw[i * 3 + 2];
    // Verde: G alto e dominante sobre R e B
    const isGreen = g > 70 && g > r * 1.1 && g > b * 1.1;
    maskNative[i] = isGreen ? 255 : 0;
  }

  const nativeActive = Array.from(maskNative).filter((v) => v > 128).length;
  console.log('[TextureMapper] Máscara nativa — pixels verdes:', nativeActive, `(${Math.round(nativeActive / (mW * mH) * 100)}%)`);

  // ── 3. Redimensionar máscara binária para resolução da foto original ──
  // Sharp converte 1ch→3ch no blur, então forçamos grayscale no final
  const maskResizedRaw = await sharp(maskNative, { raw: { width: mW, height: mH, channels: 1 } })
    .resize(W, H, { fit: 'fill' })
    .blur(5)
    .raw()
    .toBuffer();

  // Extrair canal único (Sharp pode ter expandido para 3 canais)
  let maskResized: Buffer;
  if (maskResizedRaw.length === W * H) {
    maskResized = maskResizedRaw;
  } else {
    const channels = Math.round(maskResizedRaw.length / (W * H));
    console.log('[TextureMapper] Mask tem', channels, 'canais — extraindo 1º canal');
    maskResized = Buffer.alloc(W * H);
    for (let i = 0; i < W * H; i++) {
      maskResized[i] = maskResizedRaw[i * channels];
    }
  }

  const activePixels = Array.from(maskResized).filter((v) => v > 128).length;
  const pct = Math.round(activePixels / (W * H) * 100);
  console.log('[TextureMapper] Máscara final:', W, '×', H, '— ativos:', activePixels, `(${pct}%)`);

  if (pct < 1) {
    console.warn('[TextureMapper] ⚠ Máscara <1% — fallback para resultado da IA');
    await sharp(aiResult).rotate().jpeg({ quality: 92 }).toFile(outputPath);
    return;
  }

  // ── DEBUG ──
  const debugDir = outputPath.replace(/[^/\\]+$/, '');
  await sharp(maskResized, { raw: { width: W, height: H, channels: 1 } })
    .jpeg({ quality: 80 }).toFile(debugDir + '_debug_mask.jpg');

  // ── 4. Converter foto original e resultado da IA para raw RGB ──
  const origRaw = await sharp(rotatedOriginal).removeAlpha().raw().toBuffer();
  const aiRaw = await sharp(aiResult).rotate().resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();

  // Luminância do AI result (sombras)
  console.log('[TextureMapper] Extraindo luminância...');
  const lum = Buffer.alloc(W * H);
  let lumSum = 0, lumN = 0;
  for (let i = 0; i < W * H; i++) {
    const l = Math.round(0.299 * aiRaw[i * 3] + 0.587 * aiRaw[i * 3 + 1] + 0.114 * aiRaw[i * 3 + 2]);
    lum[i] = l;
    if (maskResized[i] > 128) { lumSum += l; lumN++; }
  }
  const avgLum = lumN > 0 ? lumSum / lumN : 128;
  console.log('[TextureMapper] Luminância média:', Math.round(avgLum));

  // ── 5. Ladrilhar textura real ──
  console.log('[TextureMapper] Ladrilhando textura...');
  const texBuf = await sharp(fabricTexture).rotate().removeAlpha().raw().toBuffer();
  const texMeta = await sharp(fabricTexture).rotate().metadata();
  const tW = texMeta.width!;
  const tH = texMeta.height!;
  console.log('[TextureMapper] Textura:', tW, '×', tH);

  // ── 6. Compositar: transferência de luminância COMPLETA ──
  // A IA gera sombras, dobras, destaques realistas → extraímos como "mapa de luz".
  // A textura real tem o padrão exato → usamos como "mapa de cor".
  // Resultado: textura real iluminada pelas sombras da IA = realista + preciso.
  console.log('[TextureMapper] Compositando com transferência de luminância...');

  const finalRGB = Buffer.alloc(W * H * 3);

  for (let i = 0; i < W * H; i++) {
    const alpha = maskResized[i] / 255;
    const i3 = i * 3;

    if (alpha < 0.01) {
      finalRGB[i3] = origRaw[i3];
      finalRGB[i3 + 1] = origRaw[i3 + 1];
      finalRGB[i3 + 2] = origRaw[i3 + 2];
    } else {
      const y = Math.floor(i / W);
      const x = i % W;
      const tx = x % tW;
      const ty = y % tH;
      const tIdx = (ty * tW + tx) * 3;

      // Luminância da IA neste pixel (sombras + destaques + dobras)
      const aiLum = lum[i];
      // Cor e luminância da textura real
      const tR = texBuf[tIdx], tG = texBuf[tIdx + 1], tB = texBuf[tIdx + 2];
      const texLum = 0.299 * tR + 0.587 * tG + 0.114 * tB;

      // Fator de luz: transfere a iluminação da IA para a textura
      // aiLum/avgLum = quão claro/escuro este pixel é em relação à média
      // Sombra profunda → fator ~0.3, normal → ~1.0, destaque → ~1.3
      const lightFactor = avgLum > 0 ? aiLum / avgLum : 1;
      const clamped = Math.min(1.5, Math.max(0.15, lightFactor));

      const finalR = Math.min(255, Math.round(tR * clamped));
      const finalG = Math.min(255, Math.round(tG * clamped));
      const finalB = Math.min(255, Math.round(tB * clamped));

      // Feathering nas bordas
      finalRGB[i3] = Math.round(origRaw[i3] * (1 - alpha) + finalR * alpha);
      finalRGB[i3 + 1] = Math.round(origRaw[i3 + 1] * (1 - alpha) + finalG * alpha);
      finalRGB[i3 + 2] = Math.round(origRaw[i3 + 2] * (1 - alpha) + finalB * alpha);
    }
  }

  // ── 7. Salvar ──
  await sharp(finalRGB, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  console.log('[TextureMapper] ✅ Salvo em', outputPath);
}
