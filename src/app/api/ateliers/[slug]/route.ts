import { NextRequest, NextResponse } from 'next/server';
import { getAtelierBySlug, listFabrics } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const atelier = getAtelierBySlug(slug);
  if (!atelier) {
    return NextResponse.json({ error: 'Ateliê não encontrado' }, { status: 404 });
  }
  // Catálogo público mostra apenas tecidos; sapatos são peças únicas geridas à parte.
  const fabrics = listFabrics({ atelierId: atelier.id, kind: 'fabric' });
  return NextResponse.json({ ...atelier, fabrics });
}
