import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body?.email
    // Whitelist the source so callers can't write arbitrary values.
    // Footer form sends no source -> defaults to 'newsletter' (unchanged behaviour).
    const source = body?.source === 'pro_waitlist' ? 'pro_waitlist' : 'newsletter'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    const clean = email.toLowerCase().trim()

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({
        email: clean,
        subscribed_at: new Date().toISOString(),
        status: 'active',
        source,
      })

    if (error) {
      if (error.code === '23505') {
        // Already on the list. If they're now expressing Pro interest,
        // upgrade their tag so we don't lose that signal (never downgrade
        // an existing pro_waitlist row back to newsletter).
        if (source === 'pro_waitlist') {
          await supabaseAdmin
            .from('newsletter_subscribers')
            .update({ source: 'pro_waitlist' })
            .eq('email', clean)
        }
        return NextResponse.json({ message: 'Already subscribed' })
      }
      throw error
    }

    return NextResponse.json({ message: 'Subscribed successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
