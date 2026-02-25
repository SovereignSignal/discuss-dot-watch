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

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(
      `/api/discourse/topic?forumUrl=${encodeURIComponent(forumUrl)}&topicId=${topicId}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTopicDetail(data.topic);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [forumUrl, topicId]);

  return {
    topicDetail,
    posts: topicDetail?.posts || [],
    isLoading,
    error,
  };
}
