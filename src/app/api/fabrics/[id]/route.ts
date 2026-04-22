import { NextRequest, NextResponse } from 'next/server';
import { getFabric, updateFabric, deleteFabric } from '@/lib/db';
import { saveUploadedFile } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fabric = getFabric(id);
  if (!fabric) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(fabric);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Handle multipart (if texture is being updated) or JSON
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const updates: Record<string, unknown> = {};

    for (const key of ['name', 'code', 'category', 'collection']) {
      const val = formData.get(key);
      if (val !== null) updates[key] = val as string;
    }

    const file = formData.get('texture') as File | null;
    if (file) {
      const ext = path.extname(file.name) || '.jpg';
      const filename = `${uuidv4()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      updates.texture_image = saveUploadedFile(buffer, 'fabrics', filename);
    }

    const fabric = updateFabric(id, updates as Parameters<typeof updateFabric>[1]);
    if (!fabric) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(fabric);
  }

  const body = await request.json().catch(() => ({}));
  const fabric = updateFabric(id, body);
  if (!fabric) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(fabric);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fabric = getFabric(id);
  if (!fabric) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteFabric(id);
  return NextResponse.json({ ok: true });
}
