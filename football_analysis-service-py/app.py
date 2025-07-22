import os
import time
import logging
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
from contextlib import asynccontextmanager
from celery_config import celery_app, cache_set, cache_get

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

class VideoProcessingRequest(BaseModel):
    video_id: str
    video_key: str
    user_id: str
    user_email: Optional[str] = None  
    callback_url: Optional[str] = None
    stub_mode: bool = False
    preserve_audio: bool = False
    spaces_config: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: float
    celery_status: str
    redis_status: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Football Analysis AI Service starting up...")

    health_data = {
        "status": "healthy",
        "timestamp": time.time(),
        "celery_status": "unknown",
        "redis_status": "unknown"
    }
    try:
        celery_inspect = celery_app.control.inspect()
        active_workers = celery_inspect.active()
        if active_workers:
            health_data["celery_status"] = "connected"
            health_data["redis_status"] = "connected"
            logger.info(f"✅ Connected to {len(active_workers)} Celery workers")
        else:
            health_data["celery_status"] = "no_workers"
            health_data["redis_status"] = "connected"
            logger.warning("⚠️ No active Celery workers found")
        cache_set("health_check", json.dumps(health_data), 60)                      
    except Exception as e:
        health_data["celery_status"] = "disconnected"
        health_data["redis_status"] = "disconnected"
        logger.warning(f"⚠️ Could not connect to Celery/Redis: {str(e)}")
    
    yield
    
    logger.info("🛑 Football Analysis AI Service shutting down...")

app = FastAPI(
    title="Football Analysis AI Service",
    description="AI-powered football video analysis microservice",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    client_ip = request.client.host
    if "x-forwarded-for" in request.headers:
        client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    logger.info(f"📥 {request.method} {request.url.path} from {client_ip}")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"📤 {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)")
    
    return response

@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "service": "Football Analysis AI Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "process_video": "/internal/process-video",
            "job_status": "/internal/job/{job_id}/status"
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    cached_health = cache_get("health_check")
    if cached_health:
        return HealthResponse(**json.loads(cached_health))
    
                                          
    try:
        celery_inspect = celery_app.control.inspect()
        active_workers = celery_inspect.active()
        
        health_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "celery_status": "connected" if active_workers else "no_workers",
            "redis_status": "connected"
        }
    except Exception as e:
        logger.warning(f"Health check failed: {str(e)}")
        health_data = {
            "status": "unhealthy",
            "timestamp": time.time(),
            "celery_status": "disconnected",
            "redis_status": "disconnected"
        }
    
    cache_set("health_check", json.dumps(health_data), 60)                      
    return HealthResponse(**health_data)

@app.post("/internal/process-video")
async def process_video(request: VideoProcessingRequest):
    """Start video processing task"""
    
    try:
        logger.info(f"Received processing request - Video ID: {request.video_id}, User: {request.user_id}")
        
        from tasks import process_video_task
        
        task = process_video_task.delay(
            video_key=request.video_key,
            stub_mode=request.stub_mode,
            preserve_audio=request.preserve_audio,
            callback_url=request.callback_url,
            spaces_config=request.spaces_config,
            video_id=request.video_id,
            user_id=request.user_id,
            user_email=request.user_email 
        )
        
        logger.info(f"✅ Video processing task queued with ID: {task.id}")
        
        return {
            "status": "queued",
            "job_id": task.id,
            "video_id": request.video_id,
            "message": "Video processing task has been queued successfully"
        }
        
    except Exception as e:
        logger.error(f"Error queueing video processing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue video processing: {str(e)}"
        )

@app.get("/internal/job/{job_id}/status")
async def get_job_status(job_id: str):
    """Get status of a processing job"""
    
    try:
        logger.info(f"📊 Getting status for job: {job_id}")
        
        cache_key = f"job_status:{job_id}"
        cached_status = cache_get(cache_key)
        if cached_status:
            return json.loads(cached_status)
        
        task_result = celery_app.AsyncResult(job_id)
        
        response = {
            "job_id": job_id,
            "status": task_result.status.lower(),
            "result": None,
            "error": None
        }
        
        if task_result.status == 'PENDING':
            response["message"] = "Task is waiting to be processed"
        elif task_result.status == 'PROGRESS':
            response["message"] = "Task is being processed"
            if task_result.info:
                response["progress"] = task_result.info.get('progress', 0)
                response["current_status"] = task_result.info.get('status', 'Processing...')
        elif task_result.status == 'SUCCESS':
            response["message"] = "Task completed successfully"
            response["result"] = task_result.result
        elif task_result.status == 'FAILURE':
            response["message"] = "Task failed"
            response["error"] = str(task_result.info)
        
        cache_set(cache_key, json.dumps(response), 300)
        
        logger.info(f"📊 Job {job_id} status: {task_result.status}")
        return response
        
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get job status: {str(e)}"
        )

@app.post("/internal/cancel-job/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a processing job"""
    
    try:
        logger.info(f"🚫 Cancelling job: {job_id}")
        
        celery_app.control.revoke(job_id, terminate=True)
        
        cache_set(f"job_status:{job_id}", json.dumps({"status": "cancelled", "job_id": job_id, "message": "Job has been cancelled"}), 300)
        
        return {
            "status": "cancelled",
            "job_id": job_id,
            "message": "Job has been cancelled"
        }
        
    except Exception as e:
        logger.error(f"Error cancelling job: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel job: {str(e)}"
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"❌ Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "path": str(request.url.path)
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False
    )