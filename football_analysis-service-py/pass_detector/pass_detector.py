import matplotlib.pyplot as plt
import numpy as np
import cv2
from matplotlib.backends.backend_agg import FigureCanvasAgg
from utils import measure_distance


class PassDetector:
    def __init__(self):
        self.min_pass_distance = 5
        self.pass_history = []
        self.interception_history = []
        self.possession_changes = []

    def detect_passes(self, tracks, team_mapping):
        """
        Detect passes between players by analyzing changes in ball possession.
        Also identifies interceptions when an opposing team player gets the ball.

        Args:
            tracks: Dictionary containing player and ball tracking data
            team_mapping: Dictionary mapping player IDs to team IDs

        Returns:
            List of detected passes with information about sender, receiver, and frame
        """
        passes = []
        interceptions = []
        possession_changes = []
        last_possession = {"player_id": None, "frame": 0, "team": None, "jersey_color": None}
        min_frames_between_possessions = 3
        possession_history = []

        for frame_num in range(1, len(tracks["players"])):
                                                    
            current_possessor = None

            for player_id, player_info in tracks["players"][frame_num].items():
                if player_info.get("has_ball", False):
                                                                    
                    jersey_color = self._get_enhanced_jersey_color(player_info, player_id)
                    
                    current_possessor = {
                        "player_id": player_id,
                        "frame": frame_num,
                        "team": player_info["team"],
                        "position": player_info.get("position_transformed"),
                        "team_color": player_info.get("team_color", (0, 0, 0)),
                        "jersey_color": jersey_color
                    }
                    possession_history.append(current_possessor)
                    break

                                                               
            if current_possessor is None:
                continue

                                                   
            if (last_possession["player_id"] is not None and
                    current_possessor["player_id"] != last_possession["player_id"]):

                                                                                            
                frames_since_last_change = frame_num - last_possession["frame"]
                if frames_since_last_change < min_frames_between_possessions:
                    continue

                                                                                  
                is_interception = self._detect_interception_by_color(
                    last_possession, current_possessor)

                                                                 
                possession_change = {
                    "from_player": last_possession["player_id"],
                    "to_player": current_possessor["player_id"],
                    "from_team": last_possession["team"],
                    "to_team": current_possessor["team"],
                    "from_jersey_color": last_possession["jersey_color"],
                    "to_jersey_color": current_possessor["jersey_color"],
                    "frame": frame_num,
                    "duration": frames_since_last_change,
                    "change_type": "interception" if is_interception else "same_team_pass",
                    "color_similarity": self._calculate_color_similarity(
                        last_possession["jersey_color"], current_possessor["jersey_color"])
                }
                possession_changes.append(possession_change)

                                                                                
                pass_distance = self._calculate_pass_distance(tracks, last_possession, current_possessor)

                                                     
                direct_path = self._validate_enhanced_ball_trajectory(
                    tracks, last_possession, current_possessor)

                                                                                                                     
                if not is_interception and current_possessor["team"] == last_possession["team"] and direct_path:
                                                                                      
                    if pass_distance is None or pass_distance >= self.min_pass_distance:
                        passes.append({
                            "from_player": last_possession["player_id"],
                            "to_player": current_possessor["player_id"],
                            "start_frame": last_possession["frame"],
                            "end_frame": frame_num,
                            "team": current_possessor["team"],
                            "team_color": current_possessor["team_color"],
                            "player_color": last_possession["jersey_color"],
                            "receiver_color": current_possessor["jersey_color"],
                            "distance": pass_distance,
                            "type": "pass",
                            "color_similarity": possession_change["color_similarity"]
                        })
                else:
                                                                                                   
                    if pass_distance is None or pass_distance >= self.min_pass_distance:
                        interceptions.append({
                            "from_player": last_possession["player_id"],
                            "to_player": current_possessor["player_id"],
                            "start_frame": last_possession["frame"],
                            "end_frame": frame_num,
                            "from_team": last_possession["team"],
                            "to_team": current_possessor["team"],
                            "team_color": current_possessor["team_color"],
                            "player_color": last_possession["jersey_color"],
                            "receiver_color": current_possessor["jersey_color"],
                            "distance": pass_distance,
                            "type": "interception",
                            "color_similarity": possession_change["color_similarity"],
                            "interception_reason": "team_change" if current_possessor["team"] != last_possession["team"] else "color_change"
                        })

                                    
            if current_possessor is not None:
                last_possession = current_possessor

        self.pass_history = passes
        self.interception_history = interceptions
        self.possession_changes = possession_changes
        return passes

    def _get_enhanced_jersey_color(self, player_info, player_id):
        """Get most accurate jersey color with enhanced fallbacks"""
                                                                      
        if "jersey_color" in player_info and player_info["jersey_color"] is not None:
            color = player_info["jersey_color"]
        elif "player_color" in player_info and player_info["player_color"] is not None:
            color = player_info["player_color"]
        elif "team_color" in player_info and player_info["team_color"] is not None:
            color = player_info["team_color"]
        else:
                                                               
            color = (255, 0, 0) if player_id % 2 == 0 else (0, 0, 255)
        
                                          
        if isinstance(color, (list, tuple)) and len(color) >= 3:
            return tuple(max(0, min(255, int(c))) for c in color[:3])
        elif isinstance(color, np.ndarray) and len(color) >= 3:
            return tuple(max(0, min(255, int(c))) for c in color[:3])
        else:
            return (0, 0, 255)

    def _detect_interception_by_color(self, last_possession, current_possessor):
        """Detect interception based on jersey color difference and team change"""
                                                 
        if last_possession["team"] != current_possessor["team"]:
            return True
        
                                                                            
        color_similarity = self._calculate_color_similarity(
            last_possession["jersey_color"], current_possessor["jersey_color"])
        
                                                                                   
                                                                                               
        if color_similarity < 0.3:
            return True
            
        return False

    def _calculate_color_similarity(self, color1, color2):
        """Calculate similarity between two colors (0.0 = very different, 1.0 = identical)"""
        if not color1 or not color2:
            return 0.0
            
                                                 
        c1 = np.array(color1[:3], dtype=float)
        c2 = np.array(color2[:3], dtype=float)
        
                                                   
        distance = np.sqrt(np.sum((c1 - c2) ** 2))
        max_distance = np.sqrt(3 * 255 ** 2)                             
        
                                                                           
        similarity = 1.0 - (distance / max_distance)
        return similarity

    def _calculate_pass_distance(self, tracks, last_possession, current_possessor):
        """Calculate distance between pass start and end positions"""
        if (last_possession["player_id"] in tracks["players"][last_possession["frame"]] and
            "position_transformed" in tracks["players"][last_possession["frame"]][last_possession["player_id"]] and
            current_possessor["position"] is not None):
            
            start_pos = tracks["players"][last_possession["frame"]][last_possession["player_id"]]["position_transformed"]
            end_pos = current_possessor["position"]
            
            if start_pos is not None and end_pos is not None:
                return measure_distance(start_pos, end_pos)
        return None

    def _validate_enhanced_ball_trajectory(self, tracks, last_possession, current_possessor):
        """Enhanced ball trajectory validation"""
        frame_diff = current_possessor["frame"] - last_possession["frame"]
        
                                                  
        if frame_diff <= 5:
            return True
            
        if "ball" not in tracks:
            return True

                                               
        ball_positions = []
        for f in range(last_possession["frame"], current_possessor["frame"], 
                      max(1, frame_diff // 4)):                                    
            if (f < len(tracks["ball"]) and 
                tracks["ball"][f] and 
                "position_transformed" in tracks["ball"][f] and
                tracks["ball"][f]["position_transformed"] is not None):
                ball_positions.append(tracks["ball"][f]["position_transformed"])

                                        
        if len(ball_positions) >= 3:
            start_pos = tracks["players"][last_possession["frame"]][last_possession["player_id"]].get("position_transformed")
            end_pos = current_possessor["position"]
            
            if start_pos and end_pos:
                return self._check_ball_trajectory(ball_positions, start_pos, end_pos)
        
        return True

    def _check_ball_trajectory(self, ball_positions, start_pos, end_pos):
        """
        Check if ball trajectory is consistent with a pass (approximately straight line)
        Returns True if trajectory seems plausible for a pass
        """
        if not ball_positions or not start_pos or not end_pos:
            return True                                               

                                              
        total_distance = measure_distance(start_pos, end_pos)
        if total_distance < 1:                          
            return True

                                                                    
        max_deviation = 0
        for pos in ball_positions:
                                                   
            deviation = self._distance_point_to_line(pos, start_pos, end_pos)
            max_deviation = max(max_deviation, deviation)

                                                  
        tolerance = min(0.4, 0.2 + (total_distance / 100))                                    
        return max_deviation <= tolerance * total_distance

    def _distance_point_to_line(self, point, line_start, line_end):
        """Calculate distance from point to line segment"""
        if not point or len(point) < 2:
            return float('inf')
            
        x0, y0 = point[:2]
        x1, y1 = line_start[:2]
        x2, y2 = line_end[:2]

                                     
        l2 = (x2-x1)**2 + (y2-y1)**2
        if l2 == 0:                           
            return measure_distance(point, line_start)

                                        
        t = max(0, min(1, ((x0-x1)*(x2-x1) + (y0-y1)*(y2-y1)) / l2))

                                    
        proj_x = x1 + t * (x2 - x1)
        proj_y = y1 + t * (y2 - y1)

                                       
        return measure_distance((x0, y0), (proj_x, proj_y))

    def get_possession_statistics(self):
        """Generate comprehensive possession statistics"""
        if not self.possession_changes:
            return {}

        total_changes = len(self.possession_changes)
        team_changes = {1: 0, 2: 0}
        same_team_changes = 0
        interteam_changes = 0
        
                                    
        for change in self.possession_changes:
            if change["change_type"] == "same_team_pass":
                same_team_changes += 1
                team_changes[change["to_team"]] += 1
            else:
                interteam_changes += 1

        return {
            "total_possession_changes": total_changes,
            "same_team_changes": same_team_changes,
            "interteam_changes": interteam_changes,
            "team_possession_gains": team_changes,
            "possession_change_rate": total_changes / max(len(self.pass_history) + len(self.interception_history), 1)
        }

    def get_enhanced_statistics(self):
        """Generate enhanced statistics including color-based interception data"""
        base_stats = self.get_pass_statistics()
        
                                       
        team_interceptions = 0
        color_interceptions = 0
        
        for interception in self.interception_history:
            if interception.get("interception_reason") == "team_change":
                team_interceptions += 1
            elif interception.get("interception_reason") == "color_change":
                color_interceptions += 1
        
                                   
        color_similarities = [change["color_similarity"] for change in self.possession_changes 
                            if "color_similarity" in change]
        avg_color_similarity = np.mean(color_similarities) if color_similarities else 0.0
        
                                   
        possession_stats = self.get_possession_statistics()
        
        enhanced_stats = {
            **base_stats,
            "total_interceptions": len(self.interception_history),
            "team_based_interceptions": team_interceptions,
            "color_based_interceptions": color_interceptions,
            "average_color_similarity": avg_color_similarity,
            "pass_accuracy": len(self.pass_history) / (len(self.pass_history) + len(self.interception_history)) if (len(self.pass_history) + len(self.interception_history)) > 0 else 0,
            **possession_stats
        }
        
        return enhanced_stats

    def get_pass_statistics(self):
        """Generate statistics about passes including possession data"""
        if not self.pass_history:
            return {}

        total_passes = len(self.pass_history)
        total_interceptions = len(self.interception_history)
        team_passes = {}
        player_passes = {}

        for pass_info in self.pass_history:
            team = pass_info["team"]
            from_player = pass_info["from_player"]

                        
            if team not in team_passes:
                team_passes[team] = 0
            team_passes[team] += 1

                          
            if from_player not in player_passes:
                player_passes[from_player] = 0
            player_passes[from_player] += 1

                                   
        possession_stats = self.get_possession_statistics()

        return {
            "total_passes": total_passes,
            "total_interceptions": total_interceptions,
            "team_passes": team_passes,
            "player_passes": player_passes,
            "pass_accuracy": total_passes / (total_passes + total_interceptions) if (total_passes + total_interceptions) > 0 else 0,
            **possession_stats
        }

    def draw_passes(self, frames, tracks):
        """Draw pass lines on the video frames with player-specific jersey colors"""
        output_frames = frames.copy()

        for pass_info in self.pass_history:
            start_frame = pass_info["start_frame"]
            end_frame = pass_info["end_frame"]
            from_player = pass_info["from_player"]
            to_player = pass_info["to_player"]
                                                           
            player_color = self._ensure_valid_color(pass_info["player_color"])
            receiver_color = self._ensure_valid_color(pass_info.get("receiver_color", player_color))

                                                                   
            display_duration = min(15, end_frame - start_frame + 5)

            for offset in range(display_duration):
                frame_idx = start_frame + offset
                if frame_idx >= len(output_frames):
                    continue

                if (frame_idx < len(tracks["players"]) and
                    from_player in tracks["players"][start_frame] and
                    end_frame < len(tracks["players"]) and
                        to_player in tracks["players"][end_frame]):

                    start_pos = tracks["players"][start_frame][from_player]["position"]
                    end_pos = tracks["players"][end_frame][to_player]["position"]

                    if start_pos and end_pos:
                                                                   
                        start_x, start_y = int(start_pos[0]), int(start_pos[1])
                        end_x, end_y = int(end_pos[0]), int(end_pos[1])

                                                                                      
                        progress = min(offset / max(display_duration - 3, 1), 1.0)
                        current_x = int(start_x + (end_x - start_x) * progress)
                        current_y = int(start_y + (end_y - start_y) * progress)

                                                                              
                        blend_color = self._blend_colors(
                            player_color, receiver_color, progress)

                                                                              
                        opacity = max(0.3, 1.0 - (offset / display_duration))
                        arrow_color = tuple(int(c * opacity) for c in blend_color)

                                                            
                        self._draw_enhanced_arrow(output_frames[frame_idx],
                                        (start_x, start_y),
                                        (current_x, current_y),
                                        arrow_color, 2)

                                                                                       
                        cv2.circle(output_frames[frame_idx],
                                   (current_x, current_y),
                                   3, (255, 255, 255), -1)
                        cv2.circle(output_frames[frame_idx],
                                   (current_x, current_y),
                                   3, arrow_color, 1)

                                                                
        for pass_info in self.interception_history:
            start_frame = pass_info["start_frame"]
            end_frame = pass_info["end_frame"]
            from_player = pass_info["from_player"]
            to_player = pass_info["to_player"]
            player_color = self._ensure_valid_color(pass_info["player_color"])
            receiver_color = self._ensure_valid_color(pass_info.get("receiver_color", pass_info.get("team_color", (255, 0, 0))))

                                    
            display_duration = min(15, end_frame - start_frame + 5)

            for offset in range(display_duration):
                frame_idx = start_frame + offset
                if frame_idx >= len(output_frames) or frame_idx >= len(tracks["players"]):
                    continue

                if (from_player in tracks["players"][start_frame] and
                    end_frame < len(tracks["players"]) and
                        to_player in tracks["players"][end_frame]):

                    start_pos = tracks["players"][start_frame][from_player]["position"]
                    end_pos = tracks["players"][end_frame][to_player]["position"]

                    if start_pos and end_pos:
                        start_x, start_y = int(start_pos[0]), int(start_pos[1])
                        end_x, end_y = int(end_pos[0]), int(end_pos[1])

                        progress = min(offset / max(display_duration - 3, 1), 1.0)
                        current_x = int(start_x + (end_x - start_x) * progress)
                        current_y = int(start_y + (end_y - start_y) * progress)

                                                                              
                        blend_color = self._blend_colors(
                            player_color, receiver_color, progress)

                                                            
                        opacity = max(0.3, 1.0 - (offset / display_duration))
                        arrow_color = tuple(int(c * opacity) for c in blend_color)

                        if offset % 3 == 0:                        
                            self._draw_enhanced_arrow(output_frames[frame_idx],
                                            (start_x, start_y),
                                            (current_x, current_y),
                                            arrow_color, 3)

                                                       
                        cv2.circle(output_frames[frame_idx],
                                   (current_x, current_y),
                                   4, (255, 255, 255), -1)
                        cv2.circle(output_frames[frame_idx],
                                   (current_x, current_y),
                                   4, arrow_color, 2)

        return output_frames

    def _ensure_valid_color(self, color):
        """Ensure color is in valid format for OpenCV"""
        if isinstance(color, (list, tuple)) and len(color) >= 3:
            return tuple(max(0, min(255, int(c))) for c in color[:3])
        elif isinstance(color, np.ndarray) and len(color) >= 3:
            return tuple(max(0, min(255, int(c))) for c in color[:3])
        else:
            return (0, 0, 255)               

    def _draw_enhanced_arrow(self, frame, start_point, end_point, color, thickness):
        """Draw enhanced arrow with better visibility"""
                        
        cv2.line(frame, start_point, end_point, color, thickness)
        
                              
        angle = np.arctan2(end_point[1] - start_point[1], end_point[0] - start_point[0])
        arrowhead_length = thickness * 3
        
                           
        arrow_point1 = (
            int(end_point[0] - arrowhead_length * np.cos(angle - np.pi/6)),
            int(end_point[1] - arrowhead_length * np.sin(angle - np.pi/6))
        )
        arrow_point2 = (
            int(end_point[0] - arrowhead_length * np.cos(angle + np.pi/6)),
            int(end_point[1] - arrowhead_length * np.sin(angle + np.pi/6))
        )
        
                         
        cv2.line(frame, end_point, arrow_point1, color, thickness)
        cv2.line(frame, end_point, arrow_point2, color, thickness)

    def _blend_colors(self, color1, color2, ratio):
        """Blend two colors based on ratio (0.0 to 1.0)"""
        ratio = max(0.0, min(1.0, ratio))
        return tuple(int(c1 * (1 - ratio) + c2 * ratio) for c1, c2 in zip(color1, color2))

    def generate_pass_matrix(self, team_id=None):
        """
        Generate a pass matrix showing passes between players

        Args:
            team_id: Optional team ID to filter passes

        Returns:
            Dictionary with pass matrix data
        """
        if not self.pass_history:
            return {}

                                            
        all_players = set()
        team_passes = []

        for pass_info in self.pass_history:
            if team_id is None or pass_info["team"] == team_id:
                all_players.add(pass_info["from_player"])
                all_players.add(pass_info["to_player"])
                team_passes.append(pass_info)

        player_list = sorted(list(all_players))
        num_players = len(player_list)

                       
        pass_matrix = np.zeros((num_players, num_players), dtype=int)

                              
        player_idx = {player_id: idx for idx,
                      player_id in enumerate(player_list)}

                     
        for pass_info in team_passes:
            from_idx = player_idx[pass_info["from_player"]]
            to_idx = player_idx[pass_info["to_player"]]
            pass_matrix[from_idx, to_idx] += 1

        return {
            "matrix": pass_matrix,
            "players": player_list,
            "player_idx": player_idx
        }

    def generate_pass_network_visualization(self, frame, team_id):
        """
        Create a pass network visualization

        Args:
            frame: Video frame to overlay visualization on
            team_id: Team ID to show pass network for

        Returns:
            Frame with pass network visualization
        """
        if not self.pass_history:
            return frame

                              
        matrix_data = self.generate_pass_matrix(team_id)

        if not matrix_data:
            return frame

        pass_matrix = matrix_data["matrix"]
        players = matrix_data["players"]

                       
        fig = plt.figure(figsize=(5, 5), facecolor='white')
        ax = fig.add_subplot(111)

                                           
        cax = ax.matshow(pass_matrix, cmap='Blues')

                    
        ax.set_xticks(range(len(players)))
        ax.set_yticks(range(len(players)))
        ax.set_xticklabels(players, rotation=90)
        ax.set_yticklabels(players)

                             
        for i in range(len(players)):
            for j in range(len(players)):
                if pass_matrix[i, j] > 0:
                    ax.text(
                        j, i, str(pass_matrix[i, j]), ha='center', va='center')

                      
        plt.colorbar(cax)

                   
        ax.set_title(f"Team {team_id} Pass Matrix")

                       
        plt.tight_layout()

                               
        canvas = FigureCanvasAgg(fig)
        canvas.draw()
        buf = canvas.buffer_rgba()
        matrix_img = np.asarray(buf)
        plt.close(fig)

                                        
        matrix_img = cv2.cvtColor(matrix_img, cv2.COLOR_RGBA2BGR)

                                
        width, height = 400, 400
        matrix_img = cv2.resize(matrix_img, (width, height))

                      
        x_offset, y_offset = 10, frame.shape[0] - height - 10

        cv2.rectangle(frame, (x_offset-5, y_offset-5),
                      (x_offset+width+5, y_offset+height+5), (255, 255, 255), -1)

                               
        frame[y_offset:y_offset+height, x_offset:x_offset+width] = matrix_img

        return frame