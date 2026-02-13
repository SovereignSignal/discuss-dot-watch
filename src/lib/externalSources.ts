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
  category: 'ai' | 'oss' | 'cross';
  description: string;
  logoUrl?: string;
  tier: 1 | 2 | 3;
  enabled: boolean;
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
