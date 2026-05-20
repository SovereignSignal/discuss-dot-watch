/**
 * Logo utility for fetching protocol logos from multiple sources
 * with fallback support.
 */

// Primary logo sources - ordered by reliability
const LOGO_SOURCES = {
  // Defillama - very stable, uses protocol names
  defillama: (name: string) => 
    `https://icons.llama.fi/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
  
  // Token Icons - GitHub hosted, stable
  tokenIcons: (symbol: string) =>
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`,
  
  // Cryptologos - sometimes unstable but good coverage
  cryptologos: (symbol: string) =>
    `https://cryptologos.cc/logos/${symbol.toLowerCase()}-logo.png`,
};

// Manual mappings for protocols with known working logos
// Using multiple reliable sources
export const PROTOCOL_LOGOS: Record<string, string> = {
  // L2 Protocols
  'arbitrum': 'https://icons.llama.fi/arbitrum.jpg',
  'optimism': 'https://icons.llama.fi/optimism.jpg',
  'zksync': 'https://icons.llama.fi/zksync-era.jpg',
  'zksync era': 'https://icons.llama.fi/zksync-era.jpg',
  'polygon': 'https://icons.llama.fi/polygon.jpg',
  'starknet': 'https://icons.llama.fi/starknet.jpg',
  'mantle': 'https://icons.llama.fi/mantle.jpg',
  'mode': 'https://icons.llama.fi/mode.jpg',
  'base': 'https://icons.llama.fi/base.jpg',
  'linea': 'https://icons.llama.fi/linea.jpg',
  'blast': 'https://icons.llama.fi/blast.jpg',
  
  // L1 Protocols
  'ethereum': 'https://icons.llama.fi/ethereum.jpg',
  'cosmos': 'https://icons.llama.fi/cosmos.jpg',
  'near': 'https://icons.llama.fi/near.jpg',
  'celestia': 'https://icons.llama.fi/celestia.jpg',
  'aptos': 'https://icons.llama.fi/aptos.jpg',
  'bnb': 'https://icons.llama.fi/bsc.jpg',
  'bnb chain': 'https://icons.llama.fi/bsc.jpg',
  'fantom': 'https://icons.llama.fi/fantom.jpg',
  'polkadot': 'https://icons.llama.fi/polkadot.jpg',
  'cardano': 'https://icons.llama.fi/cardano.jpg',
  'solana': 'https://icons.llama.fi/solana.jpg',
  'tezos': 'https://icons.llama.fi/tezos.jpg',
  'sui': 'https://icons.llama.fi/sui.jpg',
  'tron': 'https://icons.llama.fi/tron.jpg',
  'avalanche': 'https://icons.llama.fi/avalanche.jpg',
  
  // DeFi Lending
  'aave': 'https://icons.llama.fi/aave.jpg',
  'compound': 'https://icons.llama.fi/compound-finance.jpg',
  'makerdao': 'https://icons.llama.fi/makerdao.jpg',
  'sky': 'https://icons.llama.fi/sky-money.jpg',
  'sky-makerdao': 'https://icons.llama.fi/sky-money.jpg',
  'morpho': 'https://icons.llama.fi/morpho.jpg',
  'euler': 'https://icons.llama.fi/euler.jpg',
  'venus': 'https://icons.llama.fi/venus.jpg',
  'goldfinch': 'https://icons.llama.fi/goldfinch.jpg',
  'maple': 'https://icons.llama.fi/maple.jpg',
  'radiant': 'https://icons.llama.fi/radiant.jpg',
  'spark': 'https://icons.llama.fi/spark.jpg',
  
  // DeFi DEX
  'uniswap': 'https://icons.llama.fi/uniswap.jpg',
  'curve': 'https://icons.llama.fi/curve-finance.jpg',
  'curve finance': 'https://icons.llama.fi/curve-finance.jpg',
  'balancer': 'https://icons.llama.fi/balancer.jpg',
  'pancakeswap': 'https://icons.llama.fi/pancakeswap.jpg',
  'sushiswap': 'https://icons.llama.fi/sushi.jpg',
  'sushi': 'https://icons.llama.fi/sushi.jpg',
  'dydx': 'https://icons.llama.fi/dydx.jpg',
  'bancor': 'https://icons.llama.fi/bancor.jpg',
  '1inch': 'https://icons.llama.fi/1inch-network.jpg',
  'gmx': 'https://icons.llama.fi/gmx.jpg',
  
  // DeFi Staking
  'lido': 'https://icons.llama.fi/lido.jpg',
  'eigenlayer': 'https://icons.llama.fi/eigenlayer.jpg',
  'rocket pool': 'https://icons.llama.fi/rocket-pool.jpg',
  'rocketpool': 'https://icons.llama.fi/rocket-pool.jpg',
  'frax': 'https://icons.llama.fi/frax.jpg',
  
  // DeFi Other
  'yearn': 'https://icons.llama.fi/yearn-finance.jpg',
  'yearn finance': 'https://icons.llama.fi/yearn-finance.jpg',
  'instadapp': 'https://icons.llama.fi/instadapp.jpg',
  'centrifuge': 'https://icons.llama.fi/centrifuge.jpg',
  'angle': 'https://icons.llama.fi/angle.jpg',
  'reserve': 'https://icons.llama.fi/reserve.jpg',
  'convex': 'https://icons.llama.fi/convex-finance.jpg',
  
  // DAOs
  'ens': 'https://icons.llama.fi/ens.jpg',
  'gitcoin': 'https://icons.llama.fi/gitcoin.jpg',
  'gnosis': 'https://icons.llama.fi/gnosis.jpg',
  'gnosisdao': 'https://icons.llama.fi/gnosis.jpg',
  'apecoin': 'https://icons.llama.fi/apecoin.jpg',
  'nouns': 'https://icons.llama.fi/nouns.jpg',
  'decentraland': 'https://icons.llama.fi/decentraland.jpg',
  'treasure': 'https://icons.llama.fi/treasure.jpg',
  
  // Infrastructure
  'the graph': 'https://icons.llama.fi/the-graph.jpg',
  'graph': 'https://icons.llama.fi/the-graph.jpg',
  'safe': 'https://icons.llama.fi/safe.jpg',
  'safedao': 'https://icons.llama.fi/safe.jpg',
  'aragon': 'https://icons.llama.fi/aragon.jpg',
  'pocket network': 'https://icons.llama.fi/pocket-network.jpg',
  'wormhole': 'https://icons.llama.fi/wormhole.jpg',
  'livepeer': 'https://icons.llama.fi/livepeer.jpg',
  'hop': 'https://icons.llama.fi/hop-protocol.jpg',
  'hop protocol': 'https://icons.llama.fi/hop-protocol.jpg',
  'uma': 'https://icons.llama.fi/uma.jpg',
  'uma protocol': 'https://icons.llama.fi/uma.jpg',
  'chainlink': 'https://icons.llama.fi/chainlink.jpg',
  
  // Privacy
  'zcash': 'https://icons.llama.fi/zcash.jpg',
  'secret': 'https://icons.llama.fi/secret.jpg',
  'secret network': 'https://icons.llama.fi/secret.jpg',
  
  // AI & Crypto
  'fetch.ai': 'https://icons.llama.fi/fetch-ai.jpg',
  'fetch': 'https://icons.llama.fi/fetch-ai.jpg',
  'ocean': 'https://icons.llama.fi/ocean-protocol.jpg',
  'singularitynet': 'https://icons.llama.fi/singularitynet.jpg',
};

/**
 * Get logo URL for a protocol/forum name
 * Tries exact match first, then fuzzy match
 */
export function getProtocolLogo(name: string): string | undefined {
  const normalizedName = name.toLowerCase().trim();
  
  // Try exact match
  if (PROTOCOL_LOGOS[normalizedName]) {
    return PROTOCOL_LOGOS[normalizedName];
  }
  
  // Try partial match
  for (const [key, url] of Object.entries(PROTOCOL_LOGOS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return url;
    }
  }
  
  // Try Defillama as fallback (it has good coverage)
  return LOGO_SOURCES.defillama(normalizedName);
}

/**
 * Generate a fallback logo URL using Defillama
 */
export function getDefillamaLogo(name: string): string {
  return LOGO_SOURCES.defillama(name);
}
