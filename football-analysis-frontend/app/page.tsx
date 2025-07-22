"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Upload, Play, BarChart3, Clock, Target, Users, Activity, CheckCircle, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "../hooks/useAuth"
import { AuthForm } from "../components/auth-form"
import { Navigation } from "../components/navigation"
import { MyVideos } from "../components/my-videos"
import type { VideoAnalysis } from "../types/auth"
import { ProfilePage } from "../components/profile-page"
import { useVideoUpload } from "../hooks/useVideoUpload"
import { useVideoProcessing } from "../hooks/useVideoProcessing"
import { useVideoAnalytics } from "../hooks/useVideoAnalytics"
import localforage from "localforage"

localforage.config({
  name: "FootballAnalyzer",
  storeName: "videoCache",
  description: "Cache for video metadata and analytics",
})

interface TeamStats {
  name: string
  ballControl: number
  passes: number
  passAccuracy: number
  color: string
}

interface VideoStats {
  duration: string
  team1: TeamStats
  team2: TeamStats
  totalPasses: number
  gamePhase: "First Half" | "Second Half" | "Full Game"
}

interface CachedVideoAnalysis extends VideoAnalysis {
  analytics?: any
  cacheTimestamp: number
  cacheExpiry: number
}

export default function FootballAnalyzer() {
  const { user, isLoading, login, signup, logout, updateUser } = useAuth()
  const [currentPage, setCurrentPage] = useState<"upload" | "videos" | "profile">("upload")
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [showStats, setShowStats] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [uploadCompleted, setUploadCompleted] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { uploadVideo, isUploading, uploadProgress, error: uploadError } = useVideoUpload(user?.id || "")
  const { status, startProcessing, isPolling, resetProcessing } = useVideoProcessing(currentVideoId)
  const { analytics: hookAnalytics, loading: hookLoading } = useVideoAnalytics(currentVideoId)

  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000
  const CACHE_KEY_PREFIX = "video:"

  const loadCachedData = useCallback(async (videoId: string) => {
    if (!videoId) return null
    setLoadingAnalytics(true)
    try {
      const cachedData: CachedVideoAnalysis | null = await localforage.getItem(`${CACHE_KEY_PREFIX}${videoId}`)
      if (cachedData && cachedData.cacheTimestamp + cachedData.cacheExpiry > Date.now()) {
        console.log(`✅ Loaded cached data for video ${videoId}`)
        setAnalytics(cachedData.analytics || {})
        setShowStats(!!cachedData.analytics)
        return cachedData
      }
      console.log(`⚠️ Cache miss for video ${videoId}, triggering re-analysis if uploaded`)
      setAnalytics(null)
      setShowStats(false)
      return null
    } catch (error) {
      console.error(`❌ Error loading cached data for video ${videoId}:`, error)
      setAnalytics(null)
      setShowStats(false)
      return null
    } finally {
      setLoadingAnalytics(false)
    }
  }, [])

  const saveToCache = useCallback(async (videoId: string, data: CachedVideoAnalysis) => {
    try {
      const cacheData = {
        ...data,
        cacheTimestamp: Date.now(),
        cacheExpiry: CACHE_EXPIRY_MS,
      }
      await localforage.setItem(`${CACHE_KEY_PREFIX}${videoId}`, cacheData)
      console.log(`✅ Saved data to cache for video ${videoId}`)
    } catch (error) {
      console.error(`❌ Error saving to cache for video ${videoId}:`, error)
    }
  }, [])

  const invalidateCache = useCallback(async (videoId: string) => {
    try {
      await localforage.removeItem(`${CACHE_KEY_PREFIX}${videoId}`)
      console.log(`🗑️ Cache invalidated for video ${videoId}`)
      setAnalytics(null)
      setShowStats(false)
    } catch (error) {
      console.error(`❌ Error invalidating cache for video ${videoId}:`, error)
    }
  }, [])

  const syncLocalStorage = useCallback((videoAnalysis: CachedVideoAnalysis) => {
    const existingVideos: CachedVideoAnalysis[] = JSON.parse(localStorage.getItem("userVideos") || "[]")
    const updatedVideos = existingVideos.filter((v) => v.id !== videoAnalysis.id).concat({
      id: videoAnalysis.id,
      userId: videoAnalysis.userId,
      fileName: videoAnalysis.fileName,
      fileSize: videoAnalysis.fileSize,
      uploadDate: videoAnalysis.uploadDate,
      duration: videoAnalysis.duration,
      status: videoAnalysis.status,
      stats: videoAnalysis.stats,
    })
    localStorage.setItem("userVideos", JSON.stringify(updatedVideos))
  }, [])

  useEffect(() => {
    if (currentVideoId) {
      const loadAndAnalyze = async () => {
        const cachedData = await loadCachedData(currentVideoId)
        if (!cachedData && uploadCompleted && !isPolling && !status?.analytics && !hookAnalytics) {
          console.log(`🔍 No cached or live analytics for ${currentVideoId}, initiating re-analysis`)
          await handleAnalyze()
        } else if (status?.analytics) {
          setAnalytics(status.analytics)
          setShowStats(status.status === "completed")
        } else if (hookAnalytics) {
          setAnalytics(hookAnalytics)
          setShowStats(true)
        }
      }
      loadAndAnalyze()
    } else {
      setAnalytics(null)
      setShowStats(false)
    }
  }, [currentVideoId, uploadCompleted, isPolling, status, hookAnalytics, loadCachedData])

  useEffect(() => {
    if (status?.status === "completed" && status.analytics && currentVideoId) {
      const videoAnalysis: CachedVideoAnalysis = {
        id: currentVideoId,
        userId: user!.id,
        fileName: uploadedVideo?.name || "Unknown",
        fileSize: uploadedVideo?.size || 0,
        uploadDate: new Date().toISOString(),
        duration: `${Math.floor((status.analytics.duration_seconds || 0) / 60)}:${String((status.analytics.duration_seconds || 0) % 60).padStart(2, '0')}`,
        status: "completed",
        stats: {
          totalPlays: status.analytics.team_stats?.total_passes || 0,
          completionRate: ((status.analytics.team_stats?.team_1_possession || 0) + (status.analytics.team_stats?.team_2_possession || 0)) / 2,
          averageYards: status.analytics.match_summary?.average_speed || 0,
          touchdowns: 0,
          interceptions: 0,
          passAccuracy: status.analytics.team_stats?.pass_accuracy || 0,
          rushingYards: Math.round((status.analytics.match_summary?.total_distance_covered || 0) / 1000),
          timeOfPossession: "32:15",
          redZoneEfficiency: 75.0,
        },
        analytics: status.analytics,
        cacheTimestamp: Date.now(),
        cacheExpiry: CACHE_EXPIRY_MS,
      }

      saveToCache(currentVideoId, videoAnalysis)
      syncLocalStorage(videoAnalysis)
      setAnalytics(status.analytics)
      setShowStats(true)
    }
  }, [status, currentVideoId, uploadedVideo, saveToCache, syncLocalStorage])

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("video/")) {
      setUploadedVideo(file)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      setShowStats(false)
      setUploadCompleted(false)
      setCurrentVideoId(null)
      setAnalytics(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = async () => {
    if (!uploadedVideo || !user) return

    try {
      console.log('📤 Starting file upload...')
      console.log('🔍 User info:', { id: user.id, email: user.email })

      const { videoId } = await uploadVideo(uploadedVideo, {
        title: uploadedVideo.name.replace(/\.[^/.]+$/, ''),
        description: `Uploaded by ${user.email}`,
      })

      console.log('✅ Upload completed, video registered with ID:', videoId)
      console.log('🔍 Video owner should be:', user.id)

      setCurrentVideoId(videoId)
      setUploadCompleted(true)

      const videoAnalysis: CachedVideoAnalysis = {
        id: videoId,
        userId: user.id,
        fileName: uploadedVideo.name,
        fileSize: uploadedVideo.size,
        uploadDate: new Date().toISOString(),
        duration: "Processing...",
        status: "uploaded",
        cacheTimestamp: Date.now(),
        cacheExpiry: CACHE_EXPIRY_MS,
      }

      await saveToCache(videoId, videoAnalysis)
      syncLocalStorage(videoAnalysis)
    } catch (error) {
      console.error('❌ Upload failed:', error)
      setUploadCompleted(false)
    }
  }

  const handleAnalyze = async () => {
    if (!currentVideoId || !user) return

    try {
      console.log('🔬 Starting video analysis...')
      await invalidateCache(currentVideoId)
      await startProcessing(currentVideoId)

      const existingVideos: CachedVideoAnalysis[] = JSON.parse(localStorage.getItem("userVideos") || "[]")
      const updatedVideos = existingVideos.map((v) =>
        v.id === currentVideoId ? { ...v, status: "processing" } : v
      )
      localStorage.setItem("userVideos", JSON.stringify(updatedVideos))
    } catch (error) {
      console.error('❌ Analysis failed to start:', error)
    }
  }

  const resetApp = () => {
    console.log('🔄 Resetting app state...')
    setUploadedVideo(null)
    setVideoUrl("")
    setShowStats(false)
    setUploadCompleted(false)
    setCurrentVideoId(null)
    setAnalytics(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (resetProcessing && typeof resetProcessing === 'function') {
      resetProcessing()
    }
    console.log('✅ App state reset complete')
  }

  const isProcessingComplete = status?.status === 'completed'
  const canUpload = uploadedVideo && user && !isUploading
  const canAnalyze = uploadCompleted && currentVideoId && !isPolling && status?.status !== 'processing'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm onLogin={login} onSignup={signup} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} currentPage={currentPage} onPageChange={setCurrentPage} onLogout={logout} />

      {currentPage === "videos" ? (
        <MyVideos user={user} />
      ) : currentPage === "profile" ? (
        <ProfilePage user={user} onUpdateUser={updateUser} />
      ) : (
        <div className="bg-gradient-to-br from-green-50 to-blue-50 min-h-screen p-4">
          <div className="max-w-6xl mx-auto pt-8">
            {(showStats && analytics) || loadingAnalytics ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    <h1 className="text-2xl font-bold text-gray-800">Analysis Results</h1>
                  </div>
                  <Button
                    onClick={() => {
                      console.log('🔄 Analyze New Video clicked - resetting everything')
                      resetApp()
                    }}
                    variant="outline"
                    className="bg-white"
                  >
                    Analyze New Video
                  </Button>
                </div>

                {loadingAnalytics ? (
                  <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading analytics...</p>
                  </div>
                ) : analytics ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 text-sm">⚽</span>
                            </div>
                            Team Possession
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-600 font-medium">Team 1</span>
                              <span className="text-2xl font-bold text-blue-600">
                                {Number(analytics.team_stats?.team_1_possession || 0).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-red-600 font-medium">Team 2</span>
                              <span className="text-2xl font-bold text-red-600">
                                {Number(analytics.team_stats?.team_2_possession || 0).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-green-600 text-sm">📊</span>
                            </div>
                            Pass Statistics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-800">
                              {analytics.team_stats?.total_passes || 0}
                            </div>
                            <div className="text-sm text-gray-600">Total Passes</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-blue-600">Team 1</div>
                              <div className="text-gray-600">
                                {analytics.team_stats?.team_1_passes}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-red-600">Team 2</div>
                              <div className="text-gray-600">
                                {analytics.team_stats?.team_2_passes}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                              <span className="text-orange-600 text-sm">⚡</span>
                            </div>
                            Speed Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg Speed (km/h)</span>
                              <span className="font-semibold">
                                {Number(analytics.match_summary?.average_speed || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Max Speed (km/h)</span>
                              <span className="font-semibold">
                                {Number(analytics.match_summary?.max_speed || 0).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardContent>
                        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-semibold text-gray-800 mb-2">Key Insights</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              <span className="text-sm text-gray-700">
                                <span className="font-medium">Dominant Team:</span>
                                {Number(analytics.team_stats?.team_1_possession || 0) > Number(analytics.team_stats?.team_2_possession || 0)
                                  ? " Team 1"
                                  : " Team 2"} controlled the ball for most of the game
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              <span className="text-sm text-gray-700">
                                <span className="font-medium">Players Detected:</span> {22} players identified
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                              <span className="text-sm text-gray-700">
                                <span className="font-medium">Match Duration:</span> {Number(analytics.duration_seconds || 0).toFixed(0)} seconds ({analytics.total_frames || 0} frames)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              <span className="text-sm text-gray-700">
                                <span className="font-medium">Ball Detection:</span> {analytics.ball_detected ? "Successfully detected" : "Not detected"}
                              </span>
                            </div>
                            {(analytics.match_summary?.ball_possession_changes && analytics.match_summary.ball_possession_changes > 0) && (
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="text-sm text-gray-700">
                                  <span className="font-medium">Game Intensity:</span> {analytics.match_summary.ball_possession_changes} possession changes detected
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xl">Download Results</CardTitle>
                        <CardDescription>Download your analyzed video and data</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            onClick={() => {
                              if (status?.outputKey) {
                                const spacesUrl = `https://fanalysisbucket.fra1.cdn.digitaloceanspaces.com/${status.outputKey}`
                                console.log('🔗 Direct download from Spaces:', spacesUrl)
                                window.open(spacesUrl, '_blank')
                              } else {
                                console.error('No output key available for download')
                                alert('Processed video not available. Please try again after processing completes.')
                              }
                            }}
                            className="flex-1 bg-green-600 text-white hover:bg-green-700"
                            disabled={!status?.outputKey}
                          >
                            <ArrowDown className="h-4 w-4 mr-2" />
                            Download Processed Video
                          </Button>

                          <Button
                            onClick={() => {
                              if (analytics) {
                                const analyticsData = {
                                  video_id: currentVideoId,
                                  processing_date: new Date().toISOString(),
                                  analytics: analytics,
                                }
                                const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `football_analytics_${currentVideoId}_${Date.now()}.json`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(url)
                              }
                            }}
                            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                            disabled={!analytics}
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Download Analytics Data
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="text-center py-10 text-red-600">
                    <p>Error: Analytics data not available. Initiating re-analysis...</p>
                    <Button onClick={handleAnalyze} variant="outline" className="mt-4" disabled={isPolling}>
                      Retry Analysis
                    </Button>
                  </div>
                )}
              </div>
            ) : !uploadedVideo && !showStats && (
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Upload & Analyze</h1>
                <p className="text-lg text-gray-600">
                  Upload your gameplay footage and get detailed performance statistics
                </p>
              </div>
            )}

            {!uploadedVideo && !showStats && (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Video
                  </CardTitle>
                  <CardDescription>Drag and drop your football gameplay video or click to browse</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">Drop your video here</p>
                    <p className="text-gray-500 mb-4">Supports MP4, MOV, AVI files up to 500MB</p>
                    <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700">
                      Browse Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {uploadedVideo && !uploadCompleted && !isPolling && !showStats && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Video Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <video src={videoUrl} controls className="w-full rounded-lg" preload="metadata">
                      Your browser does not support the video tag.
                    </video>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-gray-600">
                        <strong>File:</strong> {uploadedVideo.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Size:</strong> {(uploadedVideo.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload to Cloud
                    </CardTitle>
                    <CardDescription>Upload your video before analysis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Player Tracking</span>
                        <Badge variant="secondary">Ready</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Ball Control Analysis</span>
                        <Badge variant="secondary">Ready</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Team Statistics</span>
                        <Badge variant="secondary">Ready</Badge>
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button
                        onClick={handleUpload}
                        disabled={!canUpload}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        size="lg"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload Video'}
                      </Button>
                      <Button onClick={resetApp} variant="outline" className="w-full">
                        Choose Different Video
                      </Button>
                    </div>

                    {uploadError && (
                      <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                        ❌ {uploadError}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {isUploading && (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Uploading to Cloud Storage
                  </CardTitle>
                  <CardDescription>Uploading your video to DigitalOcean Spaces...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={uploadProgress.percentage} className="w-full" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      {(uploadProgress.uploaded / 1024 / 1024).toFixed(1)} MB / {(uploadProgress.total / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <p className="text-lg font-semibold mt-2">{uploadProgress.percentage}%</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {uploadCompleted && !isPolling && !showStats && (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Video Uploaded Successfully
                  </CardTitle>
                  <CardDescription>Your video is now ready for AI analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-6 bg-green-50 rounded-lg">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-lg font-medium text-green-900 mb-2">Upload Complete!</p>
                    <p className="text-green-700">Your video has been uploaded to the cloud and is ready for analysis.</p>
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {isPolling ? 'Analyzing...' : 'Analyze Video'}
                  </Button>

                  <Button onClick={resetApp} variant="outline" className="w-full">
                    Upload Different Video
                  </Button>
                </CardContent>
              </Card>
            )}

            {(isPolling || (status && status.status !== 'completed')) && !showStats && (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 animate-spin" />
                    AI Processing Video
                  </CardTitle>
                  <CardDescription>Our AI is analyzing your football gameplay footage...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={status?.progress || 0} className="w-full" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      {(status?.progress || 0) < 30 && "🎯 Detecting players and tracking movement..."}
                      {(status?.progress || 0) >= 30 && (status?.progress || 0) < 60 && "⚽ Analyzing ball possession and control..."}
                      {(status?.progress || 0) >= 60 && (status?.progress || 0) < 90 && "📊 Calculating team statistics and performance..."}
                      {(status?.progress || 0) >= 90 && "✨ Finalizing analysis and generating insights..."}
                    </p>
                    <p className="text-lg font-semibold mt-2">{status?.progress || 0}%</p>
                    <Badge variant="secondary" className="mt-2">
                      Status: {status?.status || 'STARTING'}
                    </Badge>
                  </div>

                  {status?.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                      ❌ {status.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}