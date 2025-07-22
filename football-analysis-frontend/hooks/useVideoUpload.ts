"use client"

import { useState } from "react"
import { apiClient } from "../lib/api-client"

interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
}

interface UploadResponse {
  videoId: string;
  message: string;
  fileName?: string;
  status?: string;
}

interface UploadError extends Error {
  code?: string;
  status?: number;
}

export function useVideoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploaded: 0,
    total: 0,
    percentage: 0
  });
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (
    file: File,
    metadata: { title: string; description: string }
  ): Promise<{ videoId: string }> => {
    console.log('📤 Starting video upload to Spring backend...');
    console.log('📁 File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    console.log('📋 Metadata:', metadata);

    setIsUploading(true);
    setError(null);
    setUploadProgress({ uploaded: 0, total: file.size, percentage: 0 });

    try {

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);

      console.log('🚀 Uploading directly to Video Service...');

      const response = await apiClient.uploadFile<UploadResponse>(
        '/api/videos/upload',
        formData,
        (progress) => {
          const progressData = {
            uploaded: (file.size * progress) / 100,
            total: file.size,
            percentage: progress
          };
          setUploadProgress(progressData);
          console.log(`📊 Upload progress: ${progress.toFixed(1)}%`);
        }
      );

      console.log('✅ Upload completed successfully:', response);

      if (!response.videoId) {
        throw new Error('Upload completed but no video ID received');
      }

      console.log('🎯 Video registered with ID:', response.videoId);

      return { videoId: response.videoId };

    } catch (err) {
      const error = err as UploadError;
      const errorMessage = error.message || 'Upload failed';

      console.error('❌ Upload failed:', error);

      setError(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    console.log('🔄 Resetting upload state...');
    setIsUploading(false);
    setUploadProgress({ uploaded: 0, total: 0, percentage: 0 });
    setError(null);
  };

  return {
    uploadVideo,
    isUploading,
    uploadProgress,
    error,
    resetUpload
  };
}
