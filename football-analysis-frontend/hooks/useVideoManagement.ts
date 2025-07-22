"use client"

import { useState, useEffect } from "react"
import { apiClient } from "../lib/api-client"
import type { VideoAnalysis } from "../types/auth"

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

export function useVideoManagement(userId?: string) {
  const [videos, setVideos] = useState<VideoAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserVideos = async () => {
    const actualUserId = userId || getUserId();
    if (!actualUserId) {
      console.log('⚠️ No userId provided, skipping video fetch');
      return;
    }

    console.log('📥 Fetching videos for user:', actualUserId);
    setIsLoading(true);
    setError(null);

    try {

      const response = await fetch('http://localhost:8082/api/videos?page=0&size=20', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': actualUserId,
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Videos fetched successfully:', data.videos?.length || 0);
      setVideos(data.videos || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch videos';
      console.error('❌ Failed to fetch videos:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVideo = async (videoId: string): Promise<boolean> => {
    const actualUserId = userId || getUserId();
    console.log('🗑️ Deleting video:', videoId);
    try {
      const response = await fetch(`http://localhost:8082/api/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': actualUserId,
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete video: ${response.statusText}`);
      }

      setVideos(videos.filter(video => video.id !== videoId));
      console.log('✅ Video deleted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete video';
      console.error('❌ Failed to delete video:', err);
      setError(errorMessage);
      return false;
    }
  };

  const downloadVideo = async (videoId: string, type: 'original' | 'processed' | 'analytics'): Promise<void> => {
    const actualUserId = userId || getUserId();
    console.log('⬇️ Downloading video:', videoId, 'type:', type);
    try {
      let endpoint = '';
      switch (type) {
        case 'processed':
          endpoint = `/api/videos/${videoId}/download/processed`;
          break;
        case 'original':
          endpoint = `/api/videos/${videoId}/download/original`;
          break;
        case 'analytics':
          endpoint = `/api/videos/${videoId}/analytics`;
          break;
        default:
          throw new Error('Invalid download type');
      }

      const url = `http://localhost:8082${endpoint}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          'X-User-ID': actualUserId,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `video-${videoId}-${type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        console.log('✅ Download completed');
      } else {
        throw new Error(`Download failed: ${response.statusText}`);
      }
    } catch (err) {
      console.error('❌ Failed to download video:', err);
      throw err;
    }
  };

  const getVideoDetails = async (videoId: string): Promise<VideoAnalysis | null> => {
    const actualUserId = userId || getUserId();
    console.log('🔍 Getting video details:', videoId);
    try {
      const response = await fetch(`http://localhost:8082/api/videos/${videoId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': actualUserId,
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get video details: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Video details fetched');
      return data.video;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get video details';
      console.error('❌ Failed to get video details:', err);
      setError(errorMessage);
      return null;
    }
  };

  useEffect(() => {
    const actualUserId = userId || getUserId();
    if (actualUserId) {
      fetchUserVideos();
    }
  }, [userId]);

  return {
    videos,
    isLoading,
    error,
    fetchUserVideos,
    deleteVideo,
    downloadVideo,
    getVideoDetails,
    refetch: fetchUserVideos
  };
}