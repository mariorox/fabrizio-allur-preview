import { NextResponse } from 'next/server';
import { updateFabricCategory, deleteFabricCategory } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }
    const category = updateFabricCategory(Number(id), name);
    if (!category) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    return NextResponse.json(category);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update';
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Categoria já existe' }, { status: 409 });
    }
    console.error('Update category error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    deleteFabricCategory(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete category error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
