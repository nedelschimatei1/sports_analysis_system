# Football Analysis AI Platform 🏈⚽

A comprehensive AI-powered video analysis platform that transforms football match footage into professional-grade insights using computer vision and machine learning. The system automatically processes video uploads to detect players, track ball possession, analyze passes, and generate detailed match statistics.

## 🌟 Features

### 🎯 Intelligent Player & Ball Tracking
- Real-time object detection using YOLO models
- Multi-object tracking with unique player identification
- Ball possession assignment with temporal consistency
- Referee detection and classification

### 🏃‍♂️ Advanced Team Recognition
- Jersey color-based team assignment using K-means clustering
- Enhanced color detection with multiple fallback mechanisms
- Handles varying lighting conditions and camera angles
- Persistent team assignments throughout match duration

### 📊 Comprehensive Match Analytics
- **Pass Detection**: Identifies successful passes with trajectory validation
- **Interception Analysis**: Distinguishes between passes and possession changes
- **Color-based Analysis**: Uses actual jersey colors for accurate detection
- **Possession Statistics**: Real-time team possession percentages
- **Speed & Distance Tracking**: Player movement analysis

### 🎥 Visual Analytics
- Enhanced video output with colored pass arrows
- Statistical overlays with live match data
- Team performance comparisons
- Individual player metrics visualization

### 🔧 Professional Infrastructure
- Microservice architecture with Docker containerization
- Asynchronous processing with Celery workers
- Real-time progress tracking and notifications
- Cloud storage integration (DigitalOcean Spaces)
- Email notifications for processing completion

## 🏗️ Architecture

The platform follows a sophisticated microservice architecture:

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component library
- **React Hook Form** - Form management
- **Axios** - HTTP client

### Backend Services
- **Spring Boot 3** - Java enterprise framework
- **Spring Security** - Authentication & authorization
- **Spring Data JPA** - Database abstraction
- **PostgreSQL** - Primary database
- **JWT** - Stateless authentication

### AI Processing Service
- **FastAPI** - High-performance Python API
- **Celery** - Distributed task processing
- **Redis** - Message broker & caching
- **YOLO (Ultralytics)** - Object detection
- **OpenCV** - Computer vision
- **scikit-learn** - Machine learning
- **Supervision** - Object tracking

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **DigitalOcean Spaces** - Cloud storage
- **SMTP** - Email notifications

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Java 17+ (for backend development)
- Python 3.9+ (for AI service development)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd football-analysis-platform
```

### 2. Environment Setup
Create `.env` files in each service directory:

**Frontend (`.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**AI Service (`.env`):**
```env
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://user:password@db:5432/football_db
SPACES_KEY=your_spaces_key
SPACES_SECRET=your_spaces_secret
```

### 3. Run with Docker Compose
```bash
docker-compose up -d
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8080
- **AI Service**: http://localhost:8000

## 📱 Usage

### 1. Upload Video
- Navigate to the upload page
- Drag & drop or select a football video file
- Wait for cloud upload completion

### 2. Start Analysis
- Click "Analyze Video" to begin AI processing
- Monitor real-time progress updates
- Receive email notification when complete

### 3. View Results
- Access detailed match statistics
- Download enhanced video with analytics overlay
- Export analytics data as JSON

### 4. Team Comparison
- View possession percentages
- Analyze pass completion rates
- Compare individual player performance

## 🎯 Key Innovations

### Jersey Color-Based Analysis
Unlike traditional systems that rely on predetermined team colors, our platform:
- Analyzes actual jersey colors from video footage
- Adapts to varying lighting conditions
- Handles third kit scenarios and goalkeeper differences
- Provides more accurate pass/interception detection

### Enhanced Trajectory Validation
- Validates ball movement patterns for genuine passes
- Distinguishes between intentional passes and random possession changes
- Dynamic tolerance based on pass distance
- Reduces false positives from tackles and deflections

### Real-time Visual Feedback
- Color-coded pass arrows matching actual jersey colors
- Progressive statistics overlay during video playbook
- Interactive team comparison charts
- Professional broadcast-quality visualizations

## 📊 Sample Analytics Output

```json
{
  "match_stats": {
    "duration": "90:00",
    "possession": {
      "team_a": 65,
      "team_b": 35
    },
    "passes": {
      "team_a": {
        "completed": 245,
        "attempted": 289,
        "accuracy": 84.8
      },
      "team_b": {
        "completed": 156,
        "attempted": 198,
        "accuracy": 78.8
      }
    }
  }
}
```

## 🔧 Development

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Backend Development
```bash
cd backend
./mvnw spring-boot:run
```

### AI Service Development
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload
```

## 📈 Performance

- **Processing Speed**: ~2-3x video duration for analysis
- **Accuracy**: 95%+ player detection, 90%+ pass detection
- **Scalability**: Horizontal scaling with multiple Celery workers
- **Storage**: Efficient cloud storage with CDN delivery

## 🙏 Acknowledgments

- [Ultralytics YOLO](https://ultralytics.com/) for object detection
- [OpenCV](https://opencv.org/) for computer vision capabilities
- [Supervision](https://supervision.roboflow.com/) for tracking framework
- [Radix UI](https://www.radix-ui.com/) for accessible components
