export function inferCategory(question: string): string {
  const q = question.toLowerCase()

  if (/bitcoin|btc|ethereum|eth|crypto|blockchain|solana|doge|token|usdc|usdt|defi|nft|web3|binance|coinbase|altcoin|memecoin/.test(q))
    return 'crypto'

  if (/trump|biden|harris|election|president|congress|senate|democrat|republican|vote|ballot|parliament|minister|government|legislation/.test(q))
    return 'politics'

  if (/\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|soccer|football|basketball|baseball|tennis|golf|olympic|championship|league|cup|tournament|team|\bsport\b|sports|athlete|match|esport|fifa|wimbledon|premier|bundesliga|serie|laliga|\bvs\b|versus|playoffs|semifinal|quarterfinal|grand prix|formula/.test(q))
    return 'sports'

  if (/gdp|inflation|recession|\bfed\b|federal reserve|interest rate|unemployment|\bstock\b|nasdaq|dow|s&p|economy|economic|tariff|trade/.test(q))
    return 'economics'

  if (/\bai\b|gpt|openai|anthropic|tesla|apple|google|microsoft|meta|amazon|\btech\b|software|hardware|chip|semiconductor|robot/.test(q))
    return 'tech'

  if (/oscar|grammy|emmy|movie|film|music|album|celebrity|award|netflix|disney|streaming/.test(q))
    return 'entertainment'

  if (/climate|nasa|space|vaccine|health|covid|pandemic|cancer|fda|science|research|asteroid|mars|moon/.test(q))
    return 'science'

  return 'other'
}