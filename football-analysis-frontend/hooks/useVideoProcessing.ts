"use client"

import { useState, useEffect, useRef } from "react"
import { apiClient } from "../lib/api-client"

interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
  outputKey?: string;
  analytics?: any;
  estimatedTimeRemaining?: number;
}

interface ProcessingResponse {
  message: string;
  jobId?: string;
  status: string;
}

export function useVideoProcessing(videoId: string | null) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startProcessing = async (videoId: string) => {
    try {
      console.log('🔬 Starting video analysis for ID:', videoId);

      const response = await apiClient.post<ProcessingResponse>(`/api/videos/${videoId}/process`);

      console.log('✅ Processing started:', response);

      setIsPolling(true);
      pollStatus(videoId);

    } catch (error) {
      console.error('❌ Failed to start processing:', error);
      setStatus({
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Processing failed to start'
      });
    }
  };

  const pollStatus = async (videoId: string) => {
    try {
      console.log('📊 Polling processing status for video:', videoId);

      const response = await apiClient.get<{
        status: string;
        progress: number;
        analytics?: any;
        error?: string;
      }>(`/api/videos/${videoId}/status`);

      console.log('📈 Processing status response:', response);

      const statusMap: Record<string, ProcessingStatus['status']> = {
        'uploaded': 'processing',
        'queued': 'processing',
        'processing': 'processing',
        'completed': 'completed',
        'failed': 'failed'
      };

      const transformedStatus: ProcessingStatus = {
        status: statusMap[response.status] || 'processing',
        progress: response.progress || 0,
        message: 'Processing video...',
        error: response.error || undefined,
        outputKey: undefined,
        analytics: response.analytics || undefined
      };

      setStatus(transformedStatus);

      if (transformedStatus.status === 'completed' || transformedStatus.status === 'failed') {
        console.log(`🏁 Processing ${transformedStatus.status} for video:`, videoId);
        setIsPolling(false);

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

    } catch (error) {
      console.error('❌ Failed to get processing status:', error);
      setStatus({
        status: 'failed',
        progress: 0,
        error: 'Failed to get processing status'
      });
      setIsPolling(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const cancelProcessing = async (videoId: string) => {
    try {
      console.log('🛑 Cancelling processing for video:', videoId);

      await apiClient.post(`/videos/${videoId}/cancel`);

      setStatus({
        status: 'failed',
        progress: 0,
        message: 'Processing cancelled by user'
      });

      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

    } catch (error) {
      console.error('❌ Failed to cancel processing:', error);
    }
  };

  const resetProcessing = () => {
    console.log('🔄 Resetting processing state...');
    setStatus(null);
    setIsPolling(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isPolling && videoId) {
      console.log('⏰ Setting up polling interval for video:', videoId);

      intervalRef.current = setInterval(() => {
        pollStatus(videoId);
      }, 3000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isPolling, videoId]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    status,
    startProcessing,
    cancelProcessing,
    isPolling,
    resetProcessing
  };
}
