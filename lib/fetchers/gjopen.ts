import { Market } from '../types'

export async function fetchGJOpen(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://www.gjopen.com/challenges.json?status=open&page=1',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Predacle/1.0)',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      console.log(`GJOpen returned ${response.status}`)
      return []
    }

    const data = await response.json()
    const challenges = data.challenges || data || []

    if (!Array.isArray(challenges)) return []

    return challenges
      .filter((c: any) => c.name || c.title)
      .map((c: any) => ({
        id: `gjopen-${c.id}`,
        platform: 'gjopen' as any,
        question: c.name || c.title || '',
        probability: null,
        volume: null,
        volume_label: null,
        end_date: c.ends_at
          ? new Date(c.ends_at).toISOString().split('T')[0]
          : null,
        end_date_label: c.ends_at
          ? new Date(c.ends_at).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })
          : null,
        traders: c.forecaster_count || null,
        category: 'geopolitics',
        url: c.id
          ? `https://www.gjopen.com/challenges/${c.id}`
          : 'https://www.gjopen.com',
        status: 'active' as const,
        fetched_at: new Date().toISOString(),
      }))
  } catch (error) {
    console.error('GJOpen fetch error:', error)
    return []
  }
}