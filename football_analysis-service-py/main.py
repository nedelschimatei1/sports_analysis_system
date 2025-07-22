from utils import read_video, save_video
from trackers import Tracker
import cv2
import numpy as np
from team_assigner import TeamAssigner
from player_ball_assigner import PlayerBallAssigner
from camera_movement_estimator import CameraMovementEstimator
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistance_Estimator
from pass_detector import PassDetector
from match_statistics import MatchStatistics


def main():
                
    video_frames = read_video('input_videos/sample.mp4')

                        
    tracker = Tracker('models/best.pt')

    tracks = tracker.get_object_tracks(video_frames,
                                       read_from_stub=True,
                                       stub_path='stubs/track_stubs.pkl')
                          
    tracker.add_position_to_tracks(tracks)

                               
    camera_movement_estimator = CameraMovementEstimator(video_frames[0])
    camera_movement_per_frame = camera_movement_estimator.get_camera_movement(video_frames,
                                                                              read_from_stub=True,
                                                                              stub_path='stubs/camera_movement_stub.pkl')
    camera_movement_estimator.add_adjust_positions_to_tracks(
        tracks, camera_movement_per_frame)

                      
    view_transformer = ViewTransformer()
    view_transformer.add_transformed_position_to_tracks(tracks)

                                
    tracks["ball"] = tracker.interpolate_ball_positions(tracks["ball"])

                                  
    speed_and_distance_estimator = SpeedAndDistance_Estimator()
    speed_and_distance_estimator.add_speed_and_distance_to_tracks(tracks)

                                                
    team_assigner = TeamAssigner()
    team_assigner.assign_team_color(video_frames[0], tracks['players'][0])

                                                                       
    print("Assigning teams to players...")
    for player_id, track in tracks['players'][0].items():
        team = team_assigner.get_player_team(
            video_frames[0], track['bbox'], player_id)
        print(f"Player {player_id} assigned to team {team}")

                                                                    
    for frame_num, player_track in enumerate(tracks['players']):
        for player_id, track in player_track.items():
                                                              
            if player_id in team_assigner.player_team_dict:
                team = team_assigner.player_team_dict[player_id]
                                                             
                jersey_color = team_assigner.player_color_dict.get(player_id, team_assigner.team_colors[team])
            else:
                                                                             
                print(
                    f"WARNING: Player {player_id} not found in initial assignment, assigning now...")
                                                                                 
                team, jersey_color = team_assigner.get_player_team_and_color(
                    video_frames[frame_num], track['bbox'], player_id)
                print(
                    f"New player {player_id} detected in frame {frame_num}, assigned to team {team}")

                                                        
            tracks['players'][frame_num][player_id]['team'] = team
            tracks['players'][frame_num][player_id]['team_color'] = team_assigner.team_colors[team]
                                                                     
            tracks['players'][frame_num][player_id]['jersey_color'] = jersey_color

                            
    player_assigner = PlayerBallAssigner()
    team_ball_control = []
    for frame_num, player_track in enumerate(tracks['players']):
        ball_bbox = tracks['ball'][frame_num][1]['bbox']
        assigned_player = player_assigner.assign_ball_to_player(
            player_track, ball_bbox)

        if assigned_player != -1:
            tracks['players'][frame_num][assigned_player]['has_ball'] = True
            team_ball_control.append(
                tracks['players'][frame_num][assigned_player]['team'])
        else:
            team_ball_control.append(team_ball_control[-1])
    team_ball_control = np.array(team_ball_control)

                 
                        
    output_video_frames = tracker.draw_annotations(
        video_frames, tracks, team_ball_control)

                          
    output_video_frames = camera_movement_estimator.draw_camera_movement(
        output_video_frames, camera_movement_per_frame)

                             
    speed_and_distance_estimator.draw_speed_and_distance(
        output_video_frames, tracks)

    pass_detector = PassDetector()
    match_statistics = MatchStatistics()

                                                  
    match_statistics.set_team_colors(
        team_assigner.team_colors[1], team_assigner.team_colors[2])

                   
    passes = pass_detector.detect_passes(tracks, {player_id: track["team"]
                                                  for frame in tracks["players"]
                                                  for player_id, track in frame.items()
                                                  if "team" in track})

    output_video_frames = pass_detector.draw_passes(
        output_video_frames, tracks)


    pass_stats = pass_detector.get_enhanced_statistics()
    
                                                
    team_passes = pass_stats.get("team_passes", {})
    team1_passes = team_passes.get(1, 0)
    team2_passes = team_passes.get(2, 0)

                                                    
    combined_stats = {
        "Possession": f"Team 1: {team_ball_control[team_ball_control == 1].shape[0]/len(team_ball_control)*100:.1f}% | Team 2: {team_ball_control[team_ball_control == 2].shape[0]/len(team_ball_control)*100:.1f}%",
        "Passes": len(passes),
        "Team 1 Passes": team1_passes,
        "Team 2 Passes": team2_passes,
        "Pass Accuracy": f"{pass_stats.get('pass_accuracy', 0)*100:.1f}%",
        "team_passes": team_passes                                  
    }

                                                                
    final_frame = match_statistics.generate_statistics_overlay(
        output_video_frames[-1].copy(), combined_stats)
    output_video_frames.append(final_frame)

                                                                
    final_frame = match_statistics.generate_statistics_overlay(
        output_video_frames[-1].copy(), combined_stats)
    output_video_frames.append(final_frame)

                
    save_video(output_video_frames,
               'output_videos/output_video_with_stats.avi')


if __name__ == '__main__':
    main()
