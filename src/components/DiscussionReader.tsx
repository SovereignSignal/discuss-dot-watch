'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, ThumbsUp, ArrowLeft, MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DiscussionTopic } from '@/types';
import { useTopicDetail } from '@/hooks/useTopicDetail';

interface DiscussionReaderProps {
  topic: DiscussionTopic;
  onClose: () => void;
  isDark?: boolean;
  isMobile?: boolean;
  /** j/k walks the FEED's visible list — hide that hint segment when the
   *  reader is mounted from a view where j/k does nothing (e.g. Briefs). */
  showNavHint?: boolean;
}

/**
 * Post avatar: the letter fallback is always the base layer; the image sits
 * on top and only becomes visible once it actually loads (avatar URLs often
 * 404, which used to leave a blank gap). Same pattern as ForumAvatar in
 * ForumManager.
 */
function PostAvatar({ avatarUrl, username }: { avatarUrl: string; username: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ backgroundColor: 'var(--ds-bg-elev)' }}
    >
      <span
        className="text-[11px] font-semibold"
        style={{ color: 'var(--ds-fg-muted)', visibility: loaded ? 'hidden' : 'visible' }}
      >
        {(username[0] || '?').toUpperCase()}
      </span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ visibility: loaded ? 'visible' : 'hidden' }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      )}
    </div>
  );
}

function PostSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="px-5 py-4 border-b animate-pulse" style={{ borderColor: 'var(--ds-border)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--ds-bg-elev)' }} />
        <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--ds-bg-elev)' }} />
        <div className="h-3 w-16 rounded ml-auto" style={{ backgroundColor: 'var(--ds-bg-elev)' }} />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded" style={{ backgroundColor: 'var(--ds-bg-elev)' }} />
        <div className="h-3 w-3/4 rounded" style={{ backgroundColor: 'var(--ds-bg-elev)' }} />
        <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--ds-bg-elev)' }} />
      </div>
    </div>
  );
}

export function DiscussionReader({ topic, onClose, isDark = true, isMobile = false, showNavHint }: DiscussionReaderProps) {
  const { posts, isLoading, error, topicDetail } = useTopicDetail(topic.forumUrl, topic.id);
  const topicUrl = topic.externalUrl || `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  // The mobile overlay is modal (role="dialog"): move focus to the back
  // button on open and trap Tab within it. The desktop pane is a
  // complementary region and must NOT steal focus — j/k selection in the
  // feed list would be disrupted.
  useEffect(() => {
    if (!isMobile) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    backButtonRef.current?.focus();

    const container = containerRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the row that opened the dialog — but only if the
      // dialog actually owned focus (cleanup runs before the node detaches).
      if (container?.contains(document.activeElement)) previouslyFocused?.focus();
    };
  }, [isMobile]);

  return (
    <div
      ref={containerRef}
      // The mobile overlay is modal; the desktop pane is a complementary
      // region alongside the feed (j/k in the feed navigates between topics).
      role={isMobile ? 'dialog' : 'complementary'}
      aria-modal={isMobile || undefined}
      aria-label={`Discussion: ${topic.title}`}
      className={
        isMobile
          ? 'fixed inset-0 z-50 flex flex-col'
          : 'flex flex-col h-full border-l min-w-0 overflow-hidden'
      }
      style={{
        backgroundColor: 'var(--ds-bg-base)',
        borderColor: 'var(--ds-border)',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-2 px-4 h-14 border-b flex-shrink-0"
        style={{ borderColor: 'var(--ds-border)' }}
      >
        {isMobile && (
          <button
            ref={backButtonRef}
            onClick={onClose}
            className="p-1.5 -ml-1"
            style={{ color: 'var(--ds-fg-muted)' }}
            aria-label="Close discussion"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--ds-fg)' }}
          >
            {topic.title}
          </h2>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ds-fg-dim)' }}>
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

        {!isMobile && (
          <span
            className="hidden lg:flex items-center gap-1.5 text-[10px] flex-shrink-0 select-none"
            style={{ color: 'var(--ds-fg-dim)', fontFamily: 'var(--ds-font-mono)' }}
            aria-hidden="true"
            title={`Keyboard: ${showNavHint ? 'j/k next/previous · ' : ''}s save · o open on forum · e done`}
          >
            {showNavHint && <><span>j/k</span>·</>}<span>s save</span>·<span>o open</span>·<span>e done</span>
          </span>
        )}

        <a
          href={topicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md transition-colors flex-shrink-0"
          style={{ color: 'var(--ds-fg-muted)' }}
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        {!isMobile && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--ds-fg)', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            title="Close reading pane (Esc)"
            aria-label="Close reading pane"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {isLoading ? (
          <>
            <PostSkeleton isDark={isDark} />
            <PostSkeleton isDark={isDark} />
            <PostSkeleton isDark={isDark} />
          </>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--ds-fg-muted)' }}>
              Failed to load discussion: {error}
            </p>
            <a
              href={topicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm underline"
              style={{ color: 'var(--ds-fg)' }}
            >
              Open on forum <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          posts.filter((post) => post.username !== 'system').map((post) => (
            <article
              key={post.id}
              className="px-5 py-4 border-b min-w-0"
              style={{ borderColor: 'var(--ds-border)' }}
            >
              {/* Post header */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <PostAvatar avatarUrl={post.avatarUrl} username={post.username} />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--ds-fg)' }}
                >
                  {post.username}
                </span>
                {post.replyToPostNumber && (
                  <span className="text-[11px]" style={{ color: 'var(--ds-fg-dim)' }}>
                    replied to #{post.replyToPostNumber}
                  </span>
                )}
                <span className="ml-auto text-[11px]" style={{ color: 'var(--ds-fg-dim)' }}>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>

              {/* Post content */}
              <div
                className="discourse-content text-sm leading-relaxed"
                style={{ color: 'var(--ds-fg)' }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Post footer */}
              {post.likeCount > 0 && (
                <div
                  className="mt-2 flex items-center gap-1 text-[11px]"
                  style={{ color: 'var(--ds-fg-dim)' }}
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
