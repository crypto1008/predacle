export function inferCategory(question: string): string {
  const q = question.toLowerCase()

  // Crypto
  if (/bitcoin|btc|ethereum|eth|crypto|blockchain|solana|doge|dogecoin|token|usdc|usdt|defi|nft|web3|binance|coinbase|altcoin|memecoin|xrp|ripple|cardano|avalanche|polygon|matic|chainlink|uniswap|bnb|tron|litecoin|polkadot|shiba|pepe|sui|aptos|injective/.test(q))
    return 'crypto'

  // Politics — greatly expanded
  if (/trump|biden|harris|election|president|congress|senate|democrat|republican|vote|ballot|parliament|minister|government|legislation|iran|russia|ukraine|china|taiwan|israel|gaza|hamas|war|conflict|ceasefire|peace deal|peace agreement|sanctions|nato|united nations|prime minister|\bpm\b|chancellor|cabinet|foreign policy|diplomatic|regime|military|treaty|geopolit|starmer|macron|modi|putin|zelenskyy|netanyahu|erdogan|xi jinping|kim jong|supreme court|judiciary|referendum|impeach|coalition|immigration|border|inauguration|political|partisan|governor|mayor|ballot measure|wealth tax|tax reform|tax bill|freedom|liberty|constitution|democracy|authoritarian|dictatorship|coup/.test(q))
    return 'politics'

  // Sports — expanded
  if (/\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|soccer|football|basketball|baseball|tennis|golf|olympic|championship|league|cup|tournament|team|\bsport\b|sports|athlete|match|esport|esports|\bcs2\b|\blol\b|dota|valorant|fifa|wimbledon|premier|bundesliga|serie a|laliga|\bvs\b|versus|playoffs|semifinal|quarterfinal|grand prix|\bf1\b|formula|mma|ufc|boxing|wrestling|cricket|rugby|volleyball|hockey|ballon d|champions league|europa league|world cup|super bowl|stanley cup|nascar|grand slam|masters|open championship|ryder cup|tour de france|weight class|fight night|bout|knockout|submission|medal|gold medal/.test(q))
    return 'sports'

  // Economics — expanded
  if (/gdp|inflation|recession|\bfed\b|federal reserve|interest rate|unemployment|\bstock\b|nasdaq|dow jones|s&p 500|economy|economic|trade war|oil price|crude oil|\boil\b|commodity|commodities|\bgold\b|\bsilver\b|barrel|opec|energy price|gas price|dollar index|euro|yuan|currency|forex|bond yield|treasury|national debt|budget deficit|fiscal|monetary policy|minimum wage|gdp growth|supply chain|cpi|pce|quantitative|rate hike|rate cut|bank|lending|mortgage|housing market|real estate/.test(q))
    return 'economics'

  // Tech — expanded
  if (/\bai\b|artificial intelligence|gpt|openai|anthropic|claude|\btesla\b|apple inc|google|microsoft|meta\b|amazon|\btech\b|software|hardware|chip|semiconductor|robot|llm|gemini|grok|mistral|\bnvidia\b|\bamd\b|\bintel\b|spacex|neuralink|starlink|iphone|android|autonomous|self-driving|machine learning|deep learning|chatbot|language model|data center|cybersecurity|hack|breach|quantum computing|fusion energy|electric vehicle|\bev\b|battery/.test(q))
    return 'tech'

  // Entertainment
  if (/oscar|grammy|emmy|bafta|movie|film|music|album|celebrity|award|netflix|disney|streaming|box office|taylor swift|beyonce|drake|kanye|rihanna|super bowl halftime|eurovision|golden globe|blockbuster|sequel|series|season|episode/.test(q))
    return 'entertainment'

  // Science
  if (/climate|global warming|nasa|space|vaccine|health|covid|pandemic|cancer|fda|science|research|asteroid|mars|moon|nuclear|fusion energy|quantum|genome|crispr|gene editing|virus|outbreak|drug approval|clinical trial|hurricane|earthquake|natural disaster/.test(q))
    return 'science'

  return 'other'
}