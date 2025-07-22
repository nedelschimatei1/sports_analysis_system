from sklearn.cluster import KMeans


class TeamAssigner:
    def __init__(self):
        self.team_colors = {}
        self.player_team_dict = {}
        self.player_color_dict = {}  
        self.kmeans = None

    def get_clustering_model(self, image):
        image_2d = image.reshape(-1, 3)

        kmeans = KMeans(n_clusters=2, random_state=0, n_init=10)
        kmeans.fit(image_2d)

        return kmeans

    def get_player_color(self, frame, bbox):
        image = frame[int(bbox[1]):int(bbox[3]), int(bbox[0]):int(bbox[2])]

        if image.size == 0:  
            return [0, 0, 0] 

        top_half_image = image[0:int(image.shape[0]/2), :]

        kmeans = self.get_clustering_model(top_half_image)

        labels = kmeans.labels_

        clustered_image = labels.reshape(
            top_half_image.shape[0], top_half_image.shape[1])

        corner_clusters = [clustered_image[0, 0], clustered_image[0, -1],
                           clustered_image[-1, 0], clustered_image[-1, -1]]
        non_player_cluster = max(set(corner_clusters),
                                 key=corner_clusters.count)
        player_cluster = 1 - non_player_cluster

        player_color = kmeans.cluster_centers_[player_cluster]

        return tuple(int(c) for c in player_color)

    def assign_team_color(self, frame, player_dict):
        player_colors = []
        for _, player_bbox in player_dict.items():
            bbox = player_bbox["bbox"]
            player_color = self.get_player_color(frame, bbox)
            player_colors.append(player_color)

        if not player_colors: 
            return

        kmeans = KMeans(n_clusters=2, random_state=0, n_init=10)
        kmeans.fit(player_colors)

        self.kmeans = kmeans

        self.team_colors[1] = kmeans.cluster_centers_[0]
        self.team_colors[2] = kmeans.cluster_centers_[1]

    def get_player_team(self, frame, player_bbox, player_id):
        if player_id in self.player_team_dict:
            return self.player_team_dict[player_id]

        player_color = self.get_player_color(frame, player_bbox)
        team_id = self.kmeans.predict([player_color])[0] + 1

        if player_id == 96:
            team_id = 1

        self.player_team_dict[player_id] = team_id
        self.player_color_dict[player_id] = player_color

        return team_id

    def get_player_team_and_color(self, frame, player_bbox, player_id):
        if player_id in self.player_team_dict and player_id in self.player_color_dict:
            return self.player_team_dict[player_id], self.player_color_dict[player_id]

        player_color = self.get_player_color(frame, player_bbox)
        team_id = self.kmeans.predict([player_color])[0] + 1

        if player_id == 96:
            team_id = 1

        self.player_team_dict[player_id] = team_id
        self.player_color_dict[player_id] = player_color

        return team_id, player_color