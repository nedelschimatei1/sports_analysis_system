import numpy as np
import cv2
import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg


class MatchStatistics:
    def __init__(self):
                                          
        self.team1_color = (0, 0, 255)                  
        self.team2_color = (255, 0, 0)                   

    def set_team_colors(self, team1_color, team2_color):
        """Set team colors for visualization with robust format handling"""
                                                     
        if isinstance(team1_color, np.ndarray):
            self.team1_color = tuple(
                map(int, np.clip(team1_color, 0, 255).astype(int)))
        elif isinstance(team1_color, (list, tuple)) and len(team1_color) == 3:
            self.team1_color = tuple(
                map(lambda x: max(0, min(255, int(x))), team1_color))
        else:
                                           
            self.team1_color = (0, 0, 255)

                                                     
        if isinstance(team2_color, np.ndarray):
            self.team2_color = tuple(
                map(int, np.clip(team2_color, 0, 255).astype(int)))
        elif isinstance(team2_color, (list, tuple)) and len(team2_color) == 3:
            self.team2_color = tuple(
                map(lambda x: max(0, min(255, int(x))), team2_color))
        else:
                                           
            self.team2_color = (255, 0, 0)

    def generate_heatmaps(self, tracks, video_shape):
        """
        Generate player position heatmaps

        Args:
            tracks: Player tracking data
            video_shape: Dimensions of the video (height, width)

        Returns:
            Dictionary with team heatmaps
        """
        heatmaps = {1: np.zeros((video_shape[0], video_shape[1])),
                    2: np.zeros((video_shape[0], video_shape[1]))}

        for frame_data in tracks["players"]:
            for player_id, player_info in frame_data.items():
                if "team" not in player_info or "position" not in player_info:
                    continue

                team = player_info["team"]
                pos = player_info["position"]

                                         
                x, y = int(pos[0]), int(pos[1])
                if 0 <= x < video_shape[1] and 0 <= y < video_shape[0]:
                                                              
                    y_indices, x_indices = np.ogrid[-15:15, -15:15]
                    mask = x_indices**2 + y_indices**2 <= 15**2

                                                  
                    y_min, y_max = max(0, y-15), min(video_shape[0], y+15)
                    x_min, x_max = max(0, x-15), min(video_shape[1], x+15)

                    mask_height, mask_width = y_max - y_min, x_max - x_min
                    mask_y_min = 15 - (y - y_min)
                    mask_y_max = mask_y_min + mask_height
                    mask_x_min = 15 - (x - x_min)
                    mask_x_max = mask_x_min + mask_width

                    intensity = 0.1
                    if team in heatmaps:
                        heatmaps[team][y_min:y_max, x_min:x_max] += intensity *\
                            mask[mask_y_min:mask_y_max, mask_x_min:mask_x_max]

                            
        for team, heatmap in heatmaps.items():
            if np.max(heatmap) > 0:
                heatmaps[team] = (heatmap / np.max(heatmap))

                                   
        team1_heatmap_img = self._render_heatmap_image(
            heatmaps[1], self.team1_color)
        team2_heatmap_img = self._render_heatmap_image(
            heatmaps[2], self.team2_color)

        return {
            "team1": team1_heatmap_img,
            "team2": team2_heatmap_img
        }

    def _render_heatmap_image(self, heatmap_data, color):
        """Render a heatmap as a translucent image overlay"""
                            
        height, width = heatmap_data.shape
        heatmap_img = np.zeros((height, width, 3), dtype=np.uint8)

                                
        mask = heatmap_data > 0.05

        if isinstance(color, np.ndarray):
            b, g, r = int(color[0]), int(color[1]), int(color[2])
        else:
            b, g, r = color

                          
        heatmap_img[mask, 0] = (heatmap_data[mask] * b).astype(np.uint8)
        heatmap_img[mask, 1] = (heatmap_data[mask] * g).astype(np.uint8)
        heatmap_img[mask, 2] = (heatmap_data[mask] * r).astype(np.uint8)

        return heatmap_img

                         

    def generate_statistics_overlay(self, frame, statistics_data):
        """Create an overlay with match statistics"""
                                                                               
        overlay = frame.copy()
        cv2.rectangle(overlay, (40, 40), (600, 450), (0, 0, 0), -1)
        alpha = 0.7
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

                   
        cv2.putText(frame, "MATCH STATISTICS", (60, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

                        
        y_pos = 120
        for stat_name, stat_value in statistics_data.items():
            if isinstance(stat_value, dict):
                                                                                        
                continue

            cv2.putText(frame, f"{stat_name}: {stat_value}", (60, y_pos),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            y_pos += 30

                                              
        if "team_passes" in statistics_data:
            team1_passes = statistics_data["team_passes"].get(1, 0)
            team2_passes = statistics_data["team_passes"].get(2, 0)

                                      
            total_passes = team1_passes + team2_passes
            if total_passes > 0:
                bar_width = 400
                team1_width = int(bar_width * (team1_passes / total_passes))
                team2_width = bar_width - team1_width

                                          
                cv2.rectangle(frame, (60, y_pos), (60 + team1_width, y_pos + 20),
                              self.team1_color, -1)
                cv2.rectangle(frame, (60 + team1_width, y_pos),
                              (60 + team1_width + team2_width, y_pos + 20),
                              self.team2_color, -1)

                                                  
                cv2.putText(frame, f"{team1_passes/(team1_passes + team2_passes)*100:.0f}%", 
                            (70, y_pos + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                cv2.putText(frame, f"{team2_passes/(team1_passes + team2_passes)*100:.0f}%", 
                            (60 + team1_width + 10, y_pos + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                cv2.putText(frame, f"Pass Distribution", 
                            (60, y_pos + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        return frame

                     
