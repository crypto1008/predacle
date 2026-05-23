import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({
        email: email.toLowerCase().trim(),
        subscribed_at: new Date().toISOString(),
        status: 'active',
      })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'Already subscribed' })
      }
      throw error
    }

    return NextResponse.json({ message: 'Subscribed successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}