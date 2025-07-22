"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  User,
  Calendar,
  Video,
  Clock,
  BarChart3,
  Trophy,
  TrendingUp,
  Save,
  Edit,
  CheckCircle,
  Lock,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import type { User as UserType, VideoAnalysis } from "../types/auth"

interface ProfilePageProps {
  user: UserType
  onUpdateUser: (updatedUser: UserType) => void
}

interface UserStats {
  totalVideos: number
  completedAnalyses: number
  processingVideos: number
  totalAnalysisTime: string
  averageCompletionRate: number
  bestPerformance: {
    touchdowns: number
    completionRate: number
    videoName: string
  }
}

export function ProfilePage({ user, onUpdateUser }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [saveMessage, setSaveMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [userStats, setUserStats] = useState<UserStats>({
    totalVideos: 0,
    completedAnalyses: 0,
    processingVideos: 0,
    totalAnalysisTime: "0:00:00",
    averageCompletionRate: 0,
    bestPerformance: {
      touchdowns: 0,
      completionRate: 0,
      videoName: "N/A",
    },
  })
  const [currentUser, setCurrentUser] = useState<UserType>(user)
  const [hasFetched, setHasFetched] = useState(false)

  const getAuthToken = () => {
    const cookies = document.cookie.split(";").reduce((acc: { [key: string]: string }, cookie) => {
      const [name, value] = cookie.trim().split("=")
      acc[name] = value
      return acc
    }, {})
    return cookies["authToken"] || localStorage.getItem("authToken") || null
  }

  const fetchUserData = async () => {
    try {
      const token = getAuthToken()
      if (!token) {
        setErrorMessage("You must be logged in to fetch user data")
        setTimeout(() => setErrorMessage(""), 3000)
        return
      }

      const response = await fetch("http://localhost:4005/api/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch user data")
      }

      const data = await response.json()
      setCurrentUser(data.user)
      onUpdateUser(data.user)
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to fetch user data")
      setTimeout(() => setErrorMessage(""), 3000)
    }
  }

  useEffect(() => {
    if (!hasFetched) {
      fetchUserData()
      setHasFetched(true)
    }

    const allVideos = JSON.parse(localStorage.getItem("userVideos") || "[]")
    const userVideos = allVideos.filter((video: VideoAnalysis) => video.userId === user.id)

    const completedVideos = userVideos.filter((video: VideoAnalysis) => video.status === "completed")
    const processingVideos = userVideos.filter((video: VideoAnalysis) => video.status === "processing")

    const totalMinutes = userVideos.length * 45
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const totalAnalysisTime = `${hours}:${minutes.toString().padStart(2, "0")}:00`

    const avgCompletionRate =
      completedVideos.length > 0
        ? completedVideos.reduce((sum: number, video: VideoAnalysis) => sum + (video.stats?.completionRate || 0), 0) /
          completedVideos.length
        : 0

    let bestPerformance = {
      touchdowns: 0,
      completionRate: 0,
      videoName: "N/A",
    }

    if (completedVideos.length > 0) {
      const bestVideo = completedVideos.reduce((best: VideoAnalysis, current: VideoAnalysis) => {
        const bestScore = (best.stats?.touchdowns || 0) + (best.stats?.completionRate || 0)
        const currentScore = (current.stats?.touchdowns || 0) + (current.stats?.completionRate || 0)
        return currentScore > bestScore ? current : best
      })

      bestPerformance = {
        touchdowns: bestVideo.stats?.touchdowns || 0,
        completionRate: bestVideo.stats?.completionRate || 0,
        videoName: bestVideo.fileName,
      }
    }

    setUserStats({
      totalVideos: userVideos.length,
      completedAnalyses: completedVideos.length,
      processingVideos: processingVideos.length,
      totalAnalysisTime,
      averageCompletionRate: Math.round(avgCompletionRate * 10) / 10,
      bestPerformance,
    })
  }, [hasFetched])

  const handleSaveProfile = async () => {
    try {
      const token = getAuthToken()
      if (!token) {
        setErrorMessage("You must be logged in to update your profile")
        setTimeout(() => setErrorMessage(""), 3000)
        return
      }

      const response = await fetch("http://localhost:4005/api/auth/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update profile")
      }

      const updatedUser = await response.json()
      setCurrentUser(updatedUser.user)
      onUpdateUser(updatedUser.user)
      setIsEditing(false)
      setSaveMessage("Profile updated successfully!")
      setTimeout(() => setSaveMessage(""), 3000)

      await fetchUserData()
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to update profile")
      setTimeout(() => setErrorMessage(""), 3000)
    }
  }

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage("Passwords do not match!")
      setTimeout(() => setErrorMessage(""), 3000)
      return
    }

    try {
      const token = getAuthToken()
      if (!token) {
        setErrorMessage("You must be logged in to change your password")
        setTimeout(() => setErrorMessage(""), 3000)
        return
      }

      const response = await fetch("http://localhost:4005/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update password")
      }

      setSaveMessage("Password updated successfully!")
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setTimeout(() => setSaveMessage(""), 3000)

      await fetchUserData()
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to update password")
      setTimeout(() => setErrorMessage(""), 3000)
    }
  }

  const handleRefreshUserData = async () => {
    await fetchUserData()
    setSaveMessage("User data refreshed!")
    setTimeout(() => setSaveMessage(""), 3000)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
            <p className="text-gray-600">Manage your account and view your football analysis statistics</p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefreshUserData}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {(saveMessage || errorMessage) && (
          <Alert className={`mb-6 ${errorMessage ? "border-red-500" : ""}`}>
            <CheckCircle className={`h-4 w-4 ${errorMessage ? "text-red-500" : ""}`} />
            <AlertDescription>{saveMessage || errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarFallback className="text-2xl">
                    {currentUser.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl">{currentUser.name}</CardTitle>
                <CardDescription>{currentUser.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {formatDate(currentUser.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Video className="h-4 w-4" />
                  <span>{userStats.totalVideos} videos uploaded</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BarChart3 className="h-4 w-4" />
                  <span>{userStats.completedAnalyses} analyses completed</span>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Analysis Time</span>
                  <Badge variant="secondary">{userStats.totalAnalysisTime}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Completion Rate</span>
                  <Badge variant="secondary">{userStats.averageCompletionRate}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Processing Videos</span>
                  <Badge variant="outline">{userStats.processingVideos}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Performance Overview
                    </CardTitle>
                    <CardDescription>Your football analysis performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Videos Analyzed</span>
                            <span className="text-sm text-gray-600">
                              {userStats.completedAnalyses}/{userStats.totalVideos}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${
                                  userStats.totalVideos > 0
                                    ? (userStats.completedAnalyses / userStats.totalVideos) * 100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Average Completion Rate</span>
                            <span className="text-sm text-gray-600">{userStats.averageCompletionRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${userStats.averageCompletionRate}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userStats.totalVideos === 0 ? (
                        <p className="text-gray-500 text-center py-4">No recent activity</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Video className="h-4 w-4 text-blue-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Videos uploaded</p>
                              <p className="text-xs text-gray-600">{userStats.totalVideos} total</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <BarChart3 className="h-4 w-4 text-green-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Analyses completed</p>
                              <p className="text-xs text-gray-600">{userStats.completedAnalyses} completed</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                    <CardDescription>Update your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isEditing ? (
                        <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          Edit Profile
                        </Button>
                      ) : (
                        <>
                          <Button onClick={handleSaveProfile} className="flex items-center gap-2">
                            <Save className="h-4 w-4" />
                            Save Changes
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false)
                              setEditForm({ name: currentUser.name, email: currentUser.email })
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Email Notifications</h4>
                        <p className="text-sm text-gray-600">Receive updates about your video analyses</p>
                      </div>
                      <Badge variant="secondary">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">SMS Notifications</h4>
                        <p className="text-sm text-gray-600">Receive updates about your video analyses through text</p>
                      </div>
                      <Badge variant="secondary">Enabled</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      />
                    </div>
                    <Button onClick={handlePasswordChange} className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Update Password
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Account Security</CardTitle>
                    <CardDescription>Security information and settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className={`flex items-center gap-3 p-4 border rounded-lg ${
                        currentUser.failedLoginAttempts === 3
                          ? "bg-red-50 border-red-200"
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      {currentUser.failedLoginAttempts === 3 ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      <div>
                        <h4
                          className={`font-medium ${
                            currentUser.failedLoginAttempts === 3 ? "text-red-900" : "text-green-900"
                          }`}
                        >
                          Account {currentUser.failedLoginAttempts === 3 ? "Unprotected Account" : "Secure"}
                        </h4>
                        <p
                          className={`text-sm ${
                            currentUser.failedLoginAttempts === 3 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {currentUser.failedLoginAttempts === 3
                            ? "Account becomes unprotected after 3 failed attempts"
                            : "Your account is protected and secure"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Account Created</span>
                        <span>{formatDate(currentUser.createdAt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Last Login</span>
                        <span>{formatDate(currentUser.lastLoginTime)}</span>
                      </div>
                      {currentUser.failedLoginAttempts === 3 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Last Failed Attempt IP</span>
                            <span>{currentUser.lastFailedIp || "N/A"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Last Failed Attempt Location</span>
                            <span>{currentUser.lastFailedLocation || "N/A"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Last Failed Attempt Time</span>
                            <span>{formatDate(currentUser.lastFailedTime)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}