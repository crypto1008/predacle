import { NextResponse } from 'next/server'
import { getTopicOdds } from '@/lib/odds-data'
import { getOddsTopic } from '@/lib/odds-topics'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!getOddsTopic(slug)) return NextResponse.json({ error: 'Unknown topic' }, { status: 404 })
  try {
    const data = await getTopicOdds(slug)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
