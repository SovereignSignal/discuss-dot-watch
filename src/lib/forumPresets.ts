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
  logoUrl?: string;
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
        logoUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
        tier: 1,
      },
      {
        name: 'Optimism',
        url: 'https://gov.optimism.io/',
        description: 'Bicameral governance with Token House + Citizens House',
        token: 'OP',
        logoUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
        tier: 1,
      },
      {
        name: 'zkSync Era',
        url: 'https://forum.zknation.io/',
        description: 'ZK Nation governance with Token Assembly and Security Council',
        token: 'ZK',
        logoUrl: 'https://cryptologos.cc/logos/zksync-zk-logo.png',
        tier: 1,
      },
      {
        name: 'Polygon',
        url: 'https://forum.polygon.technology/',
        description: 'PIPs governance with Protocol Council',
        token: 'POL',
        logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
        tier: 1,
      },
      {
        name: 'Starknet',
        url: 'https://community.starknet.io/',
        description: 'Builders Council + Token Holders governance',
        token: 'STRK',
        logoUrl: 'https://cryptologos.cc/logos/starknet-token-strk-logo.png',
        tier: 1,
      },
      {
        name: 'Scroll',
        url: 'https://forum.scroll.io/',
        description: 'Scroll DAO with Governance Council',
        token: 'SCR',
        logoUrl: 'https://assets.coingecko.com/coins/images/40162/small/scroll.jpg',
        tier: 1,
      },
      {
        name: 'Mantle',
        url: 'https://forum.mantle.xyz/',
        description: 'L2 with large treasury and Snapshot voting',
        token: 'MNT',
        logoUrl: 'https://assets.coingecko.com/coins/images/30980/small/token-logo.png',
        tier: 2,
      },
      {
        name: 'Mode Network',
        url: 'https://forum.mode.network/',
        description: 'veToken gauge governance; Superchain member',
        token: 'MODE',
        logoUrl: 'https://assets.coingecko.com/coins/images/36735/small/mode.jpeg',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
        tier: 1,
      },
      {
        name: 'Cosmos Hub',
        url: 'https://forum.cosmos.network/',
        description: 'On-chain governance proposals and community pool',
        token: 'ATOM',
        logoUrl: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
        tier: 1,
      },
      {
        name: 'Near Protocol',
        url: 'https://gov.near.org/',
        description: 'NEAR Digital Collective governance; House of Stake',
        token: 'NEAR',
        logoUrl: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
        tier: 1,
      },
      {
        name: 'Celestia',
        url: 'https://forum.celestia.org/',
        description: 'CIP discussions with rough consensus model',
        token: 'TIA',
        logoUrl: 'https://assets.coingecko.com/coins/images/31967/small/tia.jpg',
        tier: 1,
      },
      {
        name: 'Aptos',
        url: 'https://forum.aptosfoundation.org/',
        description: 'AIPs governance with active voting participation',
        token: 'APT',
        logoUrl: 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
        tier: 2,
      },
      {
        name: 'BNB Chain',
        url: 'https://forum.bnbchain.org/',
        description: 'Build N Build forum with Tally on-chain votes',
        token: 'BNB',
        logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
        tier: 2,
      },
      {
        name: 'Fantom/Sonic',
        url: 'https://forum.fantom.network/',
        description: 'Migrating to Sonic network',
        token: 'FTM',
        logoUrl: 'https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png',
        tier: 2,
      },
      {
        name: 'Polkadot',
        url: 'https://forum.polkadot.network/',
        description: 'OpenGov referenda and parachain discussions; 400+ governance topics',
        token: 'DOT',
        logoUrl: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
        tier: 1,
      },
      {
        name: 'Cardano',
        url: 'https://forum.cardano.org/',
        description: 'CIPs and Catalyst project governance',
        token: 'ADA',
        logoUrl: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
        tier: 1,
      },
      {
        name: 'Solana',
        url: 'https://forum.solana.com/',
        description: 'SIMD proposals and validator policies; on-chain voting',
        token: 'SOL',
        logoUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
        tier: 1,
      },
      {
        name: 'Tezos Agora',
        url: 'https://forum.tezosagora.org/',
        description: 'Protocol amendments; 69+ on-chain proposals discussed',
        token: 'XTZ',
        logoUrl: 'https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png',
        tier: 2,
      },
      {
        name: 'Sui',
        url: 'https://forums.sui.io/',
        description: 'Developer forum; governance evolving',
        token: 'SUI',
        logoUrl: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
        tier: 3,
      },
      {
        name: 'Tron',
        url: 'https://forum.trondao.org/',
        description: 'Super Representative governance',
        token: 'TRX',
        logoUrl: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
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
        logoUrl: 'https://cryptologos.cc/logos/aave-aave-logo.png',
        tier: 1,
      },
      {
        name: 'Compound',
        url: 'https://www.comp.xyz/',
        description: 'Pioneer lending protocol with Governor Bravo',
        token: 'COMP',
        logoUrl: 'https://assets.coingecko.com/coins/images/10775/small/COMP.png',
        tier: 1,
      },
      {
        name: 'Sky (MakerDAO)',
        url: 'https://forum.sky.money/',
        description: 'Rebranded from Maker; Endgame transition discussions',
        token: 'MKR',
        logoUrl: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
        tier: 1,
      },
      {
        name: 'MakerDAO (Legacy)',
        url: 'https://forum.makerdao.com/',
        description: 'Original Maker forum; MIPs, DAI policy, risk parameters',
        token: 'MKR',
        logoUrl: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
        tier: 1,
      },
      {
        name: 'Morpho',
        url: 'https://forum.morpho.org/',
        description: 'Lending optimization and vault curator discussions',
        token: 'MORPHO',
        logoUrl: 'https://assets.coingecko.com/coins/images/29837/small/morpho-token-icon.png',
        tier: 2,
      },
      {
        name: 'Euler Finance',
        url: 'https://forum.euler.finance/',
        description: 'Modular lending with eIP risk parameters',
        token: 'EUL',
        logoUrl: 'https://assets.coingecko.com/coins/images/26149/small/YCvKDfl8_400x400.jpeg',
        tier: 2,
      },
      {
        name: 'Venus Protocol',
        url: 'https://community.venus.io/',
        description: 'BNB Chain money market',
        token: 'XVS',
        logoUrl: 'https://assets.coingecko.com/coins/images/12677/small/download.jpg',
        tier: 2,
      },
      {
        name: 'Goldfinch',
        url: 'https://gov.goldfinch.finance/',
        description: 'Emerging market lending',
        token: 'GFI',
        logoUrl: 'https://assets.coingecko.com/coins/images/19081/small/GOLDFINCH.png',
        tier: 3,
      },
      {
        name: 'Maple Finance',
        url: 'https://community.maple.finance/',
        description: 'Institutional on-chain lending',
        token: 'MPL',
        logoUrl: 'https://assets.coingecko.com/coins/images/14097/small/photo_2021-05-03_14.20.41.jpeg',
        tier: 3,
      },
      {
        name: 'Inverse Finance',
        url: 'https://forum.inverse.finance/',
        description: 'Fixed-rate lending; DOLA stablecoin',
        token: 'INV',
        logoUrl: 'https://assets.coingecko.com/coins/images/14205/small/inverse_finance.jpg',
        tier: 3,
      },
      {
        name: 'Radiant Capital',
        url: 'https://community.radiant.capital/',
        description: 'Omnichain money market',
        token: 'RDNT',
        logoUrl: 'https://assets.coingecko.com/coins/images/26536/small/Radiant-Logo-200x200.png',
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
        logoUrl: 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
        tier: 1,
      },
      {
        name: 'Curve Finance',
        url: 'https://gov.curve.finance/',
        description: 'Stableswap AMM; gauge voting and Curve Wars',
        token: 'CRV',
        logoUrl: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
        tier: 1,
      },
      {
        name: 'Balancer',
        url: 'https://forum.balancer.fi/',
        description: 'Programmable AMM with veBAL gauge voting',
        token: 'BAL',
        logoUrl: 'https://assets.coingecko.com/coins/images/11683/small/Balancer.png',
        tier: 2,
      },
      {
        name: 'PancakeSwap',
        url: 'https://forum.pancakeswap.finance/',
        description: 'Leading BNB Chain DEX; CAKE emissions governance',
        token: 'CAKE',
        logoUrl: 'https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo_%281%29.png',
        tier: 2,
      },
      {
        name: 'SushiSwap',
        url: 'https://forum.sushi.com/',
        description: 'Multichain DEX; governance restructuring',
        token: 'SUSHI',
        logoUrl: 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png',
        tier: 2,
      },
      {
        name: 'dYdX',
        url: 'https://dydx.forum/',
        description: 'Decentralized perpetuals; V4 chain governance',
        token: 'DYDX',
        logoUrl: 'https://assets.coingecko.com/coins/images/17500/small/hjnIm9bV.jpg',
        tier: 1,
      },
      {
        name: 'Bancor',
        url: 'https://gov.bancor.network/',
        description: 'Liquidity protocol; whitelisting assets and treasury management',
        token: 'BNT',
        logoUrl: 'https://assets.coingecko.com/coins/images/736/small/bancor-bnt.png',
        tier: 2,
      },
      {
        name: '1inch',
        url: 'https://gov.1inch.io/',
        description: 'DEX aggregator with 1IP proposals',
        token: '1INCH',
        logoUrl: 'https://assets.coingecko.com/coins/images/13469/small/1inch-token.png',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png',
        tier: 1,
      },
      {
        name: 'EigenLayer',
        url: 'https://forum.eigenlayer.xyz/',
        description: 'Restaking protocol; AVS governance discussions',
        token: 'EIGEN',
        logoUrl: 'https://assets.coingecko.com/coins/images/37540/small/eigen.jpg',
        tier: 1,
      },
      {
        name: 'Rocket Pool',
        url: 'https://dao.rocketpool.net/',
        description: 'Decentralized ETH staking with roadmap governance',
        token: 'RPL',
        logoUrl: 'https://assets.coingecko.com/coins/images/2090/small/rocket_pool_%28RPL%29.png',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/11849/small/yearn.jpg',
        tier: 1,
      },
      {
        name: 'Frax Finance',
        url: 'https://gov.frax.finance/',
        description: 'Fractional stablecoin with FIP proposals',
        token: 'FXS',
        logoUrl: 'https://assets.coingecko.com/coins/images/13423/small/Frax_Shares_icon.png',
        tier: 2,
      },
      {
        name: 'Instadapp/Fluid',
        url: 'https://gov.instadapp.io/',
        description: 'DeFi management and Fluid lending',
        token: 'INST',
        logoUrl: 'https://assets.coingecko.com/coins/images/14688/small/30hfmgJK_400x400.jpg',
        tier: 2,
      },
      {
        name: 'Centrifuge',
        url: 'https://gov.centrifuge.io/',
        description: 'RWA tokenization; $700M+ financed',
        token: 'CFG',
        logoUrl: 'https://assets.coingecko.com/coins/images/13539/small/centrifuge-logo.png',
        tier: 3,
      },
      {
        name: 'Angle Protocol',
        url: 'https://gov.angle.money/',
        description: 'Euro stablecoin governance',
        token: 'ANGLE',
        logoUrl: 'https://assets.coingecko.com/coins/images/19060/small/ANGLE_Token-light.png',
        tier: 3,
      },
      {
        name: 'Reserve Protocol',
        url: 'https://forum.reserve.org/',
        description: 'Permissionless stablecoin issuance',
        token: 'RSR',
        logoUrl: 'https://assets.coingecko.com/coins/images/8365/small/rsr.png',
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
        logoUrl: 'https://cryptologos.cc/logos/ethereum-name-service-ens-logo.png',
        tier: 1,
      },
      {
        name: 'Gitcoin',
        url: 'https://gov.gitcoin.co/',
        description: 'Public goods funding and grants program',
        token: 'GTC',
        logoUrl: 'https://assets.coingecko.com/coins/images/15810/small/gitcoin.png',
        tier: 1,
      },
      {
        name: 'GnosisDAO',
        url: 'https://forum.gnosis.io/',
        description: 'Gnosis Chain and ecosystem governance',
        token: 'GNO',
        logoUrl: 'https://assets.coingecko.com/coins/images/662/small/logo_square_simple_300px.png',
        tier: 1,
      },
      {
        name: 'ApeCoin DAO',
        url: 'https://forum.apecoin.com/',
        description: 'BAYC universe; AIPs for ecosystem fund',
        token: 'APE',
        logoUrl: 'https://assets.coingecko.com/coins/images/24383/small/apecoin.jpg',
        tier: 1,
      },
      {
        name: 'Nouns DAO',
        url: 'https://discourse.nouns.wtf/',
        description: 'NFT governance; 1 Noun = 1 vote',
        token: 'NOUN',
        logoUrl: 'https://assets.coingecko.com/coins/images/22427/small/nouns.png',
        tier: 1,
      },
      {
        name: 'Decentraland',
        url: 'https://forum.decentraland.org/',
        description: 'Metaverse governance',
        token: 'MANA',
        logoUrl: 'https://assets.coingecko.com/coins/images/878/small/decentraland-mana.png',
        tier: 2,
      },
      {
        name: 'Treasure DAO',
        url: 'https://forum.treasure.lol/',
        description: 'Gaming ecosystem on Arbitrum',
        token: 'MAGIC',
        logoUrl: 'https://assets.coingecko.com/coins/images/18623/small/magic.png',
        tier: 3,
      },
      {
        name: 'BanklessDAO',
        url: 'https://forum.bankless.community/',
        description: 'Media DAO; rebranded to Black Flag',
        token: 'BANK',
        logoUrl: 'https://assets.coingecko.com/coins/images/15227/small/bankless.jpg',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/13397/small/Graph_Token.png',
        tier: 2,
      },
      {
        name: 'SafeDAO',
        url: 'https://forum.safe.global/',
        description: 'Multisig infrastructure governance',
        token: 'SAFE',
        logoUrl: 'https://assets.coingecko.com/coins/images/28032/small/safe.png',
        tier: 2,
      },
      {
        name: 'Aragon',
        url: 'https://forum.aragon.org/',
        description: 'DAO infrastructure and tooling',
        token: 'ANT',
        logoUrl: 'https://assets.coingecko.com/coins/images/681/small/Avatar_Circle_Orange.png',
        tier: 2,
      },
      {
        name: 'Pocket Network',
        url: 'https://forum.pokt.network/',
        description: 'Decentralized RPC with PoP governance',
        token: 'POKT',
        logoUrl: 'https://assets.coingecko.com/coins/images/22506/small/pokt.png',
        tier: 2,
      },
      {
        name: 'Wormhole',
        url: 'https://forum.wormhole.com/',
        description: 'Cross-chain messaging with MultiGov',
        token: 'W',
        logoUrl: 'https://assets.coingecko.com/coins/images/35087/small/wormhole.jpg',
        tier: 2,
      },
      {
        name: 'Radworks',
        url: 'https://community.radworks.org/',
        description: 'Decentralized code collaboration',
        token: 'RAD',
        logoUrl: 'https://assets.coingecko.com/coins/images/14013/small/radicle.png',
        tier: 2,
      },
      {
        name: 'Livepeer',
        url: 'https://forum.livepeer.org/',
        description: 'Decentralized video transcoding',
        token: 'LPT',
        logoUrl: 'https://assets.coingecko.com/coins/images/7137/small/logo-circle-green.png',
        tier: 2,
      },
      {
        name: 'Hop Protocol',
        url: 'https://forum.hop.exchange/',
        description: 'Bridge protocol with HIP proposals',
        token: 'HOP',
        logoUrl: 'https://assets.coingecko.com/coins/images/25445/small/hop.png',
        tier: 2,
      },
      {
        name: 'UMA Protocol',
        url: 'https://discourse.uma.xyz/',
        description: 'Optimistic oracle with UMIP governance',
        token: 'UMA',
        logoUrl: 'https://assets.coingecko.com/coins/images/10951/small/UMA.png',
        tier: 2,
      },
      {
        name: 'Index Coop',
        url: 'https://gov.indexcoop.com/',
        description: 'Structured DeFi products',
        token: 'INDEX',
        logoUrl: 'https://assets.coingecko.com/coins/images/12729/small/index.png',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/486/small/circle-zcash-color.png',
        tier: 3,
      },
      {
        name: 'Secret Network',
        url: 'https://forum.scrt.network/',
        description: 'Privacy blockchain; weekly governance meetings',
        token: 'SCRT',
        logoUrl: 'https://assets.coingecko.com/coins/images/11871/small/Secret.png',
        tier: 3,
      },
      {
        name: 'Aztec',
        url: 'https://discourse.aztec.network/',
        description: 'ZK-privacy L2; sequencer signaling votes',
        token: 'AZTEC',
        logoUrl: 'https://assets.coingecko.com/coins/images/54133/small/aztec.jpg',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/752/small/numeraire.png',
        tier: 2,
      },
      {
        name: 'Phala Network',
        url: 'https://forum.phala.network/',
        description: 'Confidential cloud computing; TEE-based AI',
        token: 'PHA',
        logoUrl: 'https://assets.coingecko.com/coins/images/12451/small/phala.png',
        tier: 3,
      },
      {
        name: 'Fetch.ai',
        url: 'https://forum.fetch.ai/',
        description: 'Autonomous agents; ASI Alliance governance',
        token: 'FET',
        logoUrl: 'https://assets.coingecko.com/coins/images/5681/small/Fetch.jpg',
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
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/200px-OpenAI_Logo.svg.png',
        tier: 1,
      },
      {
        name: 'Hugging Face',
        url: 'https://discuss.huggingface.co/',
        description: 'Open-source ML hub; Transformers, Spaces',
        logoUrl: 'https://huggingface.co/datasets/huggingface/brand-assets/resolve/main/hf-logo.png',
        tier: 1,
      },
      {
        name: 'PyTorch',
        url: 'https://discuss.pytorch.org/',
        description: 'Official PyTorch community',
        logoUrl: 'https://pytorch.org/assets/images/pytorch-logo.png',
        tier: 1,
      },
      {
        name: 'PyTorch Dev',
        url: 'https://dev-discuss.pytorch.org/',
        description: 'Core PyTorch development governance',
        logoUrl: 'https://pytorch.org/assets/images/pytorch-logo.png',
        tier: 2,
      },
      {
        name: 'LangChain',
        url: 'https://forum.langchain.com/',
        description: 'LLM application development',
        logoUrl: 'https://avatars.githubusercontent.com/u/126733545',
        tier: 2,
      },
      {
        name: 'Google AI',
        url: 'https://discuss.ai.google.dev/',
        description: 'Gemini, TensorFlow, Google AI tools',
        logoUrl: 'https://www.gstatic.com/devrel-devsite/prod/v45f61267e22826169cf5d5f452882f7812c8cfb5f8b103a48c0d88727908b295/developers/images/touchicon-180.png',
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
        logoUrl: 'https://assets.coingecko.com/coins/images/2620/small/daostack.png',
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
  // Strip $ prefix from query to support token symbol searches like "$ARB"
  const lowerQuery = query.toLowerCase().replace(/^\$/, '');
  return ALL_FORUM_PRESETS.filter(
    (forum) =>
      forum.name.toLowerCase().includes(lowerQuery) ||
      forum.description?.toLowerCase().includes(lowerQuery) ||
      forum.token?.toLowerCase().includes(lowerQuery)
  );
}
