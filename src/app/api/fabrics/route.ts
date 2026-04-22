import { NextRequest, NextResponse } from 'next/server';
import { createFabric, listFabrics } from '@/lib/db';
import { saveUploadedFile } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fabrics = listFabrics({
    search: searchParams.get('search') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    collection: searchParams.get('collection') ?? undefined,
    activeOnly: searchParams.get('all') !== 'true',
  });
  return NextResponse.json(fabrics);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const name = formData.get('name') as string;
  const code = formData.get('code') as string;
  const category = (formData.get('category') as string) || undefined;
  const collection = (formData.get('collection') as string) || undefined;
  const file = formData.get('texture') as File | null;

  if (!name || !code || !file) {
    return NextResponse.json({ error: 'name, code e texture são obrigatórios' }, { status: 400 });
  }

  const ext = path.extname(file.name) || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const texturePath = saveUploadedFile(buffer, 'fabrics', filename);

  const fabric = createFabric({
    id: uuidv4(),
    name,
    code,
    category,
    collection,
    texture_image: texturePath,
  });

  return NextResponse.json(fabric, { status: 201 });
}
