import { NextRequest, NextResponse } from 'next/server';
import { createGeneration, updateGeneration, getFabric, getSession, incrementFabricUsage } from '@/lib/db';
import { getAbsolutePath, ensureUploadDirs } from '@/lib/storage';
import { getAIAdapter } from '@/lib/ai/adapter';
import { v4 as uuidv4 } from 'uuid';
import type { GarmentType, OutfitItem } from '@/types';

interface ItemInput {
  garment_type: GarmentType;
  fabric_id: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const {
    session_id,
    items: rawItems,
    base_image: rawBaseImage,
    base_generation_id,
    // compatibilidade com o formato antigo (um item só)
    fabric_id,
    garment_type,
    client_photo,
  } = body as {
    session_id: string;
    items?: ItemInput[];
    base_image?: string;
    base_generation_id?: string | null;
    fabric_id?: string;
    garment_type?: GarmentType;
    client_photo?: string;
  };

  // Normaliza: novo formato (items[] + base_image) OU antigo (fabric_id + garment_type + client_photo)
  const items: ItemInput[] = rawItems?.length
    ? rawItems
    : (fabric_id && garment_type ? [{ garment_type, fabric_id }] : []);
  const baseImage = rawBaseImage ?? client_photo;

  if (!session_id || items.length === 0 || !baseImage) {
    return NextResponse.json(
      { error: 'session_id, base_image e ao menos um item (garment_type + fabric_id) são obrigatórios' },
      { status: 400 },
    );
  }

  const session = getSession(session_id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Valida tecidos
  for (const it of items) {
    if (!it.fabric_id || !it.garment_type) {
      return NextResponse.json({ error: 'Cada item precisa de garment_type e fabric_id' }, { status: 400 });
    }
    if (!getFabric(it.fabric_id)) {
      return NextResponse.json({ error: `Fabric not found: ${it.fabric_id}` }, { status: 404 });
    }
  }

  const genId = uuidv4();
  const generation = createGeneration({
    id: genId,
    session_id,
    base_image: baseImage,
    items,
    base_generation_id: base_generation_id ?? null,
  });

  // Roda a IA em background, encadeando item a item (sem await)
  void runAI(genId, getAbsolutePath(baseImage), generation.items);

  return NextResponse.json(generation, { status: 201 });
}

/**
 * Aplica TODAS as peças do look numa única passada, SEMPRE a partir da foto
 * base (original/pristina). Isso evita a degradação de "cópia de cópia" e o
 * zoom progressivo que ocorriam ao reeditar imagens já geradas.
 *
 * Provedores sem suporte multi caem no encadeamento (pode degradar).
 */
async function runAI(genId: string, baseAbsPath: string, items: OutfitItem[]) {
  try {
    updateGeneration(genId, { status: 'processing' });
    // Disco novo (deploy) pode não ter uploads/results ainda
    ensureUploadDirs();
    const adapter = getAIAdapter();

    const garments = items.map((it) => ({
      fabricTexturePath: getAbsolutePath(it.fabric_texture!),
      garmentType: it.garment_type,
      fabricName: it.fabric_name,
    }));

    let finalRel = `results/${genId}.jpg`;

    if (adapter.generateMultiTryOn) {
      await adapter.generateMultiTryOn({
        clientPhotoPath: baseAbsPath,
        garments,
        outputPath: getAbsolutePath(finalRel),
      });
    } else {
      // Fallback: encadeia peça a peça (qualidade pode degradar)
      let workingPath = baseAbsPath;
      for (let i = 0; i < garments.length; i++) {
        const stepRel = `results/${genId}${garments.length > 1 ? `-${i}` : ''}.jpg`;
        const stepAbs = getAbsolutePath(stepRel);
        await adapter.generateTryOn({
          clientPhotoPath: workingPath,
          fabricTexturePath: garments[i].fabricTexturePath,
          garmentType: garments[i].garmentType,
          outputPath: stepAbs,
          fabricName: garments[i].fabricName,
        });
        workingPath = stepAbs;
        finalRel = stepRel;
      }
    }

    for (const it of items) incrementFabricUsage(it.fabric_id);
    updateGeneration(genId, { status: 'success', result_image: finalRel });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateGeneration(genId, { status: 'failed', error_message: message });
  }
}
