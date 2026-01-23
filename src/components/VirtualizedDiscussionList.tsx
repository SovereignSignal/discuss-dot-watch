'use client';

import { useRef, memo } from 'react';
import { DiscussionTopic, KeywordAlert } from '@/types';
import { DiscussionItem } from './DiscussionItem';
import { useVirtualList } from '@/hooks/useVirtualList';

interface VirtualizedDiscussionListProps {
  discussions: DiscussionTopic[];
  alerts: KeywordAlert[];
  isBookmarked: (refId: string) => boolean;
  isRead: (refId: string) => boolean;
  onToggleBookmark: (topic: DiscussionTopic) => void;
  onMarkAsRead: (refId: string) => void;
}

const ITEM_HEIGHT = 120; // Approximate height of a discussion item

const MemoizedDiscussionItem = memo(DiscussionItem);

export function VirtualizedDiscussionList({
  discussions,
  alerts,
  isBookmarked,
  isRead,
  onToggleBookmark,
  onMarkAsRead,
}: VirtualizedDiscussionListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { virtualItems, totalHeight, containerProps } = useVirtualList(discussions, {
    itemHeight: ITEM_HEIGHT,
    overscan: 5,
    containerRef,
  });

  // For lists with less than 30 items, don't virtualize - it adds complexity without benefit
  if (discussions.length < 30) {
    return (
      <div className="flex-1 overflow-y-auto">
        {discussions.map((topic) => (
          <MemoizedDiscussionItem
            key={topic.refId}
            topic={topic}
            alerts={alerts}
            isBookmarked={isBookmarked(topic.refId)}
            isRead={isRead(topic.refId)}
            onToggleBookmark={onToggleBookmark}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      {...containerProps}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.map(({ index, start }) => {
          const topic = discussions[index];
          return (
            <div
              key={topic.refId}
              style={{
                position: 'absolute',
                top: start,
                left: 0,
                right: 0,
                height: ITEM_HEIGHT,
              }}
            >
              <MemoizedDiscussionItem
                topic={topic}
                alerts={alerts}
                isBookmarked={isBookmarked(topic.refId)}
                isRead={isRead(topic.refId)}
                onToggleBookmark={onToggleBookmark}
                onMarkAsRead={onMarkAsRead}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
