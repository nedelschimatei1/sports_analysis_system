import cv2
from ultralytics import YOLO
import numpy as np


class PitchKeypointDetector:
    def __init__(self, model_path):
        self.model = YOLO(model_path)

    def detect_keypoints(self, frame):
        results = self.model.predict(frame, conf=0.5)

        if not results or len(results) == 0 or results[0].keypoints is None:
            print("Warning: No keypoints detected in the frame.")
            return None

        keypoints = results[0].keypoints.xy.cpu().numpy()
        class_names = results[0].names

        detected_points = {}
        keypoint_map = {
            0: 'top_penalty_corner_left',
            1: 'top_penalty_corner_right',
            2: 'bottom_penalty_corner_left',
            3: 'bottom_penalty_corner_right',
        }

        if keypoints.shape[0] > 0:
            for i, (x, y) in enumerate(keypoints[0]):
                if i in keypoint_map:
                    detected_points[keypoint_map[i]] = (int(x), int(y))

        if len(detected_points) < 4:
            print(
                f"Warning: Only found {len(detected_points)} keypoints. Need at least 4.")
            return None

        return detected_points
