import os
from celery import Celery
import redis

REDIS_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
REDIS_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

celery_app = Celery(
    'football_analysis',
    broker=REDIS_URL,
    backend=REDIS_BACKEND,
    include=['tasks']  
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,              
    task_soft_time_limit=25 * 60,              
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    result_expires=3600,          
    broker_connection_retry_on_startup=True,
    worker_send_task_events=True,
    task_send_sent_event=True,
)

celery_app.conf.task_routes = {
    'process_video_task': {'queue': 'celery'},
}

celery_app.autodiscover_tasks(['tasks'])

def cache_set(key: str, value: str, expiry: int = 3600):
    """Set a value in Redis cache with an expiry time (default 1 hour)."""
    redis_client.setex(key, expiry, value)

def cache_get(key: str) -> str:
    """Get a value from Redis cache."""
    return redis_client.get(key)

if __name__ == '__main__':
    celery_app.start()