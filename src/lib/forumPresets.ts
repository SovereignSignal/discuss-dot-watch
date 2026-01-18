/**
 * Comprehensive directory of Discourse-based governance forums
 * organized by category and tier.
 *
 * Only Discourse-based forums are included as the API proxy
 * is designed to work with Discourse's API structure.
 */

export interface ForumPreset {
  name: string;
  url: string;
  categoryId?: number;
  description?: string;
  token?: string;
  tier: 1 | 2 | 3;
}

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  forums: ForumPreset[];
}

export const FORUM_CATEGORIES: ForumCategory[] = [
  {
    id: 'l2-protocols',
    name: 'Layer 2 Protocols',
    description: 'Ethereum scaling solutions and rollups',
    forums: [
      {
        name: 'Arbitrum',
        url: 'https://forum.arbitrum.foundation/',
        description: 'Leading Ethereum L2 with full DAO governance',
        token: 'ARB',
        tier: 1,
      },
      {
        name: 'Optimism',
        url: 'https://gov.optimism.io/',
        description: 'Bicameral governance with Token House + Citizens House',
        token: 'OP',
        tier: 1,
      },
      {
        name: 'zkSync Era',
        url: 'https://forum.zknation.io/',
        description: 'ZK Nation governance with Token Assembly and Security Council',
        token: 'ZK',
        tier: 1,
      },
      {
        name: 'Polygon',
        url: 'https://forum.polygon.technology/',
        description: 'PIPs governance with Protocol Council',
        token: 'POL',
        tier: 1,
      },
      {
        name: 'Starknet',
        url: 'https://community.starknet.io/',
        description: 'Builders Council + Token Holders governance',
        token: 'STRK',
        tier: 1,
      },
      {
        name: 'Scroll',
        url: 'https://forum.scroll.io/',
        description: 'Scroll DAO with Governance Council',
        token: 'SCR',
        tier: 1,
      },
      {
        name: 'Mantle',
        url: 'https://forum.mantle.xyz/',
        description: 'L2 with large treasury and Snapshot voting',
        token: 'MNT',
        tier: 2,
      },
      {
        name: 'Mode Network',
        url: 'https://forum.mode.network/',
        description: 'veToken gauge governance; Superchain member',
        token: 'MODE',
        tier: 2,
      },
      {
        name: 'Blast',
        url: 'https://forum.blast.io/',
        description: 'BLIPs with Progress Council and veto mechanisms',
        token: 'BLAST',
        tier: 2,
      },
    ],
  },
  {
    id: 'l1-protocols',
    name: 'Layer 1 Protocols',
    description: 'Base layer blockchain networks',
    forums: [
      {
        name: 'Ethereum Magicians',
        url: 'https://ethereum-magicians.org/',
        description: 'Fellowship of Ethereum Magicians for EIP discussions',
        token: 'ETH',
        tier: 1,
      },
      {
        name: 'Cosmos Hub',
        url: 'https://forum.cosmos.network/',
        description: 'On-chain governance proposals and community pool',
        token: 'ATOM',
        tier: 1,
      },
      {
        name: 'Near Protocol',
        url: 'https://gov.near.org/',
        description: 'NEAR Digital Collective governance; House of Stake',
        token: 'NEAR',
        tier: 1,
      },
      {
        name: 'Celestia',
        url: 'https://forum.celestia.org/',
        description: 'CIP discussions with rough consensus model',
        token: 'TIA',
        tier: 1,
      },
      {
        name: 'Aptos',
        url: 'https://forum.aptosfoundation.org/',
        description: 'AIPs governance with active voting participation',
        token: 'APT',
        tier: 2,
      },
      {
        name: 'BNB Chain',
        url: 'https://forum.bnbchain.org/',
        description: 'Build N Build forum with Tally on-chain votes',
        token: 'BNB',
        tier: 2,
      },
      {
        name: 'Fantom/Sonic',
        url: 'https://forum.fantom.network/',
        description: 'Migrating to Sonic network',
        token: 'FTM',
        tier: 2,
      },
      {
        name: 'Polkadot',
        url: 'https://forum.polkadot.network/',
        description: 'OpenGov referenda and parachain discussions; 400+ governance topics',
        token: 'DOT',
        tier: 1,
      },
      {
        name: 'Cardano',
        url: 'https://forum.cardano.org/',
        description: 'CIPs and Catalyst project governance',
        token: 'ADA',
        tier: 1,
      },
      {
        name: 'Solana',
        url: 'https://forum.solana.com/',
        description: 'SIMD proposals and validator policies; on-chain voting',
        token: 'SOL',
        tier: 1,
      },
      {
        name: 'Tezos Agora',
        url: 'https://forum.tezosagora.org/',
        description: 'Protocol amendments; 69+ on-chain proposals discussed',
        token: 'XTZ',
        tier: 2,
      },
      {
        name: 'Sui',
        url: 'https://forums.sui.io/',
        description: 'Developer forum; governance evolving',
        token: 'SUI',
        tier: 3,
      },
      {
        name: 'Tron',
        url: 'https://forum.trondao.org/',
        description: 'Super Representative governance',
        token: 'TRX',
        tier: 3,
      },
    ],
  },
  {
    id: 'defi-lending',
    name: 'DeFi - Lending & Borrowing',
    description: 'Lending protocols and money markets',
    forums: [
      {
        name: 'Aave',
        url: 'https://governance.aave.com/',
        categoryId: 4,
        description: 'Largest DeFi lending protocol; highly active governance',
        token: 'AAVE',
        tier: 1,
      },
      {
        name: 'Compound',
        url: 'https://www.comp.xyz/',
        description: 'Pioneer lending protocol with Governor Bravo',
        token: 'COMP',
        tier: 1,
      },
      {
        name: 'Sky (MakerDAO)',
        url: 'https://forum.sky.money/',
        description: 'Rebranded from Maker; Endgame transition discussions',
        token: 'MKR',
        tier: 1,
      },
      {
        name: 'MakerDAO (Legacy)',
        url: 'https://forum.makerdao.com/',
        description: 'Original Maker forum; MIPs, DAI policy, risk parameters',
        token: 'MKR',
        tier: 1,
      },
      {
        name: 'Morpho',
        url: 'https://forum.morpho.org/',
        description: 'Lending optimization and vault curator discussions',
        token: 'MORPHO',
        tier: 2,
      },
      {
        name: 'Euler Finance',
        url: 'https://forum.euler.finance/',
        description: 'Modular lending with eIP risk parameters',
        token: 'EUL',
        tier: 2,
      },
      {
        name: 'Venus Protocol',
        url: 'https://community.venus.io/',
        description: 'BNB Chain money market',
        token: 'XVS',
        tier: 2,
      },
      {
        name: 'Goldfinch',
        url: 'https://gov.goldfinch.finance/',
        description: 'Emerging market lending',
        token: 'GFI',
        tier: 3,
      },
      {
        name: 'Maple Finance',
        url: 'https://community.maple.finance/',
        description: 'Institutional on-chain lending',
        token: 'MPL',
        tier: 3,
      },
      {
        name: 'Inverse Finance',
        url: 'https://forum.inverse.finance/',
        description: 'Fixed-rate lending; DOLA stablecoin',
        token: 'INV',
        tier: 3,
      },
      {
        name: 'Radiant Capital',
        url: 'https://community.radiant.capital/',
        description: 'Omnichain money market',
        token: 'RDNT',
        tier: 3,
      },
    ],
  },
  {
    id: 'defi-dex',
    name: 'DeFi - DEX & AMMs',
    description: 'Decentralized exchanges and automated market makers',
    forums: [
      {
        name: 'Uniswap',
        url: 'https://gov.uniswap.org/',
        description: 'Leading DEX with mature multi-phase governance',
        token: 'UNI',
        tier: 1,
      },
      {
        name: 'Curve Finance',
        url: 'https://gov.curve.finance/',
        description: 'Stableswap AMM; gauge voting and Curve Wars',
        token: 'CRV',
        tier: 1,
      },
      {
        name: 'Balancer',
        url: 'https://forum.balancer.fi/',
        description: 'Programmable AMM with veBAL gauge voting',
        token: 'BAL',
        tier: 2,
      },
      {
        name: 'PancakeSwap',
        url: 'https://forum.pancakeswap.finance/',
        description: 'Leading BNB Chain DEX; CAKE emissions governance',
        token: 'CAKE',
        tier: 2,
      },
      {
        name: 'SushiSwap',
        url: 'https://forum.sushi.com/',
        description: 'Multichain DEX; governance restructuring',
        token: 'SUSHI',
        tier: 2,
      },
      {
        name: 'dYdX',
        url: 'https://dydx.forum/',
        description: 'Decentralized perpetuals; V4 chain governance',
        token: 'DYDX',
        tier: 1,
      },
      {
        name: 'Bancor',
        url: 'https://gov.bancor.network/',
        description: 'Liquidity protocol; whitelisting assets and treasury management',
        token: 'BNT',
        tier: 2,
      },
      {
        name: '1inch',
        url: 'https://gov.1inch.io/',
        description: 'DEX aggregator with 1IP proposals',
        token: '1INCH',
        tier: 3,
      },
    ],
  },
  {
    id: 'defi-staking',
    name: 'DeFi - Staking & Restaking',
    description: 'Liquid staking and restaking protocols',
    forums: [
      {
        name: 'Lido Finance',
        url: 'https://research.lido.fi/',
        description: 'Largest liquid staking protocol',
        token: 'LDO',
        tier: 1,
      },
      {
        name: 'EigenLayer',
        url: 'https://forum.eigenlayer.xyz/',
        description: 'Restaking protocol; AVS governance discussions',
        token: 'EIGEN',
        tier: 1,
      },
      {
        name: 'Rocket Pool',
        url: 'https://dao.rocketpool.net/',
        description: 'Decentralized ETH staking with roadmap governance',
        token: 'RPL',
        tier: 2,
      },
    ],
  },
  {
    id: 'defi-other',
    name: 'DeFi - Stablecoins & Other',
    description: 'Stablecoins, RWA, yield aggregators, and other DeFi protocols',
    forums: [
      {
        name: 'Yearn Finance',
        url: 'https://gov.yearn.fi/',
        description: 'Yield aggregator; YIP proposals and vault strategies',
        token: 'YFI',
        tier: 1,
      },
      {
        name: 'Frax Finance',
        url: 'https://gov.frax.finance/',
        description: 'Fractional stablecoin with FIP proposals',
        token: 'FXS',
        tier: 2,
      },
      {
        name: 'Instadapp/Fluid',
        url: 'https://gov.instadapp.io/',
        description: 'DeFi management and Fluid lending',
        token: 'INST',
        tier: 2,
      },
      {
        name: 'Centrifuge',
        url: 'https://gov.centrifuge.io/',
        description: 'RWA tokenization; $700M+ financed',
        token: 'CFG',
        tier: 3,
      },
      {
        name: 'Angle Protocol',
        url: 'https://gov.angle.money/',
        description: 'Euro stablecoin governance',
        token: 'ANGLE',
        tier: 3,
      },
      {
        name: 'Reserve Protocol',
        url: 'https://forum.reserve.org/',
        description: 'Permissionless stablecoin issuance',
        token: 'RSR',
        tier: 3,
      },
    ],
  },
  {
    id: 'major-daos',
    name: 'Major DAOs',
    description: 'High-profile decentralized autonomous organizations',
    forums: [
      {
        name: 'ENS',
        url: 'https://discuss.ens.domains/',
        description: 'Ethereum Name Service; working group coordination',
        token: 'ENS',
        tier: 1,
      },
      {
        name: 'Gitcoin',
        url: 'https://gov.gitcoin.co/',
        description: 'Public goods funding and grants program',
        token: 'GTC',
        tier: 1,
      },
      {
        name: 'GnosisDAO',
        url: 'https://forum.gnosis.io/',
        description: 'Gnosis Chain and ecosystem governance',
        token: 'GNO',
        tier: 1,
      },
      {
        name: 'ApeCoin DAO',
        url: 'https://forum.apecoin.com/',
        description: 'BAYC universe; AIPs for ecosystem fund',
        token: 'APE',
        tier: 1,
      },
      {
        name: 'Nouns DAO',
        url: 'https://discourse.nouns.wtf/',
        description: 'NFT governance; 1 Noun = 1 vote',
        token: 'NOUN',
        tier: 1,
      },
      {
        name: 'Decentraland',
        url: 'https://forum.decentraland.org/',
        description: 'Metaverse governance',
        token: 'MANA',
        tier: 2,
      },
      {
        name: 'Treasure DAO',
        url: 'https://forum.treasure.lol/',
        description: 'Gaming ecosystem on Arbitrum',
        token: 'MAGIC',
        tier: 3,
      },
      {
        name: 'BanklessDAO',
        url: 'https://forum.bankless.community/',
        description: 'Media DAO; rebranded to Black Flag',
        token: 'BANK',
        tier: 3,
      },
    ],
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure & Tooling',
    description: 'Protocol infrastructure, oracles, and developer tools',
    forums: [
      {
        name: 'The Graph',
        url: 'https://forum.thegraph.com/',
        description: 'Indexing protocol with GIP governance',
        token: 'GRT',
        tier: 2,
      },
      {
        name: 'SafeDAO',
        url: 'https://forum.safe.global/',
        description: 'Multisig infrastructure governance',
        token: 'SAFE',
        tier: 2,
      },
      {
        name: 'Aragon',
        url: 'https://forum.aragon.org/',
        description: 'DAO infrastructure and tooling',
        token: 'ANT',
        tier: 2,
      },
      {
        name: 'Pocket Network',
        url: 'https://forum.pokt.network/',
        description: 'Decentralized RPC with PoP governance',
        token: 'POKT',
        tier: 2,
      },
      {
        name: 'Wormhole',
        url: 'https://forum.wormhole.com/',
        description: 'Cross-chain messaging with MultiGov',
        token: 'W',
        tier: 2,
      },
      {
        name: 'Radworks',
        url: 'https://community.radworks.org/',
        description: 'Decentralized code collaboration',
        token: 'RAD',
        tier: 2,
      },
      {
        name: 'Livepeer',
        url: 'https://forum.livepeer.org/',
        description: 'Decentralized video transcoding',
        token: 'LPT',
        tier: 2,
      },
      {
        name: 'Hop Protocol',
        url: 'https://forum.hop.exchange/',
        description: 'Bridge protocol with HIP proposals',
        token: 'HOP',
        tier: 2,
      },
      {
        name: 'UMA Protocol',
        url: 'https://discourse.uma.xyz/',
        description: 'Optimistic oracle with UMIP governance',
        token: 'UMA',
        tier: 2,
      },
      {
        name: 'Index Coop',
        url: 'https://gov.indexcoop.com/',
        description: 'Structured DeFi products',
        token: 'INDEX',
        tier: 2,
      },
    ],
  },
  {
    id: 'privacy',
    name: 'Privacy Protocols',
    description: 'Privacy-focused blockchain networks',
    forums: [
      {
        name: 'Zcash',
        url: 'https://forum.zcashcommunity.com/',
        description: 'Primary ZEC governance; ZIP 1014 development fund',
        token: 'ZEC',
        tier: 3,
      },
      {
        name: 'Secret Network',
        url: 'https://forum.scrt.network/',
        description: 'Privacy blockchain; weekly governance meetings',
        token: 'SCRT',
        tier: 3,
      },
      {
        name: 'Aztec',
        url: 'https://discourse.aztec.network/',
        description: 'ZK-privacy L2; sequencer signaling votes',
        token: 'AZTEC',
        tier: 3,
      },
    ],
  },
  {
    id: 'ai-crypto',
    name: 'AI & Crypto',
    description: 'Decentralized AI and crypto-AI hybrid projects',
    forums: [
      {
        name: 'Numerai',
        url: 'https://forum.numer.ai/',
        description: 'AI hedge fund and data scientist tournaments',
        token: 'NMR',
        tier: 2,
      },
      {
        name: 'Phala Network',
        url: 'https://forum.phala.network/',
        description: 'Confidential cloud computing; TEE-based AI',
        token: 'PHA',
        tier: 3,
      },
      {
        name: 'Fetch.ai',
        url: 'https://forum.fetch.ai/',
        description: 'Autonomous agents; ASI Alliance governance',
        token: 'FET',
        tier: 2,
      },
    ],
  },
  {
    id: 'ai-developer',
    name: 'AI Developer Communities',
    description: 'AI/ML developer forums and communities',
    forums: [
      {
        name: 'OpenAI Community',
        url: 'https://community.openai.com/',
        description: 'Primary API developer forum for OpenAI',
        tier: 1,
      },
      {
        name: 'Hugging Face',
        url: 'https://discuss.huggingface.co/',
        description: 'Open-source ML hub; Transformers, Spaces',
        tier: 1,
      },
      {
        name: 'PyTorch',
        url: 'https://discuss.pytorch.org/',
        description: 'Official PyTorch community',
        tier: 1,
      },
      {
        name: 'PyTorch Dev',
        url: 'https://dev-discuss.pytorch.org/',
        description: 'Core PyTorch development governance',
        tier: 2,
      },
      {
        name: 'LangChain',
        url: 'https://forum.langchain.com/',
        description: 'LLM application development',
        tier: 2,
      },
      {
        name: 'Google AI',
        url: 'https://discuss.ai.google.dev/',
        description: 'Gemini, TensorFlow, Google AI tools',
        tier: 2,
      },
    ],
  },
  {
    id: 'governance-meta',
    name: 'Governance Meta',
    description: 'DAO tooling and governance discussion forums',
    forums: [
      {
        name: 'DAOtalk',
        url: 'https://daotalk.org/',
        description: 'DAOstack ecosystem discussions',
        tier: 3,
      },
    ],
  },
];

/**
 * Flat list of all forum presets for backwards compatibility
 */
export const ALL_FORUM_PRESETS: ForumPreset[] = FORUM_CATEGORIES.flatMap(
  (category) => category.forums
);

/**
 * Get forums by tier
 */
export function getForumsByTier(tier: 1 | 2 | 3): ForumPreset[] {
  return ALL_FORUM_PRESETS.filter((forum) => forum.tier === tier);
}

/**
 * Get forums by category ID
 */
export function getForumsByCategory(categoryId: string): ForumPreset[] {
  const category = FORUM_CATEGORIES.find((c) => c.id === categoryId);
  return category?.forums ?? [];
}

/**
 * Get total forum count
 */
export function getTotalForumCount(): number {
  return ALL_FORUM_PRESETS.length;
}

/**
 * Search forums by name or description
 */
export function searchForums(query: string): ForumPreset[] {
  const lowerQuery = query.toLowerCase();
  return ALL_FORUM_PRESETS.filter(
    (forum) =>
      forum.name.toLowerCase().includes(lowerQuery) ||
      forum.description?.toLowerCase().includes(lowerQuery) ||
      forum.token?.toLowerCase().includes(lowerQuery)
  );
}
