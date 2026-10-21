import { NextRequest, NextResponse } from 'next/server';
import { listAteliers, getAtelier } from '@/lib/db';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const atelier = getAtelier(id);
    if (!atelier) return NextResponse.json({ error: 'Ateliê não encontrado' }, { status: 404 });
    return NextResponse.json(atelier);
  }
  return NextResponse.json(listAteliers());
}
