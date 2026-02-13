export type ForumCategoryId =
  | 'crypto'
  | 'ai'
  | 'oss'
  // Legacy IDs for backwards compatibility
  | 'crypto-governance'
  | 'crypto-defi'
  | 'crypto-niche'
  | 'ai-research'
  | 'ai-tools'
  | 'oss-languages'
  | 'oss-frameworks'
  | 'oss-infrastructure'
  | 'custom';

// Source platform types
export type SourceType = 'discourse' | 'ea-forum' | 'lesswrong' | 'github' | 'hackernews';

export interface Forum {
  id: string;
  cname: string;
  name: string;
  description?: string;
  logoUrl?: string;
  token?: string;
  category?: ForumCategoryId;
  sourceType?: SourceType;
  discourseForum: {
    url: string;
    categoryId?: number;
  };
  isEnabled: boolean;
  createdAt: string;
}

export interface DiscussionTopic {
  id: number;
  refId: string;
  protocol: string;
  title: string;
  slug: string;
  tags: string[];
  postsCount: number;
  views: number;
  replyCount: number;
  likeCount: number;
  categoryId: number;
  pinned: boolean;
  visible: boolean;
  closed: boolean;
  archived: boolean;
  createdAt: string;
  bumpedAt: string;
  imageUrl?: string;
  forumUrl: string;
  excerpt?: string;
  // Multi-source fields (optional for backwards compatibility)
  sourceType?: SourceType;
  authorName?: string;
  score?: number;  // For voting-based platforms (HN, EA Forum)
  externalUrl?: string;  // Full canonical URL for non-Discourse sources
}

export interface KeywordAlert {
  id: string;
  keyword: string;
  createdAt: string;
  isEnabled: boolean;
}

export type DateRangeFilter = 'all' | 'today' | 'week' | 'month';
export type DateFilterMode = 'created' | 'activity';

// Email digest preferences
export type DigestFrequency = 'daily' | 'weekly' | 'never';

export interface DigestPreferences {
  frequency: DigestFrequency;
  includeHotTopics: boolean;
  includeNewProposals: boolean;
  includeKeywordMatches: boolean;
  includeDelegateCorner: boolean;
  email?: string; // Override email if different from account
}

export type SortOption = 'recent' | 'replies' | 'views' | 'likes';

export interface Bookmark {
  id: string;
  topicRefId: string;
  topicTitle: string;
  topicUrl: string;
  protocol: string;
  createdAt: string;
}

// Raw Discourse API response - tags can be strings OR objects depending on forum
export interface DiscourseTopicResponse {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  bumped_at: string;
  posts_count: number;
  reply_count: number;
  views: number;
  like_count: number;
  category_id: number;
  pinned: boolean;
  visible: boolean;
  closed: boolean;
  archived: boolean;
  tags: (string | { id: number; name: string; slug: string })[];
  image_url?: string;
  excerpt?: string;
}

export interface DiscussionPost {
  id: number;
  username: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
  likeCount: number;
  postNumber: number;
  replyToPostNumber?: number;
}

export interface TopicDetail {
  id: number;
  title: string;
  posts: DiscussionPost[];
  postsCount: number;
  participantCount: number;
}

export interface DiscourseLatestResponse {
  topic_list: {
    topics: DiscourseTopicResponse[];
  };
}
