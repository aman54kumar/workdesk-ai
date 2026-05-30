"""Serial Ollama access — implemented via job_queue (single consumer)."""

from app.services.job_queue import enqueue_job, cancel_job, iter_job_frames, Job

__all__ = ["enqueue_job", "cancel_job", "iter_job_frames", "Job"]
