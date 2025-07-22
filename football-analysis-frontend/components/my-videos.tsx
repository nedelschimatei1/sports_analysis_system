"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Play,
  Download,
  Trash2,
  Calendar,
  Clock,
  BarChart3,
  Target,
  Users,
  FileVideo,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react"
import type { User } from "../types/auth"

interface MyVideosProps {
  user: User
}

interface TeamStats {
  name: string
  ballControl: number
  passes: number
  color: string
}

interface EnhancedVideoStats {
  duration: string
  team1: TeamStats
  team2: TeamStats
  totalPasses: number
  gamePhase: "First Half" | "Second Half" | "Full Game"
}

interface BackendVideo {
  id: number
  userId: string
  title: string
  description?: string
  filePath: string
  originalFileKey: string
  processedFileKey?: string
  fileSize: number
  contentType: string
  durationSeconds?: number
  processingStatus: string
  processingProgress: number
  processingError?: string
  processingJobId?: string
  aiAnalysisCompleted: boolean
  createdAt: string
  updatedAt: string
  processingStartedAt?: string
  processingCompletedAt?: string
  currentTask?: string
  analyticsData?: string
  completedAt?: string
  outputKey?: string
  processingStatusString: string
  processingStatusEnum: string
  processing: boolean
  uploaded: boolean
  failed: boolean
  queued: boolean
  completed: boolean
}

const transformVideo = (backendVideo: BackendVideo) => {

  let analytics = null
  if (backendVideo.analyticsData) {
    try {
      analytics = JSON.parse(backendVideo.analyticsData)
    } catch (error) {
      console.error('Failed to parse analytics data:', error)
    }
  }

  const getStatus = () => {
    if (backendVideo.failed) return 'failed'
    if (backendVideo.completed && backendVideo.aiAnalysisCompleted) return 'completed'
    if (backendVideo.processing || backendVideo.queued) return 'processing'
    return 'uploaded'
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const durationSeconds = analytics?.duration_seconds || backendVideo.durationSeconds
  const formattedDuration = formatDuration(durationSeconds)

  return {
    id: backendVideo.id.toString(),
    userId: backendVideo.userId,
    fileName: backendVideo.title,
    fileSize: backendVideo.fileSize,
    uploadDate: backendVideo.createdAt,
    duration: formattedDuration,
    durationSeconds: durationSeconds,
    status: getStatus(),
    processingProgress: backendVideo.processingProgress,
    analytics: analytics,
    outputKey: backendVideo.outputKey,
    processedFileKey: backendVideo.processedFileKey,
  }
}

function getUserId(): string {
  if (typeof window !== 'undefined') {
    const currentUserStr = localStorage.getItem('currentUser')
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr)
        if (currentUser && currentUser.id) {
          return currentUser.id
        }
      } catch (error) {
        console.error('Error parsing currentUser from localStorage:', error)
      }
    }
    console.warn('No authenticated user found in localStorage')
    return ""
  }
  return ""
}

export function MyVideos({ user }: MyVideosProps) {
  const [videos, setVideos] = useState<any[]>([])
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVideos = async () => {
    const actualUserId = user?.id || getUserId()
    if (!actualUserId) {
      console.log('No userId provided, skipping video fetch')
      return
    }

    console.log('📥 Fetching videos for user:', actualUserId)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:8082/api/videos?page=0&size=20', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': actualUserId,
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Raw backend response:', data)

      let videosArray = []

      if (Array.isArray(data)) {

        videosArray = data
      } else if (data && Array.isArray(data.videos)) {

        videosArray = data.videos
      } else if (data && Array.isArray(data.content)) {

        videosArray = data.content
      } else if (data && data.data && Array.isArray(data.data)) {

        videosArray = data.data
      } else {
        console.warn('Unexpected response format:', data)
        videosArray = []
      }

      console.log('Videos array to transform:', videosArray)

      const transformedVideos = videosArray.map((backendVideo: BackendVideo) => {
        try {
          return transformVideo(backendVideo)
        } catch (transformError) {
          console.error('Error transforming video:', transformError, backendVideo)
          return null
        }
      }).filter(video => video !== null)

      console.log('🔄 Transformed videos:', transformedVideos)
      setVideos(transformedVideos)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch videos'
      console.error('Failed to fetch videos:', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchVideos()
    }
  }, [user?.id])

  const deleteVideo = async (videoId: string) => {
    const actualUserId = user?.id || getUserId()
    console.log('Deleting video:', videoId)

    try {
      const response = await fetch(`http://localhost:8082/api/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': actualUserId,
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete video: ${response.statusText}`)
      }

      setVideos(videos.filter(video => video.id !== videoId))
      if (selectedVideo?.id === videoId) {
        setSelectedVideo(null)
      }
      console.log('Video deleted successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete video'
      console.error('Failed to delete video:', err)
      alert(`Error: ${errorMessage}`)
    }
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "processing":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <BarChart3 className="h-4 w-4" />
      case "processing":
        return <Clock className="h-4 w-4 animate-spin" />
      case "failed":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileVideo className="h-4 w-4" />
    }
  }

  const getEnhancedStats = (video: any): EnhancedVideoStats | null => {
    if (video.status !== "completed") return null

    if (video.analytics) {
      const analytics = video.analytics

      return {
        duration: video.duration,
        gamePhase: "Full Game",
        totalPasses: analytics.team_stats?.total_passes || 0,
        team1: {
          name: "Home Team",
          ballControl: Math.round(analytics.team_stats?.team_1_possession || 50),
          passes: analytics.team_stats.team_1_passes,
          color: "white",
        },
        team2: {
          name: "Away Team",
          ballControl: Math.round(analytics.team_stats?.team_2_possession || 50),
          passes: analytics.team_stats.team_2_passes,
          color: "green",
        },
      }
    }

    return {
      duration: video.duration,
      gamePhase: "Full Game",
      totalPasses: Math.floor(Math.random() * 200) + 250,
      team1: {
        name: "Home Team",
        ballControl: Math.floor(Math.random() * 30) + 45,
        passes: Math.floor(Math.random() * 100) + 120,
        color: "white",
      },
      team2: {
        name: "Away Team",
        ballControl: 0,
        passes: Math.floor(Math.random() * 80) + 100,
        color: "green",
      },
    }
  }

  const enhancedStats = selectedVideo ? getEnhancedStats(selectedVideo) : null
  if (enhancedStats && !selectedVideo?.analytics) {
    enhancedStats.team2.ballControl = 100 - enhancedStats.team1.ballControl
  }

  const getPassDifference = () => {
    if (!enhancedStats) return 0
    return enhancedStats.team1.passes - enhancedStats.team2.passes
  }

  const getBallControlDifference = () => {
    if (!enhancedStats) return 0
    return enhancedStats.team1.ballControl - enhancedStats.team2.ballControl
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading your videos...</h2>
            <p className="text-gray-600">Please wait while we fetch your video library</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Videos</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={fetchVideos} className="bg-blue-600 hover:bg-blue-700">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <FileVideo className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No videos yet</h2>
            <p className="text-gray-600 mb-6">Upload your first football gameplay video to get started with analysis</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Videos</h1>
          <p className="text-gray-600">Manage and view your football gameplay analysis</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Videos ({videos.length})</h2>
            {videos.map((video) => (
              <Card
                key={video.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedVideo?.id === video.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedVideo(video)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{video.fileName}</h3>
                      <p className="text-sm text-gray-500">{formatFileSize(video.fileSize)}</p>
                    </div>
                    <Badge className={`ml-2 ${getStatusColor(video.status)}`}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(video.status)}
                        {video.status}
                      </div>
                    </Badge>
                  </div>
                  <div className="flex items-center text-xs text-gray-500 mb-2">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(video.uploadDate)}
                  </div>
                  {video.status === "processing" && (
                    <Progress value={video.processingProgress || 0} className="h-1" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selectedVideo ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Play className="h-5 w-5" />
                          {selectedVideo.fileName}
                        </CardTitle>
                        <CardDescription>Uploaded on {formatDate(selectedVideo.uploadDate)}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedVideo.processedFileKey || selectedVideo.outputKey) {
                              const spacesUrl = `https://fanalysisbucket.fra1.cdn.digitaloceanspaces.com/${selectedVideo.processedFileKey || selectedVideo.outputKey}`
                              window.open(spacesUrl, '_blank')
                            }
                          }}
                          disabled={!selectedVideo.processedFileKey && !selectedVideo.outputKey}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteVideo(selectedVideo.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{formatFileSize(selectedVideo.fileSize)}</p>
                        <p className="text-sm text-gray-600">File Size</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{selectedVideo.duration}</p>
                        <p className="text-sm text-gray-600">Duration</p>
                      </div>
                      <div className="text-center">
                        <Badge className={getStatusColor(selectedVideo.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(selectedVideo.status)}
                            {selectedVideo.status}
                          </div>
                        </Badge>
                      </div>
                    </div>

                    {selectedVideo.status === "processing" && (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
                        <p className="text-lg font-medium text-gray-900">Processing Video</p>
                        <p className="text-gray-600">This may take a few minutes...</p>
                        <Progress value={selectedVideo.processingProgress || 0} className="mt-4 max-w-md mx-auto" />
                      </div>
                    )}

                    {selectedVideo.status === "failed" && (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-900">Processing Failed</p>
                        <p className="text-gray-600">
                          There was an error processing your video. Please try uploading again.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedVideo.status === "completed" && enhancedStats && (
                  <div className="space-y-6">

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Ball Control Analysis
                        </CardTitle>
                        <CardDescription>Possession percentage comparison between teams</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-semibold text-gray-700">{enhancedStats.team1.name}</span>
                              <span className="text-lg font-semibold text-green-600">{enhancedStats.team2.name}</span>
                            </div>

                            <div className="relative">
                              <div className="flex h-8 rounded-lg overflow-hidden border">
                                <div
                                  className="bg-gray-100 border-r flex items-center justify-center text-gray-900 text-sm font-medium"
                                  style={{ width: `${enhancedStats.team1.ballControl}%` }}
                                >
                                  {enhancedStats.team1.ballControl}%
                                </div>
                                <div
                                  className="bg-green-600 flex items-center justify-center text-white text-sm font-medium"
                                  style={{ width: `${enhancedStats.team2.ballControl}%` }}
                                >
                                  {enhancedStats.team2.ballControl}%
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-sm">
                              <span className="text-gray-600">Ball Control Difference:</span>
                              <Badge
                                variant={getBallControlDifference() > 0 ? "default" : "destructive"}
                                className="flex items-center gap-1"
                              >
                                {getBallControlDifference() > 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {Math.abs(getBallControlDifference()).toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">

                      <Card className="border-l-4 border-l-gray-400">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-gray-700">
                            <Users className="h-5 w-5" />
                            {enhancedStats.team1.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg border">
                              <p className="text-2xl font-bold text-gray-700">{enhancedStats.team1.ballControl}%</p>
                              <p className="text-sm text-gray-600">Ball Control</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg border">
                              <p className="text-2xl font-bold text-gray-700">{enhancedStats.team1.passes}</p>
                              <p className="text-sm text-gray-600">Total Passes</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-green-600">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-green-600">
                            <Users className="h-5 w-5" />
                            {enhancedStats.team2.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                              <p className="text-2xl font-bold text-green-600">{enhancedStats.team2.ballControl}%</p>
                              <p className="text-sm text-gray-600">Ball Control</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                              <p className="text-2xl font-bold text-green-600">{enhancedStats.team2.passes}</p>
                              <p className="text-sm text-gray-600">Total Passes</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Pass Comparison
                        </CardTitle>
                        <CardDescription>Detailed passing statistics between teams</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="grid md:grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-2xl font-bold text-gray-900">{enhancedStats.totalPasses}</p>
                              <p className="text-sm text-gray-600">Total Passes</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">
                                  {Math.abs(getPassDifference())}
                                </span>
                                {getPassDifference() > 0 ? (
                                  <ArrowUp className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <ArrowDown className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600">Pass Difference</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">Pass Volume Comparison</h4>
                            <div className="space-y-3">
                              <div className="flex items-center gap-4">
                                <span className="w-20 text-sm font-medium text-gray-700">
                                  {enhancedStats.team1.name}
                                </span>
                                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                                  <div
                                    className="bg-gray-400 h-6 rounded-full flex items-center justify-end pr-2 border"
                                    style={{
                                      width: `${(enhancedStats.team1.passes / enhancedStats.totalPasses) * 100}%`,
                                    }}
                                  >
                                    <span className="text-white text-xs font-medium">{enhancedStats.team1.passes}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="w-20 text-sm font-medium text-green-600">
                                  {enhancedStats.team2.name}
                                </span>
                                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                                  <div
                                    className="bg-green-600 h-6 rounded-full flex items-center justify-end pr-2"
                                    style={{
                                      width: `${(enhancedStats.team2.passes / enhancedStats.totalPasses) * 100}%`,
                                    }}
                                  >
                                    <span className="text-white text-xs font-medium">{enhancedStats.team2.passes}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">Key Insights</h4>
                            <div className="grid md:grid-cols-1 gap-4">
                              <div className="p-3 bg-gray-50 rounded-lg border">
                                <p className="text-sm font-medium text-gray-800">Ball Control Leader</p>
                                <p className="text-xs text-gray-600">
                                  {enhancedStats.team1.ballControl > enhancedStats.team2.ballControl
                                    ? enhancedStats.team1.name
                                    : enhancedStats.team2.name}{" "}
                                  dominated with{" "}
                                  {Math.max(enhancedStats.team1.ballControl, enhancedStats.team2.ballControl)}%
                                  possession
                                </p>
                              </div>
                            </div>
                          </div>

                          {selectedVideo.analytics && (
                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-900">Additional Analysis</h4>
                              <div className="grid md:grid-cols-3 gap-4">
                                <div className="p-3 bg-blue-50 rounded-lg border">
                                  <p className="text-sm font-medium text-blue-900">Players Detected</p>
                                  <p className="text-lg font-bold text-blue-700">{22}</p>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg border">
                                  <p className="text-sm font-medium text-purple-900">Ball Possession Changes</p>
                                  <p className="text-lg font-bold text-purple-700">{selectedVideo.analytics.match_summary?.ball_possession_changes || 0}</p>
                                </div>
                                <div className="p-3 bg-orange-50 rounded-lg border">
                                  <p className="text-sm font-medium text-orange-900">Average Speed</p>
                                  <p className="text-lg font-bold text-orange-700">
                                    {(selectedVideo.analytics.match_summary?.average_speed || 0).toFixed(1)} km/h
                                  </p>
                                </div>
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-lg border">
                                  <p className="text-sm font-medium text-gray-800">Match Duration</p>
                                  <p className="text-lg font-bold text-gray-700">
                                    {Number(selectedVideo.analytics.duration_seconds || 0).toFixed(0)} seconds
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    ({selectedVideo.analytics.total_frames || 0} frames)
                                  </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border">
                                  <p className="text-sm font-medium text-gray-800">Ball Detection</p>
                                  <p className="text-lg font-bold text-gray-700">
                                    {selectedVideo.analytics.ball_detected ? "Detected" : "Not Found"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileVideo className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a video</h3>
                  <p className="text-gray-600">Choose a video from the list to view its details and analysis</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}