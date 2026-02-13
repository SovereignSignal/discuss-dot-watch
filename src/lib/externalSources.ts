/**
 * Non-Discourse External Sources
 * 
 * Configuration for EA Forum, LessWrong, and future sources
 * (GitHub Discussions, Hacker News)
 */

import { SourceType } from '@/types';

export interface ExternalSource {
  id: string;
  name: string;
  sourceType: SourceType;
  category: 'ai' | 'oss' | 'cross' | 'crypto';
  description: string;
  logoUrl?: string;
  tier: 1 | 2 | 3;
  enabled: boolean;
  repoRef?: string; // GitHub "owner/repo" format (for sourceType: 'github')
}

export const EXTERNAL_SOURCES: ExternalSource[] = [
  // AI Vertical
  {
    id: 'ea-forum',
    name: 'EA Forum',
    sourceType: 'ea-forum',
    category: 'ai',
    description: 'AI safety, funding, grants, Open Philanthropy discussions',
    logoUrl: 'https://forum.effectivealtruism.org/favicon.ico',
    tier: 1,
    enabled: true,
  },
  {
    id: 'lesswrong',
    name: 'LessWrong',
    sourceType: 'lesswrong',
    category: 'ai',
    description: 'AI alignment research, MATS, SERI, rationality',
    logoUrl: 'https://www.lesswrong.com/favicon.ico',
    tier: 1,
    enabled: false, // Blocked by Vercel bot protection on LessWrong's GraphQL endpoint
  },
  // GitHub Discussions — Crypto
  {
    id: 'github-ethereum-eips',
    name: 'Ethereum EIPs',
    sourceType: 'github',
    category: 'crypto',
    description: 'Ethereum Improvement Proposals discussions',
    logoUrl: 'https://github.com/ethereum.png',
    tier: 1,
    enabled: true,
    repoRef: 'ethereum/EIPs',
  },
  {
    id: 'github-ethereum-pm',
    name: 'Ethereum PM',
    sourceType: 'github',
    category: 'crypto',
    description: 'Ethereum project management and ACD calls',
    logoUrl: 'https://github.com/ethereum.png',
    tier: 2,
    enabled: true,
    repoRef: 'ethereum/pm',
  },
  // GitHub Discussions — AI
  {
    id: 'github-pytorch',
    name: 'PyTorch',
    sourceType: 'github',
    category: 'ai',
    description: 'PyTorch framework discussions and RFCs',
    logoUrl: 'https://github.com/pytorch.png',
    tier: 1,
    enabled: true,
    repoRef: 'pytorch/pytorch',
  },
  {
    id: 'github-huggingface-transformers',
    name: 'HuggingFace Transformers',
    sourceType: 'github',
    category: 'ai',
    description: 'Transformers library discussions',
    logoUrl: 'https://github.com/huggingface.png',
    tier: 1,
    enabled: true,
    repoRef: 'huggingface/transformers',
  },
  {
    id: 'github-langchain',
    name: 'LangChain',
    sourceType: 'github',
    category: 'ai',
    description: 'LangChain framework discussions',
    logoUrl: 'https://github.com/langchain-ai.png',
    tier: 2,
    enabled: true,
    repoRef: 'langchain-ai/langchain',
  },
  // GitHub Discussions — Open Source
  {
    id: 'github-rust-rfcs',
    name: 'Rust RFCs',
    sourceType: 'github',
    category: 'oss',
    description: 'Rust language RFCs and design discussions',
    logoUrl: 'https://github.com/rust-lang.png',
    tier: 1,
    enabled: true,
    repoRef: 'rust-lang/rfcs',
  },
  {
    id: 'github-nextjs',
    name: 'Next.js',
    sourceType: 'github',
    category: 'oss',
    description: 'Next.js framework discussions',
    logoUrl: 'https://github.com/vercel.png',
    tier: 1,
    enabled: true,
    repoRef: 'vercel/next.js',
  },
  {
    id: 'github-nodejs',
    name: 'Node.js',
    sourceType: 'github',
    category: 'oss',
    description: 'Node.js runtime discussions',
    logoUrl: 'https://github.com/nodejs.png',
    tier: 2,
    enabled: true,
    repoRef: 'nodejs/node',
  },
  {
    id: 'github-godot-proposals',
    name: 'Godot Proposals',
    sourceType: 'github',
    category: 'oss',
    description: 'Godot engine feature proposals and discussions',
    logoUrl: 'https://github.com/godotengine.png',
    tier: 2,
    enabled: true,
    repoRef: 'godotengine/godot-proposals',
  },
  // Future sources (disabled for now)
  // {
  //   id: 'hackernews',
  //   name: 'Hacker News',
  //   sourceType: 'hackernews',
  //   category: 'cross',
  //   description: 'Tech news and discussions',
  //   logoUrl: 'https://news.ycombinator.com/favicon.ico',
  //   tier: 2,
  //   enabled: false,
  // },
];

export function getEnabledExternalSources(): ExternalSource[] {
  return EXTERNAL_SOURCES.filter(s => s.enabled);
}

export function getExternalSourcesByCategory(category: 'ai' | 'oss' | 'cross'): ExternalSource[] {
  return EXTERNAL_SOURCES.filter(s => s.category === category && s.enabled);
}
