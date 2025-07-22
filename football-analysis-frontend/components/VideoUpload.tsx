import { useState, useCallback } from 'react';
import axios, { AxiosProgressEvent, AxiosError } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8082';

interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
}

interface VideoMetadata {
  title: string;
  description?: string;
}

interface UploadResponse {
  videoId: string;
  fileKey: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

export const useVideoUpload = (userId: string) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploaded: 0,
    total: 0,
    percentage: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = useCallback(async (file: File, metadata: VideoMetadata): Promise<UploadResponse> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress({ uploaded: 0, total: file.size, percentage: 0 });

    try {

      if (!userId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId)) {
        throw new Error('Invalid user ID format. Please log in again.');
      }

      if (!metadata.title || metadata.title.trim() === '') {
        throw new Error('Video title is required');
      }

      console.log('📤 Starting video upload for user:', userId);

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found. Please log in.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title.trim());
      if (metadata.description) {
        formData.append('description', metadata.description.trim());
      }

      const response = await axios.post(`${API_BASE_URL}/api/videos/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress({
              uploaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            });
          }
        },
        timeout: 300000,
      });

      console.log('✅ Video uploaded successfully:', response.data);

      return {
        videoId: response.data.videoId,
        fileKey: response.data.fileKey,
      };
    } catch (err) {
      let errorMessage = 'Failed to upload video';
      if (err instanceof AxiosError) {
        const errorResponse = err.response?.data as ErrorResponse | undefined;
        errorMessage = errorResponse?.error || errorResponse?.message || err.message;
        if (err.response?.status === 401) {
          errorMessage = 'Authentication failed: Please log in again';
        } else if (err.response?.status === 403) {
          errorMessage = 'Access denied: Invalid user or video ownership';
        } else if (err.response?.status === 400) {
          errorMessage = errorResponse?.error || 'Invalid request';
        } else if (err.response?.status === 500) {
          errorMessage = errorResponse?.error || 'Server error: Please try again later';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      console.error('❌ Upload error:', errorMessage, err);
      throw new Error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [userId]);

  return {
    uploadVideo,
    isUploading,
    uploadProgress,
    error,
  };
};