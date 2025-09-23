// src/app/api/cron/route.ts
import { NextResponse } from 'next/server';
import { monitorPriceDrops } from '@/ai/flows/price-drop-email-summarization';

export async function GET() {
  try {
    console.log('Cron job started: Checking for price drops...');
    await monitorPriceDrops();
    console.log('Cron job finished successfully.');
    return NextResponse.json({ success: true, message: 'Price drop check completed.' });
  } catch (error) {
    console.error('Error running cron job:', error);
    return NextResponse.json({ success: false, message: 'Cron job failed.' }, { status: 500 });
  }
}
