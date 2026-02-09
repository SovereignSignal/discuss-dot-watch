'use client';

import { useState, useEffect } from 'react';
import { TopicDetail } from '@/types';

export function useTopicDetail(forumUrl: string | null, topicId: number | null) {
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forumUrl || !topicId) {
      setTopicDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/discourse/topic?forumUrl=${encodeURIComponent(forumUrl)}&topicId=${topicId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setTopicDetail(data.topic);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forumUrl, topicId]);

  return {
    topicDetail,
    posts: topicDetail?.posts || [],
    isLoading,
    error,
  };
}
