import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003').replace(/\/$/, '');
  try {
    const res = await fetch(`${backendUrl}/health`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ indexer_ok: false, last_heartbeat: 0, seconds_since_heartbeat: 0 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ indexer_ok: false, last_heartbeat: 0, seconds_since_heartbeat: 0 });
  }
}
