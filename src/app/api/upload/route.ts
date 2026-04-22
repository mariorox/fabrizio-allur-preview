import { NextRequest, NextResponse } from 'next/server';
import { saveSessionPhoto, saveUploadedFile } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * POST /api/upload
 * Body: multipart/form-data
 *   file: File
 *   type: 'client-photo' | 'fabric'
 *   session_id?: string (required for client-photo)
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string;
  const sessionId = formData.get('session_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = path.extname(file.name) || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let relativePath: string;

  if (type === 'client-photo') {
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id required for client-photo' }, { status: 400 });
    }
    relativePath = saveSessionPhoto(buffer, sessionId, filename);
  } else {
    relativePath = saveUploadedFile(buffer, 'fabrics', filename);
  }

  return NextResponse.json({ path: relativePath }, { status: 201 });
}
