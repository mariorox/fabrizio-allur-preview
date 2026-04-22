import { NextRequest, NextResponse } from 'next/server';
import { getAbsolutePath } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relativePath = segments.join('/');

  // Security: prevent path traversal
  if (relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const absPath = getAbsolutePath(relativePath);

  if (!fs.existsSync(absPath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(absPath).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const buffer = fs.readFileSync(absPath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
