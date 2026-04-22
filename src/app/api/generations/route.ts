import { NextRequest, NextResponse } from 'next/server';
import { createGeneration, updateGeneration, getFabric, getSession } from '@/lib/db';
import { getAbsolutePath, saveUploadedFile } from '@/lib/storage';
import { getAIAdapter } from '@/lib/ai/adapter';
import { incrementFabricUsage } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import type { GarmentType } from '@/types';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { session_id, fabric_id, garment_type, client_photo } = body as {
    session_id: string;
    fabric_id: string;
    garment_type: GarmentType;
    client_photo: string; // relative path already saved
  };

  if (!session_id || !fabric_id || !garment_type || !client_photo) {
    return NextResponse.json({ error: 'session_id, fabric_id, garment_type, client_photo são obrigatórios' }, { status: 400 });
  }

  const session = getSession(session_id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const fabric = getFabric(fabric_id);
  if (!fabric) return NextResponse.json({ error: 'Fabric not found' }, { status: 404 });

  const genId = uuidv4();
  const generation = createGeneration({
    id: genId,
    session_id,
    fabric_id,
    garment_type,
    client_photo,
  });

  // Fire and forget — update status async
  const clientPhotoPath = getAbsolutePath(client_photo);
  const fabricTexturePath = getAbsolutePath(fabric.texture_image);
  const outputFilename = `${genId}.jpg`;
  const outputRelPath = `results/${outputFilename}`;
  const outputAbsPath = getAbsolutePath(outputRelPath);

  // Run AI in background (no await)
  void runAI(genId, clientPhotoPath, fabricTexturePath, garment_type, outputAbsPath, outputRelPath, fabric_id, fabric.name);

  return NextResponse.json(generation, { status: 201 });
}

async function runAI(
  genId: string,
  clientPhotoPath: string,
  fabricTexturePath: string,
  garmentType: GarmentType,
  outputAbsPath: string,
  outputRelPath: string,
  fabricId: string,
  fabricName?: string,
) {
  try {
    updateGeneration(genId, { status: 'processing' });
    const adapter = getAIAdapter();
    await adapter.generateTryOn({
      clientPhotoPath,
      fabricTexturePath,
      garmentType,
      outputPath: outputAbsPath,
      fabricName,
    });
    updateGeneration(genId, { status: 'success', result_image: outputRelPath });
    incrementFabricUsage(fabricId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateGeneration(genId, { status: 'failed', error_message: message });
  }
}
