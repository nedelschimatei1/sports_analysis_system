import { useState } from 'react';

interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
}

interface VideoMetadata {
  title: string;
  description?: string;
}

export const useVideoUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ uploaded: 0, total: 0, percentage: 0 });
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (file: File, metadata: VideoMetadata) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress({ uploaded: 0, total: file.size, percentage: 0 });

    try {
      const userId = getUserId();

      console.log('📤 Starting direct upload to backend...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      if (metadata.description) {
        formData.append('description', metadata.description);
      }

      const uploadPromise = new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded * 100) / event.total);
            setUploadProgress({
              uploaded: event.loaded,
              total: event.total,
              percentage,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error || `Upload failed with status: ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out'));
        });

        xhr.open('POST', 'http://localhost:8082/api/videos/upload');
        xhr.setRequestHeader('X-User-ID', userId);
        xhr.timeout = 300000;
        xhr.send(formData);
      });

      const result = await uploadPromise;
      console.log('✅ Video uploaded successfully:', result);

      return {
        videoId: result.videoId,
        fileKey: result.fileKey
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('❌ Upload error:', errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadVideo,
    isUploading,
    uploadProgress,
    error,
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