import { useState, useEffect, useCallback } from 'react';

interface ProcessingStatus {
  videoId: string;
  status: 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentTask?: string;
  jobId?: string;
  aiAnalysisCompleted?: boolean;
  error?: string;
  analytics?: any;
  outputKey?: string;
  completedAt?: string;
}

export const useVideoProcessing = (videoId: string | null) => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const startProcessing = async (videoId: string) => {
    const userId = getUserId();

    try {
      console.log('🎬 Starting video processing...');
      const response = await fetch(`http://localhost:8082/api/videos/${videoId}/process`, {
        method: 'POST',
        headers: {
          'X-User-ID': userId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      const result = await response.json();
      console.log('✅ Processing started:', result.message);

      setIsPolling(true);

    } catch (error) {
      console.error('❌ Failed to start processing:', error);
      throw error;
    }
  };

  const checkStatus = useCallback(async (videoId: string) => {
    try {
      console.log(`🔍 Checking status for video ${videoId}...`);

      const userId = getUserId();

      const response = await fetch(`http://localhost:8082/api/videos/${videoId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
      });

      if (response.ok) {
        const statusData = await response.json();

        console.log('📊 Raw status response from Spring:', statusData);

        const mappedStatus: ProcessingStatus = {
          videoId: videoId,
          status: statusData.status,
          progress: statusData.progress || 0,
          currentTask: statusData.currentTask,
          jobId: statusData.jobId,
          error: statusData.error,
          analytics: statusData.analytics,
          outputKey: statusData.outputKey,
          completedAt: statusData.completedAt,
          aiAnalysisCompleted: statusData.status === 'completed'
        };

        console.log(`✅ Mapped status for video ${videoId}:`, mappedStatus);
        console.log(`📊 Progress: ${mappedStatus.progress}%, Status: ${mappedStatus.status}`);

        setStatus(prevStatus => {

          const newStatus = { ...mappedStatus };
          console.log('🔄 Setting new status state:', newStatus);
          return newStatus;
        });

        if (mappedStatus.status === 'completed' || mappedStatus.status === 'failed') {
          console.log(`🏁 Stopping polling for video ${videoId} - Status: ${mappedStatus.status}`);
          setIsPolling(false);
        }
      } else {
        console.error(`❌ Failed to get status for video ${videoId}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error checking status:', error);
    }
  }, []);

  useEffect(() => {
    if (!videoId || !isPolling) return;

    console.log(`🔄 Starting polling for video ${videoId}`);

    checkStatus(videoId);

    const interval = setInterval(() => {
      checkStatus(videoId);
    }, 2000);

    return () => {
      console.log(`⏹️ Stopping polling for video ${videoId}`);
      clearInterval(interval);
    };
  }, [videoId, isPolling, checkStatus]);

  useEffect(() => {
    if (status) {
      console.log('🎯 STATUS STATE UPDATED:', {
        videoId: status.videoId,
        status: status.status,
        progress: status.progress,
        currentTask: status.currentTask
      });
    }
  }, [status]);

  return {
    status,
    startProcessing,
    checkStatus,
    isPolling,
    setIsPolling,
  };
};

function getUserId(): string {
  if (typeof window !== 'undefined') {

    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser && currentUser.id) {
          return currentUser.id;
        }
      } catch (error) {
        console.error('❌ Error parsing currentUser from localStorage:', error);
      }
    }
    console.warn('⚠️ No authenticated user found in localStorage');
    return "";
  }
  return "";
}