'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStorageQuota, setStorageErrorCallback, StorageQuota, StorageError } from '@/lib/storage';

export function useStorageMonitor(onError?: (error: StorageError) => void) {
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [lastError, setLastError] = useState<StorageError | null>(null);

  // Set up error callback
  useEffect(() => {
    const handleError = (error: StorageError) => {
      setLastError(error);
      if (onError) {
        onError(error);
      }
    };

    setStorageErrorCallback(handleError);

    return () => {
      setStorageErrorCallback(null);
    };
  }, [onError]);

  // Check quota periodically and on mount
  const checkQuota = useCallback(() => {
    const currentQuota = getStorageQuota();
    setQuota(currentQuota);
    return currentQuota;
  }, []);

  useEffect(() => {
    checkQuota();

    // Check quota every 30 seconds
    const interval = setInterval(checkQuota, 30000);

    return () => clearInterval(interval);
  }, [checkQuota]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    quota,
    lastError,
    checkQuota,
    clearError,
  };
}
