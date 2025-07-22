import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.colors import LinearSegmentedColormap
import networkx as nx
import cv2
import io
from collections import defaultdict, Counter


class PassNetworkAnalyzer:
    def __init__(self):
        self.pass_networks = {}
        self.player_positions = {}
        self.pass_data = []
        
    def analyze_pass_networks(self, tracks, passes):
                                                     
        self._calculate_average_positions(tracks)
        
                                          
        self._process_passes_into_networks(passes)
        
        return self.pass_networks
    
    def _calculate_average_positions(self, tracks):
        """Calculate average field positions for each player"""
        player_positions = defaultdict(list)
        player_teams = {}
        
                                               
        for frame_data in tracks["players"]:
            for player_id, player_info in frame_data.items():
                if ("position_transformed" in player_info and 
                    player_info["position_transformed"] is not None and
                    "team" in player_info):
                    
                    pos = player_info["position_transformed"]
                    if pos and len(pos) >= 2:
                        player_positions[player_id].append(pos)
                        player_teams[player_id] = player_info["team"]
        
                                     
        self.player_positions = {}
        for player_id, positions in player_positions.items():
            if positions:
                avg_pos = np.mean(positions, axis=0)
                self.player_positions[player_id] = {
                    'position': avg_pos,
                    'team': player_teams.get(player_id, 1),
                    'pass_count': 0
                }
    
    def _process_passes_into_networks(self, passes):
        """Process pass data into network structure"""
        team_networks = {1: defaultdict(int), 2: defaultdict(int)}
        
        for pass_info in passes:
            from_player = pass_info["from_player"]
            to_player = pass_info["to_player"]
            team = pass_info["team"]
            
            if (from_player in self.player_positions and 
                to_player in self.player_positions):
                
                                              
                team_networks[team][(from_player, to_player)] += 1
                
                                           
                self.player_positions[from_player]['pass_count'] += 1
        
        self.pass_networks = team_networks
    
    def create_pass_network_visualization(self, team_id, pitch_length=105, pitch_width=68):
        fig, ax = plt.subplots(figsize=(12, 8))
        fig.patch.set_facecolor('#1e5631') 
        ax.set_facecolor('#1e5631')
        
        self._draw_pitch(ax, pitch_length, pitch_width)
        
        team_players = {pid: data for pid, data in self.player_positions.items() 
                       if data['team'] == team_id}
        
        if not team_players:
            plt.close(fig)
            return None
        
        team_passes = self.pass_networks.get(team_id, {})
        
        self._draw_pass_connections(ax, team_passes, team_players, pitch_length, pitch_width)
        
        self._draw_player_nodes(ax, team_players, pitch_length, pitch_width)
        
        ax.set_xlim(0, pitch_length)
        ax.set_ylim(0, pitch_width)
        ax.set_title(f'Team {team_id} Pass Network', 
                    color='white', fontsize=16, fontweight='bold', pad=20)
        ax.set_xticks([])
        ax.set_yticks([])
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', facecolor='#1e5631', 
                   bbox_inches='tight', dpi=150)
        buf.seek(0)
        
        img_array = np.frombuffer(buf.getvalue(), dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        plt.close(fig)
        buf.close()
        
        return img
    
    def _draw_pass_connections(self, ax, team_passes, team_players, pitch_length, pitch_width):
        """Draw lines representing passes between players"""
        if not team_passes:
            return
        
        max_passes = max(team_passes.values()) if team_passes else 1
        
        for (from_player, to_player), pass_count in team_passes.items():
            if from_player in team_players and to_player in team_players:
                from_pos = team_players[from_player]['position']
                to_pos = team_players[to_player]['position']
                
                from_x = from_pos[0] if from_pos[0] <= pitch_length else from_pos[0] * pitch_length / 100
                from_y = from_pos[1] if from_pos[1] <= pitch_width else from_pos[1] * pitch_width / 100
                to_x = to_pos[0] if to_pos[0] <= pitch_length else to_pos[0] * pitch_length / 100
                to_y = to_pos[1] if to_pos[1] <= pitch_width else to_pos[1] * pitch_width / 100
                
                line_width = max(1, min(8, (pass_count / max_passes) * 6))

                alpha = min(1.0, 0.3 + (pass_count / max_passes) * 0.7)
                
                ax.plot([from_x, to_x], [from_y, to_y], 
                       color='yellow', linewidth=line_width, alpha=alpha, zorder=1)
                
                if pass_count >= 3:
                    mid_x = (from_x + to_x) / 2
                    mid_y = (from_y + to_y) / 2
                    ax.text(mid_x, mid_y, str(pass_count), 
                           color='white', fontsize=8, fontweight='bold',
                           ha='center', va='center', 
                           bbox=dict(boxstyle='round,pad=0.2', facecolor='black', alpha=0.7),
                           zorder=3)
    
    def _draw_player_nodes(self, ax, team_players, pitch_length, pitch_width):
        """Draw circles representing players at their average positions"""
        if not team_players:
            return
        
        max_passes = max(player['pass_count'] for player in team_players.values()) if team_players else 1
        
        for player_id, player_data in team_players.items():
            pos = player_data['position']
            pass_count = player_data['pass_count']
            
            x = pos[0] if pos[0] <= pitch_length else pos[0] * pitch_length / 100
            y = pos[1] if pos[1] <= pitch_width else pos[1] * pitch_width / 100
            
            node_size = max(200, min(1000, 200 + (pass_count / max_passes) * 800))
            
            circle = plt.Circle((x, y), radius=np.sqrt(node_size)/20, 
                              color='red' if player_data['team'] == 1 else 'blue',
                              alpha=0.8, zorder=2)
            ax.add_patch(circle)
            
            ax.text(x, y, str(player_id), 
                   color='white', fontsize=10, fontweight='bold',
                   ha='center', va='center', zorder=4)
    
    def _draw_pitch(self, ax, length, width):
        pitch = patches.Rectangle((0, 0), length, width, 
                                linewidth=2, edgecolor='white', 
                                facecolor='none', alpha=0.6)
        ax.add_patch(pitch)
        
        ax.plot([length/2, length/2], [0, width], 'white', linewidth=2, alpha=0.6)
        center_circle = patches.Circle((length/2, width/2), 9.15, 
                                     linewidth=2, edgecolor='white', 
                                     facecolor='none', alpha=0.6)
        ax.add_patch(center_circle)
        
        penalty_left = patches.Rectangle((0, (width-40.32)/2), 16.5, 40.32,
                                       linewidth=2, edgecolor='white', 
                                       facecolor='none', alpha=0.6)
        ax.add_patch(penalty_left)
        
        penalty_right = patches.Rectangle((length-16.5, (width-40.32)/2), 16.5, 40.32,
                                        linewidth=2, edgecolor='white', 
                                        facecolor='none', alpha=0.6)
        ax.add_patch(penalty_right)
    
    def generate_pass_statistics(self):
        """Generate detailed pass network statistics"""
        stats = {}
        
        for team_id in [1, 2]:
            team_passes = self.pass_networks.get(team_id, {})
            team_players = {pid: data for pid, data in self.player_positions.items() 
                           if data['team'] == team_id}
            
            if not team_passes or not team_players:
                continue
            
            total_passes = sum(team_passes.values())
            unique_connections = len(team_passes)
            players_involved = len(set([p for pair in team_passes.keys() for p in pair]))
            passer_counts = defaultdict(int)
            receiver_counts = defaultdict(int)
            
            for (from_player, to_player), count in team_passes.items():
                passer_counts[from_player] += count
                receiver_counts[to_player] += count
            

            most_connected = max(team_passes.items(), key=lambda x: x[1]) if team_passes else None
            
            stats[f'team_{team_id}'] = {
                'total_passes': total_passes,
                'unique_connections': unique_connections,
                'players_involved': players_involved,
                'most_active_passer': max(passer_counts.items(), key=lambda x: x[1]) if passer_counts else None,
                'most_active_receiver': max(receiver_counts.items(), key=lambda x: x[1]) if receiver_counts else None,
                'most_connected_pair': most_connected,
                'network_density': unique_connections / (players_involved * (players_involved - 1)) if players_involved > 1 else 0
            }
        
        return stats
    
    def add_pass_networks_to_frame(self, frame, team_1_network=None, team_2_network=None):
        if team_1_network is None and team_2_network is None:
            return frame
        
        corner_width, corner_height = 300, 200
        margin = 20
        
        if team_1_network is not None:
            small_network_1 = cv2.resize(team_1_network, (corner_width, corner_height))
            
            y_start = margin
            x_start = margin
            frame[y_start:y_start + corner_height, 
                  x_start:x_start + corner_width] = small_network_1
            
            cv2.putText(frame, "Team 1 Pass Network", 
                       (x_start, y_start - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        if team_2_network is not None:
            small_network_2 = cv2.resize(team_2_network, (corner_width, corner_height))
            
            y_start = margin
            x_start = frame.shape[1] - corner_width - margin
            frame[y_start:y_start + corner_height, 
                  x_start:x_start + corner_width] = small_network_2
            
            cv2.putText(frame, "Team 2 Pass Network", 
                       (x_start, y_start - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return frame