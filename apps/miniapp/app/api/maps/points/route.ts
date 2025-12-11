import { NextResponse } from 'next/server';
import type { MapPoint } from '@prisma/client';

import prisma from '../../../../lib/prisma';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
  }

  try {
    const points = await prisma.mapPoint.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      points.map((p: MapPoint) => ({
        id: p.id,
        listingType: p.listingType,
        listingId: p.listingId,
        title: p.title,
        description: p.description,
        latitude: p.latitude,
        longitude: p.longitude,
      }))
    );
  } catch (error) {
    console.error('Failed to fetch map points', error);
    return NextResponse.json({ error: 'Failed to fetch map points' }, { status: 500 });
  }
}
