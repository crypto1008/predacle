import { Market } from '../types'

export async function fetchMetaculus(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://www.metaculus.com/api2/questions/?format=json&limit=50&status=open',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 300 }
      }
    )
    if (!response.ok) throw new Error(`Metaculus error: ${response.status}`)
    const data = await response.json()
    const questions = data.results || data.objects || []

    return questions
      .filter((q: any) => q.title)
      .map((q: any) => {
        const prob =
          q.community_prediction?.full?.q2 ??
          q.metaculus_prediction?.full?.q2 ??
          null
        const resolveTime = q.resolve_time ? new Date(q.resolve_time) : null
        return {
          id: `metaculus-${q.id}`,
          platform: 'metaculus' as const,
          question: q.title,
          probability: prob,
          volume: null,
          volume_label: null,
          end_date: resolveTime ? resolveTime.toISOString().split('T')[0] : null,
          end_date_label: resolveTime
            ? resolveTime.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
          traders: q.number_of_predictions || null,
          category: q.categories?.[0]?.name || null,
          url: `https://www.metaculus.com${q.page_url || `/questions/${q.id}`}`,
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error) {
    console.error('Metaculus fetch error:', error)
    return []
  }
}