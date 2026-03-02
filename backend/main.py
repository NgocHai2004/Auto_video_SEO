# ================= IMPORT =================
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from groq import Groq
import edge_tts
import os
import json
import uuid
import subprocess
import shutil
import tempfile
import time
import threading
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime, timedelta
from typing import Optional, List
from zoneinfo import ZoneInfo

from pipeline import (
    run_pipeline,
    EDGE_VOICES as PIPELINE_VOICES,
    GROQ_API_KEY,
    GROQ_MODEL,
    OUTPUT_DIR,
    BG_DIR as PIPELINE_BG_DIR,
    generate_audio_prompt,
    generate_tts_audio,
    generate_video_prompt,
    generate_video_from_image,
    merge_video_audio,
    generate_youtube_metadata,
    get_audio_duration,
    VIDEO_FPS,
)
from upload_youtube import get_authenticated_service, upload_video
from batch_demo import find_pairs, IMAGE_EXTENSIONS

# ================= INIT =================
app = FastAPI(title="Groq + TTS + Merge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = Groq(api_key="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")

BASE_DIR = "music"
BG_DIR = os.path.join(BASE_DIR, "backgrounds")

os.makedirs(BASE_DIR, exist_ok=True)
os.makedirs(BG_DIR, exist_ok=True)

EDGE_VOICES = {
    "vi-female": "vi-VN-HoaiMyNeural",
    "vi-male": "vi-VN-NamMinhNeural",
    "en-us-female": "en-US-JennyNeural",
    "en-us-male": "en-US-GuyNeural",
}


# ================= UTILS =================
def generate_filename(ext):
    return f"{uuid.uuid4().hex}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"


@app.get("/")
async def root():
    return {"message": "API Running"}


# ================= GET BACKGROUND LIST =================
@app.get("/backgrounds")
async def get_backgrounds():
    files = [f for f in os.listdir(BG_DIR) if f.endswith(".mp3")]
    return {"backgrounds": files}


# ================= GROQ + EDGE =================
class GroqEdgeRequest(BaseModel):
    prompt: str
    voice: str = "vi-female"


@app.post("/tts/edge-groq")
async def tts_edge_groq(req: GroqEdgeRequest):

    completion = groq_client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": "Bạn là nhân viên bán hàng chuyên nghiệp, quảng cáo ngắn gọn, không xuống dòng."
            },
            {"role": "user", "content": req.prompt}
        ],
        temperature=1,
        max_completion_tokens=200,
    )

    generated_text = completion.choices[0].message.content.strip()

    filename = generate_filename("mp3")
    filepath = os.path.join(BASE_DIR, filename)

    voice = EDGE_VOICES.get(req.voice, req.voice)
    communicate = edge_tts.Communicate(generated_text, voice)
    await communicate.save(filepath)

    return FileResponse(filepath, media_type="audio/mpeg", filename=filename)


# ================= MERGE WITH BACKGROUND =================
@app.post("/merge")
async def merge_audio_video(
    video: UploadFile = File(...),
    audio: UploadFile = File(...),
    background: str = None
):
    video_path = os.path.join(BASE_DIR, generate_filename("mp4"))
    audio_path = os.path.join(BASE_DIR, generate_filename("mp3"))
    mixed_audio_path = os.path.join(BASE_DIR, generate_filename("mp3"))
    output_path = os.path.join(BASE_DIR, generate_filename("mp4"))

    # Save files
    with open(video_path, "wb") as f:
        f.write(await video.read())

    with open(audio_path, "wb") as f:
        f.write(await audio.read())

    final_audio = audio_path

    # 🎵 Nếu có chọn nhạc nền
    if background:
        bg_path = os.path.join(BG_DIR, background)

        mix_command = [
            "ffmpeg",
            "-stream_loop", "-1",
            "-i", bg_path,
            "-i", audio_path,
            "-filter_complex",
            "[0:a]volume=0.6[a0];[a0][1:a]amix=inputs=2:duration=shortest",
            "-c:a", "mp3",
            mixed_audio_path,
            "-y"
        ]

        subprocess.run(mix_command, check=True)
        final_audio = mixed_audio_path

    # 🎬 Merge vào video
    merge_command = [
        "ffmpeg",
        "-i", video_path,
        "-i", final_audio,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        output_path,
        "-y"
    ]

    subprocess.run(merge_command, check=True)

    return FileResponse(output_path, media_type="video/mp4", filename="merged.mp4")


# ================= FULL PIPELINE =================
class PipelineRequest(BaseModel):
    description: str
    duration: int = 5
    voice: str = "vi-female"
    background: Optional[str] = None
    bg_volume: float = 0.3
    width: int = 1280
    height: int = 704
    steps: int = 20
    cfg: float = 5.0
    audio_script: Optional[str] = None
    video_prompt: Optional[str] = None
    upload_youtube: bool = False
    youtube_privacy: Optional[str] = None


@app.post("/pipeline")
async def run_pipeline_endpoint(
    image: UploadFile = File(...),
    description: str = Form(...),
    duration: int = Form(5),
    voice: str = Form("vi-female"),
    background: Optional[str] = Form(None),
    bg_volume: float = Form(0.3),
    width: int = Form(1280),
    height: int = Form(704),
    steps: int = Form(20),
    cfg: float = Form(5.0),
    audio_script: Optional[str] = Form(None),
    video_prompt: Optional[str] = Form(None),
    upload_youtube: bool = Form(False),
    youtube_privacy: Optional[str] = Form(None),
):
    """
    Run the complete pipeline:
      1. Generate audio prompt (Groq LLM)
      2. Generate TTS audio (Edge TTS)
      3. Generate video prompt (Groq LLM)
      4. Generate video from image (ComfyUI Wan2.2)
      5. Merge video + audio (ffmpeg)
      6. Upload to YouTube (optional)

    Returns the final merged video file or JSON result with YouTube URL.
    """
    # Save uploaded image to temp file
    tmp_dir = tempfile.mkdtemp()
    image_path = os.path.join(tmp_dir, image.filename)
    with open(image_path, "wb") as f:
        f.write(await image.read())

    try:
        result = run_pipeline(
            image_path=image_path,
            description=description,
            duration_seconds=duration,
            voice=voice,
            background_music=background,
            bg_volume=bg_volume,
            width=width,
            height=height,
            steps=steps,
            cfg=cfg,
            audio_script=audio_script,
            video_prompt_override=video_prompt,
            upload_to_youtube=upload_youtube,
            youtube_privacy=youtube_privacy,
        )

        final_path = result.get("final_path")
        youtube_url = result.get("youtube_url")

        if upload_youtube:
            # Return JSON with all results including YouTube URL
            return {
                "status": "success" if final_path else "partial",
                "final_path": final_path,
                "youtube_url": youtube_url,
                "audio_script": result.get("audio_script"),
                "video_prompt": result.get("video_prompt"),
                "duration": result.get("duration", 0),
            }

        if final_path and os.path.exists(final_path):
            return FileResponse(
                final_path,
                media_type="video/mp4",
                filename="pipeline_output.mp4",
            )

        return {
            "error": "Pipeline completed but no final video was produced",
            "details": {
                "audio_script": result.get("audio_script"),
                "video_prompt": result.get("video_prompt"),
                "audio_path": result.get("audio_path"),
                "video_path": result.get("video_path"),
            },
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        # Clean up temp image
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ================= BATCH PIPELINE =================
# In-memory store for batch job status
batch_jobs = {}


def _run_batch_job(job_id: str, folder_path: str, params: dict):
    """Background worker for batch pipeline processing."""
    job = batch_jobs[job_id]
    job["status"] = "running"
    job["started_at"] = datetime.now().isoformat()

    # Handle scheduled start time
    schedule_time = params.get("schedule_time")
    if schedule_time:
        try:
            # Use client timezone if provided, otherwise fall back to server local time
            client_tz_name = params.get("client_timezone")
            try:
                tz = ZoneInfo(client_tz_name) if client_tz_name else None
            except (KeyError, TypeError):
                tz = None

            now = datetime.now(tz)
            parts = schedule_time.strip().split(":")
            target_hour = int(parts[0])
            target_minute = int(parts[1]) if len(parts) > 1 else 0

            target_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            if target_time <= now:
                target_time += timedelta(days=1)

            wait_seconds = (target_time - now).total_seconds()
            if wait_seconds > 0:
                job["status"] = "scheduled"
                job["scheduled_for"] = target_time.isoformat()
                print(f"[BATCH {job_id}] Waiting until {target_time.strftime('%Y-%m-%d %H:%M %Z')} ({wait_seconds:.0f}s)")
                time.sleep(wait_seconds)
                job["status"] = "running"
                print(f"[BATCH {job_id}] Schedule time reached, starting...")
        except (ValueError, IndexError):
            print(f"[BATCH {job_id}] Invalid schedule time '{schedule_time}', starting immediately")

    delay_secs = params.get("delay_between", 0)

    # Find pairs
    pairs = find_pairs(folder_path)
    if not pairs:
        job["status"] = "failed"
        job["error"] = "No valid image+description pairs found"
        return

    total = len(pairs)
    job["total"] = total
    job["results"] = []

    for i, pair in enumerate(pairs, 1):
        job["current"] = i
        job["current_name"] = pair["name"]

        print(f"[BATCH {job_id}] Processing {i}/{total}: {pair['name']}")

        item_result = {"name": pair["name"], "index": i}

        try:
            result = run_pipeline(
                image_path=pair["image"],
                description=pair["description"],
                duration_seconds=params.get("duration", 5),
                voice=params.get("voice", "vi-female"),
                background_music=params.get("background"),
                bg_volume=params.get("bg_volume", 0.3),
                width=params.get("width", 1280),
                height=params.get("height", 704),
                steps=params.get("steps", 20),
                cfg=params.get("cfg", 5.0),
                upload_to_youtube=params.get("upload_youtube", False),
                youtube_privacy=params.get("youtube_privacy"),
            )

            item_result["final_path"] = result.get("final_path", "")
            item_result["youtube_url"] = result.get("youtube_url", "")
            item_result["duration"] = result.get("duration", 0)
            item_result["audio_script"] = result.get("audio_script", "")
            item_result["status"] = "success" if result.get("final_path") else "failed"

        except Exception as e:
            item_result["status"] = "error"
            item_result["error"] = str(e)
            print(f"[BATCH {job_id}] Error on {pair['name']}: {e}")

        job["results"].append(item_result)

        # Delay between items (skip after last)
        if i < total and delay_secs > 0:
            print(f"[BATCH {job_id}] Waiting {delay_secs}s before next item...")
            time.sleep(delay_secs)

    # Final summary
    success = sum(1 for r in job["results"] if r.get("status") == "success")
    failed = total - success
    job["status"] = "completed"
    job["completed_at"] = datetime.now().isoformat()
    job["success_count"] = success
    job["fail_count"] = failed
    print(f"[BATCH {job_id}] Completed: {success}/{total} succeeded")


@app.post("/batch-pipeline")
async def batch_pipeline_endpoint(
    files: List[UploadFile] = File(...),
    duration: int = Form(5),
    voice: str = Form("vi-female"),
    background: Optional[str] = Form(None),
    bg_volume: float = Form(0.3),
    width: int = Form(1280),
    height: int = Form(704),
    steps: int = Form(20),
    cfg: float = Form(5.0),
    upload_youtube: bool = Form(False),
    youtube_privacy: Optional[str] = Form(None),
    schedule_time: Optional[str] = Form(None),
    client_timezone: Optional[str] = Form(None),
    delay_between: int = Form(0),
):
    """
    Batch pipeline: Upload multiple image+txt pairs and process them automatically.

    Upload files like: anh1.jpg, anh1.txt, anh2.jpg, anh2.txt, etc.
    Each .txt file should contain the product description for the matching image.

    Options:
      - schedule_time: HH:MM format (24h) to schedule the batch start
      - delay_between: Seconds to wait between processing each pair
      - upload_youtube: Upload each video to YouTube
      - youtube_privacy: public/private/unlisted

    Returns a job_id for tracking progress via GET /batch-pipeline/{job_id}
    """
    # Generate job ID
    job_id = uuid.uuid4().hex[:12]

    # Save uploaded files to temp directory
    tmp_dir = tempfile.mkdtemp(prefix=f"batch_{job_id}_")
    for f in files:
        file_path = os.path.join(tmp_dir, f.filename)
        with open(file_path, "wb") as fp:
            fp.write(await f.read())

    # Verify pairs exist
    pairs = find_pairs(tmp_dir)
    if not pairs:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return JSONResponse(
            status_code=400,
            content={
                "error": "No valid image+description pairs found",
                "hint": "Upload image files (.jpg/.png) with matching .txt files (same name)",
                "files_received": [f.filename for f in files],
            },
        )

    # Initialize job tracking
    batch_jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "total": len(pairs),
        "pairs": [{"name": p["name"], "description": p["description"][:100]} for p in pairs],
        "current": 0,
        "current_name": "",
        "results": [],
        "success_count": 0,
        "fail_count": 0,
    }

    params = {
        "duration": duration,
        "voice": voice,
        "background": background,
        "bg_volume": bg_volume,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg": cfg,
        "upload_youtube": upload_youtube,
        "youtube_privacy": youtube_privacy,
        "schedule_time": schedule_time,
        "client_timezone": client_timezone,
        "delay_between": delay_between,
    }

    # Run in background thread
    thread = threading.Thread(
        target=_run_batch_job,
        args=(job_id, tmp_dir, params),
        daemon=True,
    )
    thread.start()

    return {
        "job_id": job_id,
        "status": "queued",
        "total_pairs": len(pairs),
        "pairs": [{"name": p["name"], "description": p["description"][:100]} for p in pairs],
        "schedule_time": schedule_time,
        "delay_between": delay_between,
        "track_url": f"/batch-pipeline/{job_id}",
    }


@app.get("/batch-pipeline/{job_id}")
async def get_batch_status(job_id: str):
    """
    Get the status of a batch pipeline job.

    Returns current progress, results for completed items, and YouTube URLs.
    """
    if job_id not in batch_jobs:
        return JSONResponse(
            status_code=404,
            content={"error": f"Job '{job_id}' not found"},
        )

    return batch_jobs[job_id]


@app.get("/batch-pipeline")
async def list_batch_jobs():
    """List all batch pipeline jobs and their status."""
    jobs = []
    for job_id, job in batch_jobs.items():
        jobs.append({
            "job_id": job_id,
            "status": job.get("status"),
            "total": job.get("total", 0),
            "current": job.get("current", 0),
            "success_count": job.get("success_count", 0),
            "fail_count": job.get("fail_count", 0),
            "created_at": job.get("created_at"),
            "completed_at": job.get("completed_at"),
        })
    return {"jobs": jobs}


# ================= BATCH PIPELINE STREAM (SSE) =================
def _batch_sse_event(step: int, status: str, label: str, data: dict = None,
                     image_index: int = 0, image_name: str = "", total_images: int = 0) -> str:
    """Format a batch SSE event with image tracking info."""
    payload = {
        "step": step,
        "status": status,
        "label": label,
        "data": data,
        "image_index": image_index,
        "image_name": image_name,
        "total_images": total_images,
    }
    return f"data: {json.dumps(payload)}\n\n"


@app.post("/batch-pipeline/stream")
async def batch_pipeline_stream(
    files: List[UploadFile] = File(...),
    duration: int = Form(5),
    voice: str = Form("vi-female"),
    background: Optional[str] = Form(None),
    bg_volume: float = Form(0.3),
    width: int = Form(1280),
    height: int = Form(704),
    steps: int = Form(20),
    cfg: float = Form(5.0),
    upload_youtube: bool = Form(False),
    youtube_privacy: Optional[str] = Form(None),
    schedule_time: Optional[str] = Form(None),
    client_timezone: Optional[str] = Form(None),
    delay_between: int = Form(0),
):
    """
    Batch pipeline with SSE streaming for real-time step-by-step progress.

    Processes multiple image+txt pairs sequentially, streaming events for:
      - Step 0: Schedule/Wait
      - Steps 1-6: Same as single pipeline (per image)
      - image_start / image_done events between images
      - batch_done when all images are processed
    """
    # Save uploaded files to temp folder
    tmp_dir = tempfile.mkdtemp(prefix="batch_stream_")
    for f in files:
        fpath = os.path.join(tmp_dir, f.filename)
        with open(fpath, "wb") as out:
            content = await f.read()
            out.write(content)

    pairs = find_pairs(tmp_dir)
    total = len(pairs)

    if total == 0:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return JSONResponse(
            status_code=400,
            content={"error": "No valid image+description pairs found"},
        )

    groq_c = Groq(api_key=GROQ_API_KEY)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    def evt(step, status, label, data=None, idx=0, name=""):
        return _batch_sse_event(step, status, label, data, idx, name, total)

    def event_generator():
        results = []

        try:
            # ── Step 0: Schedule / Wait ──
            if schedule_time:
                try:
                    # Use client timezone if provided, otherwise fall back to server local time
                    try:
                        tz = ZoneInfo(client_timezone) if client_timezone else None
                    except (KeyError, TypeError):
                        tz = None

                    now = datetime.now(tz)
                    parts = schedule_time.strip().split(":")
                    target_hour = int(parts[0])
                    target_minute = int(parts[1]) if len(parts) > 1 else 0
                    target_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
                    if target_time <= now:
                        target_time += timedelta(days=1)

                    wait_seconds = (target_time - now).total_seconds()
                    if wait_seconds > 0:
                        yield evt(0, "schedule_wait", "Waiting for schedule", {
                            "scheduled_for": target_time.isoformat(),
                            "remaining_seconds": int(wait_seconds),
                        })
                        # Wait with periodic ticks
                        while True:
                            remaining = (target_time - datetime.now(tz)).total_seconds()
                            if remaining <= 0:
                                break
                            sleep_time = min(10, remaining)
                            time.sleep(sleep_time)
                            remaining = (target_time - datetime.now(tz)).total_seconds()
                            if remaining > 0:
                                yield evt(0, "schedule_tick", "Waiting for schedule", {
                                    "remaining_seconds": int(remaining),
                                })
                except (ValueError, IndexError):
                    pass  # Invalid schedule time, start immediately

            yield evt(0, "completed", "Schedule Ready", {"message": "Starting batch processing"})

            # ── Process each image ──
            for i, pair in enumerate(pairs, 1):
                pair_name = pair["name"]
                image_path = pair["image"]
                description_text = pair["description"]

                yield evt(0, "image_start", f"Starting image {i}/{total}", {
                    "image_name": pair_name,
                }, idx=i, name=pair_name)

                item_result = {"index": i, "name": pair_name, "status": "processing"}

                try:
                    # ── Step 1: Generate Audio Script ──
                    yield evt(1, "running", "Generate Audio Script", None, i, pair_name)
                    script = generate_audio_prompt(
                        groq_client=groq_c,
                        description=description_text,
                        duration_seconds=duration,
                        voice=voice,
                    )
                    yield evt(1, "completed", "Generate Audio Script", {"script": script}, i, pair_name)

                    # ── Step 2: Generate TTS Audio ──
                    yield evt(2, "running", "Generate TTS Audio", None, i, pair_name)
                    audio_path = generate_tts_audio(
                        text=script,
                        voice=voice,
                        output_dir=OUTPUT_DIR,
                    )
                    if not audio_path:
                        yield evt(2, "error", "Generate TTS Audio", {"error": "Audio generation failed"}, i, pair_name)
                        item_result["status"] = "error"
                        item_result["error"] = "Audio generation failed"
                        results.append(item_result)
                        yield evt(0, "image_done", f"Image {i} failed", {"result": item_result}, i, pair_name)
                        continue
                    audio_dur = get_audio_duration(audio_path)
                    yield evt(2, "completed", "Generate TTS Audio", {
                        "audio_path": audio_path,
                        "duration": round(audio_dur, 1),
                    }, i, pair_name)

                    # ── Step 3: Generate Video Prompt ──
                    yield evt(3, "running", "Generate Video Prompt", None, i, pair_name)
                    v_prompt = generate_video_prompt(
                        groq_client=groq_c,
                        description=description_text,
                        duration_seconds=duration,
                    )
                    yield evt(3, "completed", "Generate Video Prompt", {"prompt": v_prompt}, i, pair_name)

                    # ── Step 4: Generate Video (with SSE heartbeats to prevent timeout) ──
                    yield evt(4, "running", "Generate Video", None, i, pair_name)

                    # Run video generation in a thread so we can yield heartbeat events
                    video_result = [None]
                    video_error = [None]

                    def _run_video_gen():
                        try:
                            video_result[0] = generate_video_from_image(
                                image_path=image_path,
                                video_prompt=v_prompt,
                                duration_seconds=duration,
                                width=width,
                                height=height,
                                steps=steps,
                                cfg=cfg,
                                output_dir=OUTPUT_DIR,
                                timeout=600,
                            )
                        except Exception as exc:
                            video_error[0] = str(exc)

                    video_thread = threading.Thread(target=_run_video_gen, daemon=True)
                    video_thread.start()

                    # Send heartbeat events every 15s while video generates
                    elapsed = 0
                    while video_thread.is_alive():
                        video_thread.join(timeout=15)
                        elapsed += 15
                        if video_thread.is_alive():
                            yield evt(4, "running", "Generate Video", {
                                "heartbeat": True,
                                "elapsed_seconds": elapsed,
                                "message": f"Generating video... ({elapsed}s elapsed)",
                            }, i, pair_name)

                    video_path = video_result[0]
                    if video_error[0]:
                        yield evt(4, "error", "Generate Video", {"error": video_error[0]}, i, pair_name)
                        item_result["status"] = "error"
                        item_result["error"] = video_error[0]
                        results.append(item_result)
                        yield evt(0, "image_done", f"Image {i} failed", {"result": item_result}, i, pair_name)
                        continue
                    if not video_path:
                        yield evt(4, "error", "Generate Video", {"error": "Video generation failed"}, i, pair_name)
                        item_result["status"] = "error"
                        item_result["error"] = "Video generation failed"
                        results.append(item_result)
                        yield evt(0, "image_done", f"Image {i} failed", {"result": item_result}, i, pair_name)
                        continue
                    yield evt(4, "completed", "Generate Video", {"video_path": video_path}, i, pair_name)

                    # ── Step 5: Merge Video + Audio ──
                    yield evt(5, "running", "Merge Video + Audio", None, i, pair_name)
                    bg_path = None
                    if background:
                        bg_path = os.path.join(PIPELINE_BG_DIR, background)
                        if not os.path.exists(bg_path):
                            bg_path = background if os.path.exists(background) else None

                    final_path = merge_video_audio(
                        video_path=video_path,
                        audio_path=audio_path,
                        background_music=bg_path,
                        bg_volume=bg_volume,
                        output_dir=OUTPUT_DIR,
                    )
                    if not final_path:
                        yield evt(5, "error", "Merge Video + Audio", {"error": "Merge failed"}, i, pair_name)
                        item_result["status"] = "error"
                        item_result["error"] = "Merge failed"
                        results.append(item_result)
                        yield evt(0, "image_done", f"Image {i} failed", {"result": item_result}, i, pair_name)
                        continue
                    final_dur = get_audio_duration(final_path) if final_path else 0.0
                    yield evt(5, "completed", "Merge Video + Audio", {
                        "final_path": final_path,
                        "duration": round(final_dur, 1),
                    }, i, pair_name)

                    # ── Step 6: YouTube Upload ──
                    if upload_youtube and final_path:
                        yield evt(6, "running", "Upload to YouTube", None, i, pair_name)
                        try:
                            metadata = generate_youtube_metadata(
                                groq_client=groq_c,
                                description=description_text,
                                audio_script=script,
                                video_prompt=v_prompt,
                            )
                            yt_title = metadata.get("title", description_text)
                            yt_desc = metadata.get("description", f"Auto-generated video: {description_text}")
                            yt_tags = metadata.get("tags", ["automation", "AI", "video"])

                            youtube = get_authenticated_service()
                            video_url = upload_video(
                                youtube=youtube,
                                file_path=final_path,
                                title=yt_title,
                                description=yt_desc,
                                tags=yt_tags,
                                privacy_status=youtube_privacy,
                            )
                            item_result["youtube_url"] = video_url
                            yield evt(6, "completed", "Upload to YouTube", {
                                "youtube_url": video_url,
                                "title": yt_title,
                            }, i, pair_name)
                        except Exception as e:
                            yield evt(6, "error", "Upload to YouTube", {"error": str(e)}, i, pair_name)
                    else:
                        yield evt(6, "skipped", "Upload to YouTube", None, i, pair_name)

                    # Image completed successfully
                    item_result["status"] = "success"
                    item_result["final_path"] = final_path
                    item_result["audio_script"] = script
                    item_result["duration"] = round(final_dur, 1)

                except Exception as e:
                    item_result["status"] = "error"
                    item_result["error"] = str(e)
                    yield evt(0, "image_error", f"Image {i} error", {"error": str(e)}, i, pair_name)

                results.append(item_result)
                yield evt(0, "image_done", f"Image {i}/{total} complete", {
                    "result": item_result,
                }, idx=i, name=pair_name)

                # Delay between images (skip after last)
                if i < total and delay_between > 0:
                    yield evt(0, "delay_wait", f"Waiting {delay_between}s before next image", {
                        "delay_seconds": delay_between,
                    }, idx=i, name=pair_name)
                    time.sleep(delay_between)

            # ── Batch Done ──
            success_count = sum(1 for r in results if r.get("status") == "success")
            fail_count = total - success_count
            yield evt(0, "batch_done", "Batch Complete", {
                "success_count": success_count,
                "fail_count": fail_count,
                "results": results,
            })

        except Exception as e:
            yield evt(0, "batch_error", "Batch Error", {"error": str(e)})
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ================= VOICES =================
@app.get("/voices")
async def get_voices():
    """List available TTS voices."""
    return {"voices": list(EDGE_VOICES.keys())}


# ================= PIPELINE STREAM (SSE) =================
def _sse_event(step: int, status: str, label: str, data: dict = None) -> str:
    """Format a Server-Sent Event message."""
    payload = {
        "step": step,
        "status": status,
        "label": label,
        "data": data,
    }
    return f"data: {json.dumps(payload)}\n\n"


@app.post("/pipeline/stream")
async def run_pipeline_stream(
    image: UploadFile = File(...),
    description: str = Form(...),
    duration: int = Form(5),
    voice: str = Form("vi-female"),
    background: Optional[str] = Form(None),
    bg_volume: float = Form(0.3),
    width: int = Form(1280),
    height: int = Form(704),
    steps: int = Form(20),
    cfg: float = Form(5.0),
    audio_script: Optional[str] = Form(None),
    video_prompt: Optional[str] = Form(None),
    upload_youtube: bool = Form(False),
    youtube_privacy: Optional[str] = Form(None),
):
    """
    Run the pipeline with Server-Sent Events for real-time step progress.

    Streams SSE events for each of the 6 pipeline steps:
      1. Generate Audio Script (Groq LLM)
      2. Generate TTS Audio (Edge TTS)
      3. Generate Video Prompt (Groq LLM)
      4. Generate Video (ComfyUI Wan2.2)
      5. Merge Video + Audio (ffmpeg)
      6. Upload to YouTube (optional)
    """
    # Save uploaded image to temp file
    tmp_dir = tempfile.mkdtemp()
    image_path = os.path.join(tmp_dir, image.filename)
    with open(image_path, "wb") as f:
        f.write(await image.read())

    groq_c = Groq(api_key=GROQ_API_KEY)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    def event_generator():
        result = {
            "audio_script": None,
            "audio_path": None,
            "video_prompt": None,
            "video_path": None,
            "final_path": None,
            "duration": 0.0,
            "youtube_url": None,
        }

        try:
            # ── Step 1: Generate Audio Script ──
            yield _sse_event(1, "running", "Generate Audio Script")
            if audio_script:
                script = audio_script
            else:
                script = generate_audio_prompt(
                    groq_client=groq_c,
                    description=description,
                    duration_seconds=duration,
                    voice=voice,
                )
            result["audio_script"] = script
            yield _sse_event(1, "completed", "Generate Audio Script", {"script": script})

            # ── Step 2: Generate TTS Audio ──
            yield _sse_event(2, "running", "Generate TTS Audio")
            audio_path = generate_tts_audio(
                text=script,
                voice=voice,
                output_dir=OUTPUT_DIR,
            )
            result["audio_path"] = audio_path
            if not audio_path:
                yield _sse_event(2, "error", "Generate TTS Audio", {"error": "Audio generation failed"})
                yield _sse_event(0, "error", "Pipeline Failed", {"error": "Audio generation failed"})
                return
            audio_dur = get_audio_duration(audio_path)
            yield _sse_event(2, "completed", "Generate TTS Audio", {
                "audio_path": audio_path,
                "duration": round(audio_dur, 1),
            })

            # ── Step 3: Generate Video Prompt ──
            yield _sse_event(3, "running", "Generate Video Prompt")
            if video_prompt:
                v_prompt = video_prompt
            else:
                v_prompt = generate_video_prompt(
                    groq_client=groq_c,
                    description=description,
                    duration_seconds=duration,
                )
            result["video_prompt"] = v_prompt
            yield _sse_event(3, "completed", "Generate Video Prompt", {"prompt": v_prompt})

            # ── Step 4: Generate Video (with SSE heartbeats to prevent timeout) ──
            yield _sse_event(4, "running", "Generate Video")

            # Run video generation in a thread so we can yield heartbeat events
            video_gen_result = [None]
            video_gen_error = [None]

            def _run_single_video_gen():
                try:
                    video_gen_result[0] = generate_video_from_image(
                        image_path=image_path,
                        video_prompt=v_prompt,
                        duration_seconds=duration,
                        width=width,
                        height=height,
                        steps=steps,
                        cfg=cfg,
                        output_dir=OUTPUT_DIR,
                        timeout=600,
                    )
                except Exception as exc:
                    video_gen_error[0] = str(exc)

            vt = threading.Thread(target=_run_single_video_gen, daemon=True)
            vt.start()

            # Send heartbeat events every 15s while video generates
            vt_elapsed = 0
            while vt.is_alive():
                vt.join(timeout=15)
                vt_elapsed += 15
                if vt.is_alive():
                    yield _sse_event(4, "running", "Generate Video", {
                        "heartbeat": True,
                        "elapsed_seconds": vt_elapsed,
                        "message": f"Generating video... ({vt_elapsed}s elapsed)",
                    })

            video_path = video_gen_result[0]
            result["video_path"] = video_path
            if video_gen_error[0]:
                yield _sse_event(4, "error", "Generate Video", {"error": video_gen_error[0]})
                yield _sse_event(0, "error", "Pipeline Failed", {"error": video_gen_error[0]})
                return
            if not video_path:
                yield _sse_event(4, "error", "Generate Video", {"error": "Video generation failed"})
                yield _sse_event(0, "error", "Pipeline Failed", {"error": "Video generation failed"})
                return
            yield _sse_event(4, "completed", "Generate Video", {"video_path": video_path})

            # ── Step 5: Merge Video + Audio ──
            yield _sse_event(5, "running", "Merge Video + Audio")
            bg_path = None
            if background:
                bg_path = os.path.join(PIPELINE_BG_DIR, background)
                if not os.path.exists(bg_path):
                    if os.path.exists(background):
                        bg_path = background
                    else:
                        bg_path = None

            final_path = merge_video_audio(
                video_path=video_path,
                audio_path=audio_path,
                background_music=bg_path,
                bg_volume=bg_volume,
                output_dir=OUTPUT_DIR,
            )
            result["final_path"] = final_path
            result["duration"] = get_audio_duration(final_path) if final_path else 0.0
            if not final_path:
                yield _sse_event(5, "error", "Merge Video + Audio", {"error": "Merge failed"})
                yield _sse_event(0, "error", "Pipeline Failed", {"error": "Merge failed"})
                return
            yield _sse_event(5, "completed", "Merge Video + Audio", {
                "final_path": final_path,
                "duration": round(result["duration"], 1),
            })

            # ── Step 6: Upload to YouTube (optional) ──
            if upload_youtube and final_path:
                yield _sse_event(6, "running", "Upload to YouTube")
                try:
                    metadata = generate_youtube_metadata(
                        groq_client=groq_c,
                        description=description,
                        audio_script=script,
                        video_prompt=v_prompt,
                    )
                    yt_title = metadata.get("title", description)
                    yt_desc = metadata.get("description", f"Auto-generated video: {description}")
                    yt_tags = metadata.get("tags", ["automation", "AI", "video"])

                    youtube = get_authenticated_service()
                    video_url = upload_video(
                        youtube=youtube,
                        file_path=final_path,
                        title=yt_title,
                        description=yt_desc,
                        tags=yt_tags,
                        privacy_status=youtube_privacy,
                    )
                    result["youtube_url"] = video_url
                    yield _sse_event(6, "completed", "Upload to YouTube", {
                        "youtube_url": video_url,
                        "title": yt_title,
                    })
                except Exception as e:
                    yield _sse_event(6, "error", "Upload to YouTube", {"error": str(e)})
            else:
                yield _sse_event(6, "skipped", "Upload to YouTube", None)

            # ── Done ──
            yield _sse_event(0, "done", "Pipeline Complete", {
                "final_path": result["final_path"],
                "audio_path": result["audio_path"],
                "video_path": result["video_path"],
                "youtube_url": result.get("youtube_url"),
                "audio_script": result["audio_script"],
                "video_prompt": result["video_prompt"],
                "duration": round(result.get("duration", 0), 1),
            })

        except Exception as e:
            yield _sse_event(0, "error", "Pipeline Error", {"error": str(e)})
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ================= PIPELINE SESSIONS (Step-by-Step) =================
pipeline_sessions = {}


@app.post("/pipeline/session")
async def create_pipeline_session(
    image: UploadFile = File(...),
    description: str = Form(...),
    duration: int = Form(5),
    voice: str = Form("vi-female"),
    background: Optional[str] = Form(None),
    bg_volume: float = Form(0.3),
    width: int = Form(1280),
    height: int = Form(704),
    steps: int = Form(20),
    cfg: float = Form(5.0),
    audio_script: Optional[str] = Form(None),
    video_prompt: Optional[str] = Form(None),
    upload_youtube: bool = Form(False),
    youtube_privacy: Optional[str] = Form(None),
):
    """Create a pipeline session for step-by-step manual execution."""
    session_id = uuid.uuid4().hex[:12]
    tmp_dir = tempfile.mkdtemp(prefix=f"session_{session_id}_")
    image_path = os.path.join(tmp_dir, image.filename)
    with open(image_path, "wb") as f:
        f.write(await image.read())

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    pipeline_sessions[session_id] = {
        "session_id": session_id,
        "status": "created",
        "image_path": image_path,
        "tmp_dir": tmp_dir,
        "config": {
            "description": description,
            "duration": duration,
            "voice": voice,
            "background": background,
            "bg_volume": bg_volume,
            "width": width,
            "height": height,
            "steps": steps,
            "cfg": cfg,
            "audio_script": audio_script,
            "video_prompt": video_prompt,
            "upload_youtube": upload_youtube,
            "youtube_privacy": youtube_privacy,
        },
        "current_step": 0,
        "step_results": {
            1: {"status": "idle", "data": None},
            2: {"status": "idle", "data": None},
            3: {"status": "idle", "data": None},
            4: {"status": "idle", "data": None},
            5: {"status": "idle", "data": None},
            6: {"status": "idle", "data": None},
        },
        "created_at": datetime.now().isoformat(),
    }

    return {
        "session_id": session_id,
        "status": "created",
        "current_step": 0,
        "steps": {
            str(k): v for k, v in pipeline_sessions[session_id]["step_results"].items()
        },
    }


@app.get("/pipeline/session/{session_id}")
async def get_pipeline_session(session_id: str):
    """Get the current state of a pipeline session."""
    if session_id not in pipeline_sessions:
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    sess = pipeline_sessions[session_id]
    return {
        "session_id": sess["session_id"],
        "status": sess["status"],
        "current_step": sess["current_step"],
        "steps": {str(k): v for k, v in sess["step_results"].items()},
        "created_at": sess["created_at"],
    }


@app.delete("/pipeline/session/{session_id}")
async def delete_pipeline_session(session_id: str):
    """Delete/cancel a pipeline session."""
    if session_id not in pipeline_sessions:
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    sess = pipeline_sessions.pop(session_id)
    shutil.rmtree(sess.get("tmp_dir", ""), ignore_errors=True)
    return {"status": "deleted", "session_id": session_id}


@app.post("/pipeline/session/{session_id}/step/{step_num}")
async def execute_session_step(session_id: str, step_num: int):
    """
    Execute a single pipeline step in a session.
    Returns SSE stream for real-time progress of that single step.
    """
    if session_id not in pipeline_sessions:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    sess = pipeline_sessions[session_id]

    if step_num < 1 or step_num > 6:
        return JSONResponse(status_code=400, content={"error": "Step must be 1-6"})

    # Validate prerequisites
    if step_num > 1 and sess["step_results"][step_num - 1]["status"] != "completed":
        return JSONResponse(
            status_code=400,
            content={"error": f"Step {step_num - 1} must be completed first"},
        )

    if sess["step_results"][step_num]["status"] == "completed":
        return JSONResponse(
            status_code=400,
            content={"error": f"Step {step_num} already completed"},
        )

    config = sess["config"]
    image_path = sess["image_path"]
    groq_c = Groq(api_key=GROQ_API_KEY)

    def step_generator():
        try:
            sess["status"] = "running"
            sess["step_results"][step_num]["status"] = "running"

            if step_num == 1:
                yield _sse_event(1, "running", "Generate Audio Script")
                if config.get("audio_script"):
                    script = config["audio_script"]
                else:
                    script = generate_audio_prompt(
                        groq_client=groq_c,
                        description=config["description"],
                        duration_seconds=config["duration"],
                        voice=config["voice"],
                    )
                sess["step_results"][1]["status"] = "completed"
                sess["step_results"][1]["data"] = {"script": script}
                sess["current_step"] = 1
                yield _sse_event(1, "completed", "Generate Audio Script", {"script": script})

            elif step_num == 2:
                yield _sse_event(2, "running", "Generate TTS Audio")
                script = sess["step_results"][1]["data"]["script"]
                audio_path = generate_tts_audio(
                    text=script,
                    voice=config["voice"],
                    output_dir=OUTPUT_DIR,
                )
                if not audio_path:
                    sess["step_results"][2]["status"] = "error"
                    sess["step_results"][2]["data"] = {"error": "Audio generation failed"}
                    yield _sse_event(2, "error", "Generate TTS Audio", {"error": "Audio generation failed"})
                    return
                audio_dur = get_audio_duration(audio_path)
                sess["step_results"][2]["status"] = "completed"
                sess["step_results"][2]["data"] = {"audio_path": audio_path, "duration": round(audio_dur, 1)}
                sess["current_step"] = 2
                yield _sse_event(2, "completed", "Generate TTS Audio", {
                    "audio_path": audio_path,
                    "duration": round(audio_dur, 1),
                })

            elif step_num == 3:
                yield _sse_event(3, "running", "Generate Video Prompt")
                if config.get("video_prompt"):
                    v_prompt = config["video_prompt"]
                else:
                    v_prompt = generate_video_prompt(
                        groq_client=groq_c,
                        description=config["description"],
                        duration_seconds=config["duration"],
                    )
                sess["step_results"][3]["status"] = "completed"
                sess["step_results"][3]["data"] = {"prompt": v_prompt}
                sess["current_step"] = 3
                yield _sse_event(3, "completed", "Generate Video Prompt", {"prompt": v_prompt})

            elif step_num == 4:
                yield _sse_event(4, "running", "Generate Video")
                v_prompt = sess["step_results"][3]["data"]["prompt"]

                # Run video generation in a thread with heartbeat to prevent timeout
                step4_result = [None]
                step4_error = [None]

                def _run_step4_video_gen():
                    try:
                        step4_result[0] = generate_video_from_image(
                            image_path=image_path,
                            video_prompt=v_prompt,
                            duration_seconds=config["duration"],
                            width=config["width"],
                            height=config["height"],
                            steps=config["steps"],
                            cfg=config["cfg"],
                            output_dir=OUTPUT_DIR,
                            timeout=600,
                        )
                    except Exception as exc:
                        step4_error[0] = str(exc)

                s4t = threading.Thread(target=_run_step4_video_gen, daemon=True)
                s4t.start()

                s4_elapsed = 0
                while s4t.is_alive():
                    s4t.join(timeout=15)
                    s4_elapsed += 15
                    if s4t.is_alive():
                        yield _sse_event(4, "running", "Generate Video", {
                            "heartbeat": True,
                            "elapsed_seconds": s4_elapsed,
                            "message": f"Generating video... ({s4_elapsed}s elapsed)",
                        })

                video_path = step4_result[0]
                if step4_error[0]:
                    sess["step_results"][4]["status"] = "error"
                    sess["step_results"][4]["data"] = {"error": step4_error[0]}
                    yield _sse_event(4, "error", "Generate Video", {"error": step4_error[0]})
                    return
                if not video_path:
                    sess["step_results"][4]["status"] = "error"
                    sess["step_results"][4]["data"] = {"error": "Video generation failed"}
                    yield _sse_event(4, "error", "Generate Video", {"error": "Video generation failed"})
                    return
                sess["step_results"][4]["status"] = "completed"
                sess["step_results"][4]["data"] = {"video_path": video_path}
                sess["current_step"] = 4
                yield _sse_event(4, "completed", "Generate Video", {"video_path": video_path})

            elif step_num == 5:
                yield _sse_event(5, "running", "Merge Video + Audio")
                audio_path = sess["step_results"][2]["data"]["audio_path"]
                video_path = sess["step_results"][4]["data"]["video_path"]
                bg_path = None
                if config.get("background"):
                    bg_path = os.path.join(PIPELINE_BG_DIR, config["background"])
                    if not os.path.exists(bg_path):
                        bg_path = config["background"] if os.path.exists(config["background"]) else None

                final_path = merge_video_audio(
                    video_path=video_path,
                    audio_path=audio_path,
                    background_music=bg_path,
                    bg_volume=config["bg_volume"],
                    output_dir=OUTPUT_DIR,
                )
                if not final_path:
                    sess["step_results"][5]["status"] = "error"
                    sess["step_results"][5]["data"] = {"error": "Merge failed"}
                    yield _sse_event(5, "error", "Merge Video + Audio", {"error": "Merge failed"})
                    return
                final_dur = get_audio_duration(final_path)
                sess["step_results"][5]["status"] = "completed"
                sess["step_results"][5]["data"] = {"final_path": final_path, "duration": round(final_dur, 1)}
                sess["current_step"] = 5
                yield _sse_event(5, "completed", "Merge Video + Audio", {
                    "final_path": final_path,
                    "duration": round(final_dur, 1),
                })

            elif step_num == 6:
                if not config.get("upload_youtube"):
                    sess["step_results"][6]["status"] = "skipped"
                    sess["step_results"][6]["data"] = None
                    sess["current_step"] = 6
                    sess["status"] = "completed"
                    yield _sse_event(6, "skipped", "Upload to YouTube")
                    return

                yield _sse_event(6, "running", "Upload to YouTube")
                final_path = sess["step_results"][5]["data"]["final_path"]
                script = sess["step_results"][1]["data"]["script"]
                v_prompt = sess["step_results"][3]["data"]["prompt"]
                try:
                    metadata = generate_youtube_metadata(
                        groq_client=groq_c,
                        description=config["description"],
                        audio_script=script,
                        video_prompt=v_prompt,
                    )
                    yt_title = metadata.get("title", config["description"])
                    yt_desc = metadata.get("description", f"Auto-generated video: {config['description']}")
                    yt_tags = metadata.get("tags", ["automation", "AI", "video"])

                    youtube = get_authenticated_service()
                    video_url = upload_video(
                        youtube=youtube,
                        file_path=final_path,
                        title=yt_title,
                        description=yt_desc,
                        tags=yt_tags,
                        privacy_status=config.get("youtube_privacy"),
                    )
                    sess["step_results"][6]["status"] = "completed"
                    sess["step_results"][6]["data"] = {"youtube_url": video_url, "title": yt_title}
                    sess["current_step"] = 6
                    yield _sse_event(6, "completed", "Upload to YouTube", {
                        "youtube_url": video_url,
                        "title": yt_title,
                    })
                except Exception as e:
                    sess["step_results"][6]["status"] = "error"
                    sess["step_results"][6]["data"] = {"error": str(e)}
                    yield _sse_event(6, "error", "Upload to YouTube", {"error": str(e)})

            # Check if all steps are done
            all_done = all(
                sess["step_results"][s]["status"] in ("completed", "skipped")
                for s in range(1, 7)
            )
            if all_done:
                sess["status"] = "completed"
            else:
                sess["status"] = "paused"

        except Exception as e:
            sess["step_results"][step_num]["status"] = "error"
            sess["step_results"][step_num]["data"] = {"error": str(e)}
            sess["status"] = "error"
            yield _sse_event(step_num, "error", f"Step {step_num} Error", {"error": str(e)})

    return StreamingResponse(
        step_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ================= SERVE FILES =================
ALLOWED_DIRS = ["pipeline_output", "audio_output", "music", "images"]

@app.get("/file")
async def serve_file(path: str):
    """Serve local files (video/audio/images) by relative path."""
    # Security: normalize and validate path
    normalized = os.path.normpath(path)
    if normalized.startswith("..") or os.path.isabs(normalized):
        return JSONResponse({"error": "Invalid path"}, status_code=400)

    # Check that the file is in an allowed directory
    top_dir = normalized.split(os.sep)[0]
    if top_dir not in ALLOWED_DIRS:
        return JSONResponse({"error": f"Access denied: {top_dir}"}, status_code=403)

    if not os.path.exists(normalized):
        return JSONResponse({"error": "File not found"}, status_code=404)

    # Determine media type
    ext = os.path.splitext(normalized)[1].lower()
    media_types = {
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(normalized, media_type=media_type)


# ================= SERVE FRONTEND (PRODUCTION) =================
# Uncomment to serve built React frontend
# if os.path.exists("frontend/dist"):
#     app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")