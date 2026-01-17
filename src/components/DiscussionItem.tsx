'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive } from 'lucide-react';
import { DiscussionTopic, KeywordAlert } from '@/types';

interface DiscussionItemProps {
  topic: DiscussionTopic;
  alerts: KeywordAlert[];
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Yesterday ' + format(date, 'HH:mm');
  }
  return format(date, 'MMM dd, HH:mm');
}

function highlightKeywords(text: string, alerts: KeywordAlert[]): React.ReactNode {
  if (alerts.length === 0) return text;
  
  const enabledKeywords = alerts.filter(a => a.isEnabled).map(a => a.keyword.toLowerCase());
  if (enabledKeywords.length === 0) return text;
  
  const regex = new RegExp(`(${enabledKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    if (enabledKeywords.includes(part.toLowerCase())) {
      return <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-1 rounded">{part}</mark>;
    }
    return part;
  });
}

export function DiscussionItem({ topic, alerts }: DiscussionItemProps) {
  const topicUrl = `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const hasMatchingKeyword = alerts.some(a => 
    a.isEnabled && topic.title.toLowerCase().includes(a.keyword.toLowerCase())
  );

  return (
    <a
      href={topicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
        hasMatchingKeyword ? 'bg-yellow-900/10 border-l-2 border-l-yellow-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
          {topic.imageUrl ? (
            <img 
              src={topic.imageUrl} 
              alt={topic.protocol} 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-white text-sm font-bold">
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span>{formatTimestamp(topic.bumpedAt)}</span>
            <span>·</span>
            <span className="capitalize">{topic.protocol}</span>
            <span>·</span>
            <span>Discourse Discussion</span>
            {topic.pinned && <Pin className="w-3 h-3 text-indigo-400" />}
            {topic.closed && <Lock className="w-3 h-3 text-orange-400" />}
            {topic.archived && <Archive className="w-3 h-3 text-gray-500" />}
          </div>
          
          <h3 className="text-white font-medium mb-2 line-clamp-2">
            {highlightKeywords(topic.title, alerts)}
          </h3>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {topic.replyCount}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {topic.views}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {topic.likeCount}
            </span>
            {topic.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {topic.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                    {tag}
                  </span>
                ))}
                {topic.tags.length > 3 && (
                  <span className="text-gray-600">+{topic.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
