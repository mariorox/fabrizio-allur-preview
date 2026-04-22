import { NextRequest, NextResponse } from 'next/server';
import { listSessionGenerations } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const generations = listSessionGenerations(id);
  return NextResponse.json(generations);
}
