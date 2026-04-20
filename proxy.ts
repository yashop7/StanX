import { NextRequest, NextResponse } from 'next/server';

const rateMap = new Map<string, { count: number; start: number }>();

const LIMIT = 60;        // max requests per window
const WINDOW = 60_000;   // 60 seconds in ms

export function proxy(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const now = Date.now();

  const entry = rateMap.get(ip) ?? { count: 0, start: now };

  if (now - entry.start > WINDOW) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count++;
  rateMap.set(ip, entry);

  if (entry.count > LIMIT) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((entry.start + WINDOW - now) / 1000)) },
    });
  }
}

export const config = {
  matcher: '/api/backend/:path*',
};
