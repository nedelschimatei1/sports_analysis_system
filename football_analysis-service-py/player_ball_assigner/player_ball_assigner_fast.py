from utils import get_center_of_bbox, measure_distance, get_foot_position
import sys
import numpy as np
sys.path.append('../')


class PlayerBallAssigner():
    def __init__(self):
        self.max_player_ball_distance = 70

        self.goalkeeper_ids = set()
        self.field_width = 1920 
        self.field_margin = 150  

    def set_goalkeeper_ids(self, goalkeeper_ids):
        """Set known goalkeeper IDs for faster processing"""
        if goalkeeper_ids:
            self.goalkeeper_ids = set(goalkeeper_ids)

    def assign_ball_to_player_batch(self, tracks, start_frame, end_frame, exclude_goalkeepers=True):
        ball_possessions = []

        for frame_num in range(start_frame, end_frame):
            if frame_num >= len(tracks["players"]) or frame_num >= len(tracks["ball"]):
                ball_possessions.append(-1)
                continue

            player_track = tracks["players"][frame_num]
            if 1 not in tracks["ball"][frame_num]:
                ball_possessions.append(-1)
                continue

            ball_bbox = tracks["ball"][frame_num][1]['bbox']

            if ball_bbox[2] <= ball_bbox[0] or ball_bbox[3] <= ball_bbox[1]:
                ball_possessions.append(-1)
                continue

            ball_position = get_center_of_bbox(ball_bbox)
            minimum_distance = self.max_player_ball_distance
            assigned_player = -1

            for player_id, player in player_track.items():
                if exclude_goalkeepers:
                    if player_id in self.goalkeeper_ids:
                        continue

                    player_bbox = player['bbox']
                    center_x = (player_bbox[0] + player_bbox[2]) / 2
                    if center_x < self.field_margin or center_x > (self.field_width - self.field_margin):
                        continue

                foot_x = int((player['bbox'][0] + player['bbox'][2]) / 2)
                foot_y = int(player['bbox'][3])

                dx = foot_x - ball_position[0]
                dy = foot_y - ball_position[1]
                distance_squared = dx*dx + dy*dy


                if distance_squared < minimum_distance * minimum_distance:
                    minimum_distance = distance_squared**0.5  
                    assigned_player = player_id

            ball_possessions.append(assigned_player)

        return ball_possessions

    def assign_ball_to_player(self, players, ball_bbox, frame_num=None, exclude_goalkeepers=True):
        if ball_bbox[2] <= ball_bbox[0] or ball_bbox[3] <= ball_bbox[1]:
            return -1
        ball_position = get_center_of_bbox(ball_bbox)
        minimum_distance = self.max_player_ball_distance
        assigned_player = -1

        for player_id, player in players.items():
            if exclude_goalkeepers:
                if player_id in self.goalkeeper_ids:
                    continue

                player_bbox = player['bbox']
                center_x = (player_bbox[0] + player_bbox[2]) / 2
                if center_x < self.field_margin or center_x > (self.field_width - self.field_margin):
                    continue

            foot_x = int((player['bbox'][0] + player['bbox'][2]) / 2)
            foot_y = int(player['bbox'][3])

            dx = foot_x - ball_position[0]
            dy = foot_y - ball_position[1]
            distance_squared = dx*dx + dy*dy

            if distance_squared < minimum_distance * minimum_distance:
                minimum_distance = distance_squared**0.5
                assigned_player = player_id

        return assigned_player
