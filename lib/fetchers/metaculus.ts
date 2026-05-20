import { Market } from '../types'

export async function fetchMetaculus(): Promise<Market[]> {
  const endpoints = [
    'https://api.metaculus.com/api2/questions/?status=open&limit=50&order_by=-activity',
    'https://www.metaculus.com/api2/questions/?status=open&limit=50&order_by=-activity',
    'https://api.metaculus.com/api2/questions/?has_group=false&status=open&limit=50',
  ]

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://www.metaculus.com/questions/',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  }

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { headers, cache: 'no-store' })

      if (!response.ok) {
        console.log(`Metaculus ${url} returned ${response.status}`)
        continue
      }

      const data = await response.json()
      const questions = data.results || data.objects || []

      if (questions.length === 0) continue

      console.log(`Metaculus: got ${questions.length} questions from ${url}`)

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
            end_date: resolveTime
              ? resolveTime.toISOString().split('T')[0]
              : null,
            end_date_label: resolveTime
              ? resolveTime.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : null,
            traders: q.number_of_predictions || null,
            category: q.categories?.[0]?.name || null,
            url: `https://www.metaculus.com${q.page_url || `/questions/${q.id}`}`,
            status: 'active' as const,
            fetched_at: new Date().toISOString(),
          }
        })
    } catch (error) {
      console.log(`Metaculus endpoint failed: ${url}`, error)
      continue
    }
  }

  console.error('Metaculus: all endpoints failed')
  return []
}