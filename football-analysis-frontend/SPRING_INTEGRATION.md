# Spring Boot Integration Guide - Direct Service Communication

This document outlines how the Next.js frontend integrates directly with your Spring Boot microservices.

## Architecture Overview

```
Frontend (Next.js) → Auth Service (Port 4005)
                  → Video Service (Port 8082)
```

## Configuration

### Environment Variables
```env
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:4005
NEXT_PUBLIC_VIDEO_SERVICE_URL=http://localhost:8082
```

### Smart API Routing
The API client automatically routes requests to the appropriate service:
- **Auth endpoints** (`/login`, `/register`, `/validate`) → Auth Service (port 4005)
- **Video endpoints** (`/api/videos/*`) → Video Service (port 8082)

### Authentication Flow
1. **Login**: `POST /login` → Returns JWT token and user data (with UUID)
2. **Validation**: `GET /validate` with `Authorization: Bearer {token}`
3. **Headers**: All video requests include:
   - `Authorization: Bearer {token}`
   - `X-User-ID: {userId}` (UUID from auth service)

## API Endpoints Used by Frontend

### Auth Service (Direct: http://localhost:4005)

#### POST /login
User authentication
```
Request Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "223e5005-889b-12d3-a450-426014175000", // UUID from auth service
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### GET /auth/validate
Validate JWT token
```
Headers:
- Authorization: Bearer {token}

Response: 200 OK (if valid) or 401 Unauthorized
```

### Video Service (Direct: http://localhost:8082)

#### GET /api/videos
Fetch user's videos with pagination (user ID from X-User-ID header)
```
Headers:
- Authorization: Bearer {token}
- X-User-ID: {userId}

Query Parameters:
- page: number (default: 0)
- size: number (default: 10)

Response:
{
  "videos": [
    {
      "id": 1,
      "userId": "user123",
      "title": "Game Analysis",
      "description": "Football match analysis",
      "filePath": "/path/to/file.mp4",
      "originalFileKey": "videos/user123/original.mp4",
      "processedFileKey": "videos/user123/processed.mp4",
      "fileSize": 104857600,
      "contentType": "video/mp4",
      "durationSeconds": 3600,
      "processingStatus": "COMPLETED",
      "processingProgress": 100,
      "currentTask": "Analysis complete",
      "analyticsData": "{\"team1PossessionPercentage\":65.5,...}",
      "createdAt": "2025-07-14T12:00:00",
      "updatedAt": "2025-07-14T13:00:00"
    }
  ],
  "totalElements": 5,
  "totalPages": 1,
  "currentPage": 0
}
```

#### GET /api/videos/{videoId}
Get specific video details
```
Headers:
- Authorization: Bearer {token}
- X-User-ID: {userId}

Response:
{
  "video": {
    "id": 1,
    "userId": "user123",
    "title": "Game Analysis",
    // ... all video fields
    "analyticsData": "{\"team1PossessionPercentage\":65.5,\"team2PossessionPercentage\":34.5,\"totalPasses\":234,\"team1Passes\":152,\"team2Passes\":82,\"avgPlayerSpeed\":15.2,\"maxPlayerSpeed\":28.5,\"totalDistanceCovered\":12450.0}"
  },
  "originalVideoUrl": "https://spaces.url/original.mp4",
  "processedVideoUrl": "https://spaces.url/processed.mp4"
}
```

#### POST /api/videos/upload
Upload video file
```
Headers:
- Authorization: Bearer {token}
- X-User-ID: {userId}
- Content-Type: multipart/form-data

Form Data:
- file: File (video file)
- title: String
- description: String (optional)

Response:
{
  "videoId": "123",
  "message": "Upload successful",
  "fileName": "sample.mp4",
  "status": "UPLOADED"
}
```

#### POST /api/videos/{videoId}/process
Start video processing
```
Headers:
- Authorization: Bearer {token}
- X-User-ID: {userId}

Response:
{
  "message": "Processing started",
  "jobId": "job-456",
  "status": "PROCESSING"
}
```

#### DELETE /api/videos/{videoId}
Delete video
```
Headers:
- Authorization: Bearer {token}
- X-User-ID: {userId}

Response:
{
  "message": "Video deleted successfully",
  "deleted": true
}
```

## Frontend Data Transformation

### Backend Video → Frontend VideoAnalysis
```typescript
const transformVideoFromBackend = (backendVideo: any): VideoAnalysis => {
  // Parse analytics data
  let analytics = null;
  if (backendVideo.analyticsData) {
    analytics = JSON.parse(backendVideo.analyticsData);
  }

  // Map processing status
  const statusMap = {
    'UPLOADED': 'processing',
    'QUEUED': 'processing', 
    'PROCESSING': 'processing',
    'COMPLETED': 'completed',
    'FAILED': 'failed'
  };

  return {
    id: backendVideo.id.toString(),
    userId: backendVideo.userId,
    fileName: backendVideo.title,
    fileSize: backendVideo.fileSize,
    uploadDate: backendVideo.createdAt,
    duration: formatDuration(backendVideo.durationSeconds),
    status: statusMap[backendVideo.processingStatus],
    analytics: analytics
  };
};
```

## Analytics Data Structure

Your backend stores analytics in the `analyticsData` JSON field:

```json
{
  "team1PossessionPercentage": 65.5,
  "team2PossessionPercentage": 34.5,
  "totalPasses": 234,
  "team1Passes": 152,
  "team2Passes": 82,
  "avgPlayerSpeed": 15.2,
  "maxPlayerSpeed": 28.5,
  "totalDistanceCovered": 12450.0,
  "team1_color": "#FF0000",
  "team2_color": "#0000FF",
  "total_players_detected": 22
}
```

The frontend transforms this into enhanced team statistics for visualization.

## Processing Status Flow

1. **UPLOADED** → Video uploaded, queued for processing
2. **QUEUED** → In processing queue 
3. **PROCESSING** → Currently being analyzed
4. **COMPLETED** → Analysis complete, analytics available
5. **FAILED** → Processing failed

## Key Features Working

✅ **Secure Authentication**: JWT tokens with X-User-ID headers
✅ **Video Upload**: Multipart upload with progress tracking
✅ **Real-time Status**: Video processing status polling
✅ **Analytics Display**: Real team statistics from your Python AI
✅ **Video Management**: List, view, delete user videos
✅ **Error Handling**: Proper error states and retry mechanisms

The frontend now fully integrates with your Spring Boot backend and displays real analytics data from your Python AI processing service!
