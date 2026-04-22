import { NextRequest, NextResponse } from 'next/server';
import { getGeneration, deleteGeneration } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const generation = getGeneration(id);
  if (!generation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(generation);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    deleteGeneration(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete generation error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
