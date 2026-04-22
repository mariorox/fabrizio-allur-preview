import { NextRequest, NextResponse } from 'next/server';
import { createFabric } from '@/lib/db';
import { saveUploadedFile } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * POST /api/fabrics/batch
 * multipart/form-data com:
 *   collection: string
 *   category: string (opcional, aplicada a todos)
 *   items[0][name]: string
 *   items[0][code]: string
 *   items[0][texture]: File
 *   items[1][name]: ...
 *   ...
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const collection = (formData.get('collection') as string)?.trim();
  const category = (formData.get('category') as string)?.trim() || undefined;

  if (!collection) {
    return NextResponse.json({ error: 'Nome da coleção é obrigatório' }, { status: 400 });
  }

  // Collect all items — keys like items[0][name], items[0][code], items[0][texture]
  const itemsMap: Record<number, { name?: string; code?: string; texture?: File }> = {};

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^items\[(\d+)\]\[(\w+)\]$/);
    if (!match) continue;
    const idx = Number(match[1]);
    const field = match[2];
    if (!itemsMap[idx]) itemsMap[idx] = {};
    if (field === 'name') itemsMap[idx].name = value as string;
    else if (field === 'code') itemsMap[idx].code = value as string;
    else if (field === 'texture') itemsMap[idx].texture = value as File;
  }

  const items = Object.values(itemsMap);

  if (items.length === 0) {
    return NextResponse.json({ error: 'Nenhum tecido para cadastrar' }, { status: 400 });
  }

  const created = [];
  const errors = [];

  for (const item of items) {
    if (!item.name || !item.code || !item.texture) {
      errors.push(`Item inválido: nome, código e textura são obrigatórios`);
      continue;
    }
    try {
      const ext = path.extname(item.texture.name) || '.jpg';
      const filename = `${uuidv4()}${ext}`;
      const buffer = Buffer.from(await item.texture.arrayBuffer());
      const texturePath = saveUploadedFile(buffer, 'fabrics', filename);

      const fabric = createFabric({
        id: uuidv4(),
        name: item.name.trim(),
        code: item.code.trim().toUpperCase(),
        category,
        collection,
        texture_image: texturePath,
      });
      created.push(fabric);
    } catch (err) {
      errors.push(`Erro ao salvar "${item.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ created, errors }, { status: created.length > 0 ? 201 : 400 });
}
