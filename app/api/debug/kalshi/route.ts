import { NextResponse } from 'next/server'
import { createSign } from 'crypto'

const BASE = 'https://api.elections.kalshi.com'

function getHeaders(path: string) {
  const keyId         = process.env.KALSHI_API_KEY_ID || ''
  const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY || ''
  const privateKey    = privateKeyRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()
  const timestamp     = Date.now().toString()
  const message       = `${timestamp}GET${path.split('?')[0]}`

  try {
    const sign = createSign('RSA-SHA256')
    sign.update(message)
    sign.end()
    const sig = sign.sign(privateKey, 'base64')
    return {
      'KALSHI-ACCESS-KEY':       keyId,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': sig,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    }
  } catch (e: any) {
    return {}
  }
}

export async function GET() {
  try {
    // Step 1: Fetch list of KXBTCD markets
    const listPath = '/trade-api/v2/markets?limit=3&status=open&series_ticker=KXBTCD'
    const listRes  = await fetch(`${BASE}${listPath}`, {
      headers: getHeaders(listPath), cache: 'no-store'
    })
    const listData = await listRes.json()
    const markets  = listData.markets || []

    if (markets.length === 0) {
      return NextResponse.json({ error: 'No KXBTCD markets found', listData })
    }

    const firstTicker = markets[0].ticker

    // Step 2: Fetch individual market
    const detailPath = `/trade-api/v2/markets/${firstTicker}`
    const detailRes  = await fetch(`${BASE}${detailPath}`, {
      headers: getHeaders(detailPath), cache: 'no-store'
    })
    const detailData = await detailRes.json()

    return NextResponse.json({
      list_market_fields:  Object.keys(markets[0]),
      list_market_sample:  markets[0],
      detail_market_fields: Object.keys(detailData.market || detailData),
      detail_market_sample: detailData.market || detailData,
      key_price_fields: {
        from_list: {
          yes_ask:    markets[0].yes_ask,
          yes_bid:    markets[0].yes_bid,
          last_price: markets[0].last_price,
          volume:     markets[0].volume,
        },
        from_detail: {
          yes_ask:    (detailData.market || detailData).yes_ask,
          yes_bid:    (detailData.market || detailData).yes_bid,
          last_price: (detailData.market || detailData).last_price,
          volume:     (detailData.market || detailData).volume,
        }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}