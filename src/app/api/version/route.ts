import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';

// verziószámot ad vissza, a package.json az egyetlen forrása
export async function GET() {
    return NextResponse.json({version: pkg.version}, { status: 200 })
}

// Hello példa
export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const name = body?.name;

    // hiányzó vagy üres név esetén nem köszönünk, 400-as hibát adunk
    if (typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'A név megadása kötelező' }, { status: 400 });
    }

  return NextResponse.json(`Hello ${name}!`, { status: 201 });
}
