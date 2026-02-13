'use client';

import { X, ExternalLink, ThumbsUp, ArrowLeft, MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DiscussionTopic } from '@/types';
import { useTopicDetail } from '@/hooks/useTopicDetail';
import { c } from '@/lib/theme';

interface DiscussionReaderProps {
  topic: DiscussionTopic;
  onClose: () => void;
  isDark?: boolean;
  isMobile?: boolean;
}

function PostSkeleton({ isDark }: { isDark: boolean }) {
  const t = c(isDark);
  return (
    <div className="px-5 py-4 border-b animate-pulse" style={{ borderColor: t.border }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: t.bgBadge }} />
        <div className="h-3 w-24 rounded" style={{ backgroundColor: t.bgBadge }} />
        <div className="h-3 w-16 rounded ml-auto" style={{ backgroundColor: t.bgBadge }} />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded" style={{ backgroundColor: t.bgBadge }} />
        <div className="h-3 w-3/4 rounded" style={{ backgroundColor: t.bgBadge }} />
        <div className="h-3 w-1/2 rounded" style={{ backgroundColor: t.bgBadge }} />
      </div>
    </div>
  );
}

export function DiscussionReader({ topic, onClose, isDark = true, isMobile = false }: DiscussionReaderProps) {
  const t = c(isDark);
  const { posts, isLoading, error, topicDetail } = useTopicDetail(topic.forumUrl, topic.id);
  const topicUrl = topic.externalUrl || `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;

  return (
    <div
      className={
        isMobile
          ? 'fixed inset-0 z-50 flex flex-col'
          : 'flex flex-col h-full border-l'
      }
      style={{
        backgroundColor: t.bg,
        borderColor: t.border,
      }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-2 px-4 h-14 border-b flex-shrink-0"
        style={{ borderColor: t.border }}
      >
        {isMobile && (
          <button onClick={onClose} className="p-1.5 -ml-1" style={{ color: t.fgMuted }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: t.fg }}
          >
            {topic.title}
          </h2>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: t.fgDim }}>
            <span className="capitalize">{topic.protocol}</span>
            {topicDetail && (
              <>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="w-3 h-3" />
                  {topicDetail.postsCount}
                </span>
                {topicDetail.participantCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Users className="w-3 h-3" />
                    {topicDetail.participantCount}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <a
          href={topicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md transition-colors flex-shrink-0"
          style={{ color: t.fgMuted }}
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        {!isMobile && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ color: t.fg, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            title="Close reading pane (Esc)"
            aria-label="Close reading pane"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            <PostSkeleton isDark={isDark} />
            <PostSkeleton isDark={isDark} />
            <PostSkeleton isDark={isDark} />
          </>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: t.fgMuted }}>
              Failed to load discussion: {error}
            </p>
            <a
              href={topicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm underline"
              style={{ color: t.fgSecondary }}
            >
              Open on forum <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="px-5 py-4 border-b overflow-hidden"
              style={{ borderColor: t.border }}
            >
              {/* Post header */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <img
                  src={post.avatarUrl}
                  alt=""
                  className="w-7 h-7 rounded-full flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: t.fgSecondary }}
                >
                  {post.username}
                </span>
                {post.replyToPostNumber && (
                  <span className="text-[11px]" style={{ color: t.fgDim }}>
                    replied to #{post.replyToPostNumber}
                  </span>
                )}
                <span className="ml-auto text-[11px]" style={{ color: t.fgDim }}>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>

              {/* Post content */}
              <div
                className="discourse-content text-sm leading-relaxed"
                style={{ color: t.fgSecondary }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Post footer */}
              {post.likeCount > 0 && (
                <div
                  className="mt-2 flex items-center gap-1 text-[11px]"
                  style={{ color: t.fgDim }}
                >
                  <ThumbsUp className="w-3 h-3" />
                  {post.likeCount}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
