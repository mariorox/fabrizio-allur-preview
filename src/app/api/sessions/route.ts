import { NextRequest, NextResponse } from 'next/server';
import { createSession, listSessions, listSessionsWithStats } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const withStats = searchParams.get('stats') === 'true';

  if (withStats) {
    const result = listSessionsWithStats({ search, limit, offset });
    return NextResponse.json(result);
  }

  // Legacy: simple list for home page recents
  const sessions = listSessions(limit);
  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const session = createSession({
    id: uuidv4(),
    client_name: body.client_name || undefined,
    notes: body.notes || undefined,
    atelier_id: body.atelier_id || undefined,
  });
  return NextResponse.json(session, { status: 201 });
}
