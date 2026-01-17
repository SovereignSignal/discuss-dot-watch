export type ForumCategoryId =
  | 'l2-protocols'
  | 'l1-protocols'
  | 'defi-lending'
  | 'defi-dex'
  | 'defi-staking'
  | 'defi-other'
  | 'major-daos'
  | 'infrastructure'
  | 'privacy'
  | 'ai-crypto'
  | 'ai-developer'
  | 'governance-meta'
  | 'custom';

export interface Forum {
  id: string;
  cname: string;
  name: string;
  description?: string;
  logoUrl?: string;
  token?: string;
  category?: ForumCategoryId;
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
}

export interface KeywordAlert {
  id: string;
  keyword: string;
  createdAt: string;
  isEnabled: boolean;
}

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
  tags: string[];
  image_url?: string;
}

export interface DiscourseLatestResponse {
  topic_list: {
    topics: DiscourseTopicResponse[];
  };
}
