import { useState, useEffect } from 'react';

interface TeamStatistics {
  team1_possession: number;
  team2_possession: number;
  total_passes: number;
  team1_passes: number;
  team2_passes: number;
  analysis_data: {
    team1_color: string;
    team2_color: string;
    total_players_detected: number;
  };
}

interface SpeedAnalysis {
  avg_speed: number;
  max_speed: number;
  total_distance: number;
}

interface VideoAnalytics {
  team_stats: TeamStatistics;
  speed_analysis: SpeedAnalysis;
  video_id: string;
  processing_completed: boolean;
}

export const useVideoAnalytics = (videoId: string | null) => {
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async (videoId: string) => {
    setLoading(true);
    setError(null);
    const userId = getUserId();

    try {
      console.log('📊 Loading analytics...');

      const [summaryResponse, teamResponse, speedResponse] = await Promise.all([
        fetch(`http://localhost:8082/api/videos/${videoId}/analytics`, {
          headers: { 'X-User-ID': userId },
        }),
        fetch(`http://localhost:8082/api/videos/${videoId}/analytics/team-stats`, {
          headers: { 'X-User-ID': userId },
        }),
        fetch(`http://localhost:8082/api/videos/${videoId}/analytics/speed-distance`, {
          headers: { 'X-User-ID': userId },
        }),
      ]);

      if (summaryResponse.ok && teamResponse.ok && speedResponse.ok) {
        const [summary, teamStats, speedStats] = await Promise.all([
          summaryResponse.json(),
          teamResponse.json(),
          speedResponse.json(),
        ]);

        setAnalytics({
          team_stats: teamStats,
          speed_analysis: speedStats,
          video_id: videoId,
          processing_completed: summary.processing_completed,
        });

        console.log('✅ Analytics loaded successfully');
      } else {
        throw new Error('Failed to load analytics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(errorMessage);
      console.error('❌ Analytics error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (videoId) {
      loadAnalytics(videoId);
    }
  }, [videoId]);

  return {
    analytics,
    loading,
    error,
    reload: () => videoId && loadAnalytics(videoId),
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