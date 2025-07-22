export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface VideoAnalysis {
  id: string
  userId: string
  fileName: string
  fileSize: number
  uploadDate: string
  duration: string
  status: "processing" | "completed" | "failed"
  stats?: {
    totalPlays: number
    completionRate: number
    averageYards: number
    touchdowns: number
    interceptions: number
    passAccuracy: number
    rushingYards: number
    timeOfPossession: string
    redZoneEfficiency: number
  }

  originalVideoUrl?: string
  processedVideoUrl?: string
  analytics?: {
    team1PossessionPercentage?: number
    team2PossessionPercentage?: number
    totalPasses?: number
    team1Passes?: number
    team2Passes?: number
    avgPlayerSpeed?: number
    maxPlayerSpeed?: number
    totalDistanceCovered?: number
    analysisData?: Record<string, any>
  }
}
