import { NextResponse } from 'next/server';
import { listFabricCategories, createFabricCategory } from '@/lib/db';

export async function GET() {
  try {
    const categories = listFabricCategories();
    return NextResponse.json(categories);
  } catch (err) {
    console.error('List categories error:', err);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }
    const category = createFabricCategory(name);
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create category';
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Categoria já existe' }, { status: 409 });
    }
    console.error('Create category error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
