import { NextResponse } from 'next/server'
import { getCalibration } from '@/lib/calibration'

export const dynamic = 'force-dynamic'

// Thin wrapper: all computation lives in lib/calibration.ts so the /track-record
// page can server-render the same numbers without an HTTP round-trip to itself.
export async function GET() {
  try {
    const result = await getCalibration()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to build calibration', detail: error?.message },
      { status: 500 },
    )
  }
}
