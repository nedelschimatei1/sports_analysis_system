import os
import tempfile
import time
import json
import logging
from celery import Celery
import boto3
from botocore.client import Config
import requests
from typing import Optional, Dict, Any
import cv2
import numpy as np
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from utils.video_utils import read_video, save_video
from trackers import Tracker
from team_assigner import TeamAssigner
from player_ball_assigner import PlayerBallAssigner
from camera_movement_estimator import CameraMovementEstimator
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistance_Estimator
from pass_detector import PassDetector
from match_statistics import MatchStatistics

from celery_config import celery_app, cache_set, cache_get

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_s3_client(spaces_config: Dict[str, Any]):
    """Create and return an S3 client for DigitalOcean Spaces"""
    return boto3.client('s3',
                        endpoint_url=spaces_config['endpoint_url'],
                        region_name=spaces_config['region_name'],
                        aws_access_key_id=spaces_config['access_key_id'],
                        aws_secret_access_key=spaces_config['secret_access_key'],
                        config=Config(signature_version='s3v4'))

def download_video(s3_client, bucket_name: str, object_key: str, local_path: str):
    """Download a video from DigitalOcean Spaces"""
    try:
        logger.info(f"📥 Downloading video {object_key} from bucket {bucket_name}")
        s3_client.download_file(bucket_name, object_key, local_path)
        logger.info(f"✅ Download completed: {local_path}")
    except Exception as e:
        logger.error(f"❌ Failed to download video: {str(e)}")
        raise

def upload_video(s3_client, bucket_name: str, local_path: str, object_key: str):
    """Upload a video to DigitalOcean Spaces"""
    try:
        logger.info(f"📤 Uploading processed video to {object_key}")
        s3_client.upload_file(local_path, bucket_name, object_key,
                              ExtraArgs={'ContentType': 'video/x-msvideo', 'ACL': 'public-read'})
        logger.info(f"✅ Upload completed: {object_key}")
    except Exception as e:
        logger.error(f"❌ Failed to upload processed video: {str(e)}")
        raise

def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification using Gmail SMTP"""
    try:
                                  
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        smtp_user = os.getenv("SMTP_USER") 
        smtp_password = os.getenv("SMTP_PASSWORD") 

        if not smtp_user or not smtp_password:
            logger.error("❌ SMTP credentials not configured")
            return

        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)

        server.send_message(msg)
        server.quit()
        logger.info(f"📧 Email notification sent to {to_email}")

    except Exception as e:
        logger.error(f"❌ Failed to send email notification: {str(e)}")

def process_football_video(input_path: str, output_path: str, task_instance, stub_mode: bool = True):
    """Process the football video using the existing pipeline"""
    try:
        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 5, 'status': 'Reading video frames...'}
        )
        
        video_frames = read_video(input_path)
        logger.info(f"📹 Read {len(video_frames)} frames from video")
        
        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 15, 'status': 'Initializing object tracking...'}
        )

        tracker = Tracker('models/best.pt')
        tracks = tracker.get_object_tracks(video_frames,
                                           read_from_stub=stub_mode,
                                           stub_path='stubs/track_stubs.pkl')
        
        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 25, 'status': 'Calculating object positions...'}
        )

        tracker.add_position_to_tracks(tracks)

        camera_movement_estimator = CameraMovementEstimator(video_frames[0])
        camera_movement_per_frame = camera_movement_estimator.get_camera_movement(
            video_frames,
            read_from_stub=stub_mode,
            stub_path='stubs/camera_movement_stub.pkl')
        camera_movement_estimator.add_adjust_positions_to_tracks(
            tracks, camera_movement_per_frame)

        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 35, 'status': 'Transforming field view...'}
        )

        view_transformer = ViewTransformer()
        view_transformer.add_transformed_position_to_tracks(tracks)

        tracks["ball"] = tracker.interpolate_ball_positions(tracks["ball"])

        speed_and_distance_estimator = SpeedAndDistance_Estimator()
        speed_and_distance_estimator.add_speed_and_distance_to_tracks(tracks)

        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 50, 'status': 'Assigning team colors...'}
        )

        team_assigner = TeamAssigner()
        team_assigner.assign_team_color(video_frames[0], tracks['players'][0])

        for frame_num, player_track in enumerate(tracks['players']):
            for player_id, track in player_track.items():
                team = team_assigner.get_player_team(video_frames[frame_num],
                                                     track['bbox'],
                                                     player_id)
                tracks['players'][frame_num][player_id]['team'] = team
                tracks['players'][frame_num][player_id]['team_color'] = team_assigner.team_colors[team]

        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 60, 'status': 'Analyzing ball possession...'}
        )

        player_assigner = PlayerBallAssigner()
        team_ball_control = []
        for frame_num, player_track in enumerate(tracks['players']):
            ball_bbox = tracks['ball'][frame_num][1]['bbox']
            assigned_player = player_assigner.assign_ball_to_player(player_track, ball_bbox)

            if assigned_player != -1:
                tracks['players'][frame_num][assigned_player]['has_ball'] = True
                team_ball_control.append(tracks['players'][frame_num][assigned_player]['team'])
            else:
                if team_ball_control:
                    team_ball_control.append(team_ball_control[-1])
                else:
                    team_ball_control.append(0)

        team_ball_control = np.array(team_ball_control)

        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 75, 'status': 'Generating visualizations...'}
        )

        output_video_frames = tracker.draw_annotations(video_frames, tracks, team_ball_control)

        output_video_frames = camera_movement_estimator.draw_camera_movement(
            output_video_frames, camera_movement_per_frame)

        speed_and_distance_estimator.draw_speed_and_distance(output_video_frames, tracks)

        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 85, 'status': 'Analyzing passes and statistics...'}
        )

        pass_detector = PassDetector()
        match_statistics = MatchStatistics()

        team1_color = team_assigner.team_colors[1]
        team2_color = team_assigner.team_colors[2]
        match_statistics.set_team_colors(team1_color, team2_color)

        passes = pass_detector.detect_passes(tracks, {player_id: track["team"]
                                                      for frame in tracks["players"]
                                                      for player_id, track in frame.items()
                                                      if "team" in track})
        
        output_video_frames = pass_detector.draw_passes(output_video_frames, tracks)
        pass_stats = pass_detector.get_enhanced_statistics()
        team_passes = pass_stats.get("team_passes", {})
        team1_passes = team_passes.get(1, 0)
        team2_passes = team_passes.get(2, 0)

        combined_stats = {
            "Possession": f"Team 1: {team_ball_control[team_ball_control == 1].shape[0]/len(team_ball_control)*100:.1f}% | Team 2: {team_ball_control[team_ball_control == 2].shape[0]/len(team_ball_control)*100:.1f}%",
            "Passes": len(passes),
            "Team_1_Passes": team1_passes,
            "Team_2_Passes": team2_passes,
            "Pass_Accuracy": f"{pass_stats.get('pass_accuracy', 0)*100:.1f}%",
            "team_passes": pass_detector.get_pass_statistics().get("team_passes", {}),
        }

        final_frame = match_statistics.generate_statistics_overlay(
            output_video_frames[-1].copy(), combined_stats)
        output_video_frames.append(final_frame)

        task_instance.update_state(
            state='PROGRESS',
            meta={'progress': 95, 'status': 'Saving processed video...'}
        )

        save_video(output_video_frames, output_path)
        logger.info(f"✅ Video processing completed: {output_path}")

        total_frames = len(video_frames)
        duration_seconds = total_frames / 24  
        
        analytics = {
            'total_frames': total_frames,
            'duration_seconds': duration_seconds,
            'players_detected': len(set(player_id for frame in tracks['players'] for player_id in frame.keys())),
            'ball_detected': len(tracks['ball']) > 0,
            'team_stats': {
                'team_1_possession': float(team_ball_control[team_ball_control == 1].shape[0]/len(team_ball_control)*100),
                'team_2_possession': float(team_ball_control[team_ball_control == 2].shape[0]/len(team_ball_control)*100),
                'total_passes': len(passes),
                "team_1_passes": team1_passes,
                "team_2_passes": team2_passes,
                "pass_accuracy": f"{pass_stats.get('pass_accuracy', 0)*100:.1f}%"
            },
            'match_summary': {
                'total_distance_covered': sum([track.get('distance_covered', 0) for frame in tracks['players'] for track in frame.values()]),
                'average_speed': sum([track.get('speed', 0) for frame in tracks['players'] for track in frame.values()]) / max(1, len([track for frame in tracks['players'] for track in frame.values()])),
                'max_speed': max([track.get('speed', 0) for frame in tracks['players'] for track in frame.values()] + [0]),
                'ball_possession_changes': len([i for i in range(1, len(team_ball_control)) if team_ball_control[i] != team_ball_control[i-1]]),
                'total_sprints': len([track for frame in tracks['players'] for track in frame.values() if track.get('speed', 0) > 20])
            }
        }

        return analytics

    except Exception as e:
        logger.error(f"❌ Error processing video: {str(e)}")
        raise

@celery_app.task(bind=True)
def process_video_task(self, video_key: str, stub_mode: bool = True, preserve_audio: bool = False, 
                       callback_url: Optional[str] = None, spaces_config: Optional[Dict[str, Any]] = None,
                       video_id: str = None, user_id: str = None, user_email: Optional[str] = None):
    """
    Celery task to process a football video
    """
    job_id = self.request.id
    logger.info(f"🎬 TASK STARTED: {job_id}")
    logger.info(f"📹 Video: {video_key}, User: {user_id}, Video ID: {video_id}")
    logger.info(f"⚙️ Stub mode: {stub_mode}, Preserve audio: {preserve_audio}")
    logger.info(f"🔔 Callback URL: {callback_url}, User Email: {user_email}")

    if not spaces_config or not all([spaces_config.get('access_key_id'), 
                                   spaces_config.get('secret_access_key'), 
                                   spaces_config.get('bucket_name')]):
        logger.info("🔧 Using environment variables for Spaces config")
        spaces_config = {
            "endpoint_url": os.getenv("SPACES_ENDPOINT_URL", "https://fra1.digitaloceanspaces.com"),
            "region_name": os.getenv("SPACES_REGION", "FRA1"),
            "access_key_id": os.getenv("SPACES_ACCESS_KEY"),
            "secret_access_key": os.getenv("SPACES_SECRET_KEY"),
            "bucket_name": os.getenv("SPACES_BUCKET")
        }

        missing_vars = []
        for key, value in spaces_config.items():
            if not value:
                missing_vars.append(key.upper())
        
        if missing_vars:
            error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
            logger.error(f"❌ {error_msg}")
            raise ValueError(error_msg)
    
    logger.info(f"🔧 Using Spaces config: endpoint={spaces_config['endpoint_url']}, region={spaces_config['region_name']}, bucket={spaces_config['bucket_name']}")

    s3_client = get_s3_client(spaces_config)

    input_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    input_file.close()

    processed_file = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    processed_file.close()

    try:
        logger.info("🚀 Starting video processing...")

        self.update_state(
            state='PROGRESS',
            meta={'progress': 0, 'status': 'Starting video analysis...'}
        )
        
        if callback_url:
            try:
                logger.info(f"📞 Sending callback to: {callback_url}")
                callback_data = {
                    "video_id": video_id,
                    "job_id": job_id,
                    "status": "processing",
                    "progress": 0,
                    "message": "Starting video analysis..."
                }
                response = requests.post(callback_url, json=callback_data, timeout=10)
                logger.info("✅ Callback sent successfully")
            except Exception as e:
                logger.error(f"❌ Failed to send callback: {str(e)}")

        cache_key = f"video_analytics:{video_key}"
        cached_analytics = cache_get(cache_key)
        if cached_analytics:
            logger.info(f"✅ Found cached analytics for video {video_key}")
            analytics = json.loads(cached_analytics)
            output_key = f"processed/{user_id}/{video_id}_processed_{int(time.time())}.avi"
            upload_video(s3_client, spaces_config['bucket_name'], processed_file.name, output_key)
            
            if user_email:
                email_subject = f"Football Video Analysis Completed - Video ID: {video_id}"
                email_body = f"""
                Your football video analysis (Video ID: {video_id}) has been completed successfully!
                
                Job ID: {job_id}
                Processed Video: {output_key}
                Analytics Summary:
                - Team 1 Possession: {analytics['team_stats']['team_1_possession']:.1f}%
                - Team 2 Possession: {analytics['team_stats']['team_2_possession']:.1f}%
                - Total Passes: {analytics['team_stats']['total_passes']}
                - Pass Accuracy: {analytics['team_stats']['pass_accuracy']}
                
                Thank you for using Football Analysis AI Service!
                """
                send_email_notification(user_email, email_subject, email_body)
            
            return {
                'status': 'completed',
                'progress': 100,
                'video_id': video_id,
                'video_key': video_key,
                'user_id': user_id,
                'output_key': output_key,
                'started_at': time.time(),
                'completed_at': time.time(),
                'analytics': analytics
            }

        self.update_state(
            state='PROGRESS',
            meta={'progress': 5, 'status': 'Downloading video from cloud storage...'}
        )
        
        download_video(s3_client, spaces_config['bucket_name'], video_key, input_file.name)

        logger.info("🔄 Processing video with STUB MODE enabled...")
        analytics = process_football_video(input_file.name, processed_file.name, self, stub_mode=True)

        cache_set(cache_key, json.dumps(analytics), 24 * 3600)

        filename, _ = os.path.splitext(video_key)
        output_key = f"processed/{user_id}/{video_id}_processed_{int(time.time())}.avi"

        self.update_state(
            state='PROGRESS',
            meta={'progress': 98, 'status': 'Uploading results to cloud storage...'}
        )
        
        upload_video(s3_client, spaces_config['bucket_name'], processed_file.name, output_key)

        logger.info("✅ Processing completed, sending final callback...")

        if callback_url:
            try:
                logger.info(f"📞 Sending callback to: {callback_url}")
                completion_data = {
                    "video_id": video_id,
                    "job_id": job_id,
                    "status": "completed",
                    "progress": 100,
                    "message": "Video processing completed successfully!",
                    "output_key": output_key,
                    "analytics": analytics
                }
                response = requests.post(callback_url, json=completion_data, timeout=10)
                logger.info("✅ Callback sent successfully")
            except Exception as e:
                logger.error(f"❌ Failed to send completion callback: {str(e)}")

        if user_email:
            email_subject = f"Football Video Analysis Completed - Video ID: {video_id}"
            email_body = f"""
            Your football video analysis (Video ID: {video_id}) has been completed successfully!
            
            Job ID: {job_id}
            Processed Video: {output_key}
            Analytics Summary:
            - Team 1 Possession: {analytics['team_stats']['team_1_possession']:.1f}%
            - Team 2 Possession: {analytics['team_stats']['team_2_possession']:.1f}%
            - Total Passes: {analytics['team_stats']['total_passes']}
            - Pass Accuracy: {analytics['team_stats']['pass_accuracy']}
            
            Thank you for using Football Analysis AI Service!
            """
            send_email_notification(user_email, email_subject, email_body)

        logger.info(f"✅ Video processing completed successfully for video {video_id}")
        
        return {
            'status': 'completed',
            'progress': 100,
            'video_id': video_id,
            'video_key': video_key,
            'user_id': user_id,
            'output_key': output_key,
            'started_at': time.time(),
            'completed_at': time.time(),
            'analytics': analytics
        }

    except Exception as e:
        error_message = str(e)
        logger.error(f"❌ Error in process_video_task: {error_message}")
        
        if callback_url:
            try:
                error_data = {
                    "video_id": video_id,
                    "job_id": job_id,
                    "status": "failed",
                    "progress": 0,
                    "error": error_message
                }
                requests.post(callback_url, json=error_data, timeout=10)
            except Exception as callback_error:
                logger.error(f"❌ Failed to send error callback: {str(callback_error)}")

        if user_email:
            email_subject = f"Football Video Analysis Failed - Video ID: {video_id}"
            email_body = f"""
            We're sorry, but the processing of your football video (Video ID: {video_id}) has failed.
            
            Job ID: {job_id}
            Error: {error_message}
            
            Please try again or contact support for assistance.
            """
            send_email_notification(user_email, email_subject, email_body)

        self.update_state(
            state='FAILURE',
            meta={'progress': 0, 'status': 'Failed', 'error': error_message}
        )
        
        raise

    finally:
        for file_path in [input_file.name, processed_file.name]:
            if os.path.exists(file_path):
                try:
                    os.unlink(file_path)
                    logger.info(f"🗑️ Cleaned up: {file_path}")
                except Exception as e:
                    logger.error(f"❌ Failed to delete temporary file {file_path}: {str(e)}")