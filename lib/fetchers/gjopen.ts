import { Market } from '../types'

export async function fetchGJOpen(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api2.gjopen.com/api/v1/challenges?status=open&per_page=50',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) throw new Error(`GJOpen error: ${response.status}`)
    const data = await response.json()
    const challenges = data.challenges || data || []

    return challenges
      .filter((c: any) => c.name || c.title)
      .map((c: any) => ({
        id: `gjopen-${c.id}`,
        platform: 'gjopen' as any,
        question: c.name || c.title,
        probability: null,
        volume: null,
        volume_label: null,
        end_date: c.ends_at ? new Date(c.ends_at).toISOString().split('T')[0] : null,
        end_date_label: c.ends_at
          ? new Date(c.ends_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : null,
        traders: c.forecaster_count || null,
        category: 'geopolitics',
        url: `https://www.gjopen.com/challenges/${c.id}`,
        status: 'active' as const,
        fetched_at: new Date().toISOString(),
      }))
  } catch (error) {
    console.error('GJOpen fetch error:', error)
    return []
  }
}