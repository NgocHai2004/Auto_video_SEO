"""
Complete Pipeline: Audio Prompt → Audio → Video Prompt → Video → Merge

This pipeline automates the full workflow:
  1. Generate an audio script (TTS text) via Groq LLM, calibrated to a target duration in seconds
  2. Convert the script to speech via Edge TTS
  3. Generate a cinematic video prompt via Groq LLM based on the image/product description
  4. Generate a video from an image + prompt via ComfyUI API (Wan2.2 Image-to-Video)
  5. Merge the generated video and audio into a final output using ffmpeg

Usage:
    python pipeline.py --image product.jpg --description "Sữa rửa mặt ABC" --duration 5

    python pipeline.py --image product.jpg --description "Luxury perfume" --duration 10 \
        --voice en-us-female --background "Hopeful Freedom - Asher Fulero.mp3"

Requirements:
    pip install -r requirements.txt
"""

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path

import edge_tts
from groq import Groq

from comfyui_api import ComfyUIClient, build_workflow, COMFYUI_HOST, COMFYUI_PORT
from upload_youtube import get_authenticated_service, upload_video

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

GROQ_API_KEY = "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"
GROQ_MODEL = "openai/gpt-oss-20b"

OUTPUT_DIR = "pipeline_output"
BG_DIR = os.path.join("music", "backgrounds")

EDGE_VOICES = {
    "vi-female": "vi-VN-HoaiMyNeural",
    "vi-male": "vi-VN-NamMinhNeural",
    "en-us-female": "en-US-JennyNeural",
    "en-us-male": "en-US-GuyNeural",
}

# Approximate speaking rates (characters per second) for duration estimation
# Vietnamese Edge TTS speaks roughly 12-15 chars/sec, English ~13-16 chars/sec
CHARS_PER_SECOND = {
    "vi-female": 13,
    "vi-male": 13,
    "en-us-female": 14,
    "en-us-male": 14,
}

# Video FPS for ComfyUI
VIDEO_FPS = 24


# ──────────────────────────────────────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────────────────────────────────────

def generate_filename(ext: str, prefix: str = "") -> str:
    """Generate a unique filename with timestamp."""
    uid = uuid.uuid4().hex[:12]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    name = f"{prefix}_{uid}_{ts}.{ext}" if prefix else f"{uid}_{ts}.{ext}"
    return name


def get_audio_duration(filepath: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                filepath,
            ],
            capture_output=True, text=True, check=True,
        )
        return float(result.stdout.strip())
    except Exception as e:
        print(f"[WARN] Could not determine audio duration: {e}")
        return 0.0


def print_step(step_num: int, title: str):
    """Print a formatted step header."""
    print(f"\n{'='*60}")
    print(f"  Step {step_num}: {title}")
    print(f"{'='*60}\n")


# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Generate Audio Script via Groq LLM
# ──────────────────────────────────────────────────────────────────────────────

def generate_audio_prompt(
    groq_client: Groq,
    description: str,
    duration_seconds: int,
    voice: str = "vi-female",
) -> str:
    """
    Use Groq LLM to generate a TTS script that fits the target duration.

    The prompt instructs the LLM to produce text that, when spoken at normal
    pace, will last approximately `duration_seconds` seconds.

    Args:
        groq_client:      Initialized Groq client.
        description:      Product/scene description from the user.
        duration_seconds:  Target audio duration in seconds.
        voice:            Voice key (used to estimate character count).

    Returns:
        str: The generated TTS script text.
    """
    chars_target = CHARS_PER_SECOND.get(voice, 14) * duration_seconds

    # Detect language from voice
    is_vietnamese = voice.startswith("vi")

    min_chars = int(chars_target * 0.7)  # Accept scripts at least 70% of target length

    if is_vietnamese:
        system_prompt = (
            f"Bạn là nhân viên bán hàng chuyên nghiệp. "
            f"Hãy viết một đoạn quảng cáo thuyết phục, hấp dẫn cho sản phẩm bên dưới. "
            f"Đoạn quảng cáo PHẢI có độ dài ĐÚNG khoảng {chars_target} ký tự "
            f"(tương đương {duration_seconds} giây khi đọc lên). "
            f"QUAN TRỌNG: Đoạn văn phải đủ dài, ít nhất {min_chars} ký tự. "
            f"Nếu cần, hãy thêm chi tiết về lợi ích, ưu điểm, khuyến mãi. "
            f"Chỉ trả về nội dung kịch bản, không giải thích, không xuống dòng, "
            f"không dùng emoji hay ký hiệu đặc biệt."
        )
    else:
        system_prompt = (
            f"You are a professional salesperson. "
            f"Write a compelling, persuasive advertisement script for the product below. "
            f"The script MUST be EXACTLY about {chars_target} characters long "
            f"(equivalent to {duration_seconds} seconds when spoken aloud). "
            f"IMPORTANT: The text must be at least {min_chars} characters. "
            f"If needed, add details about benefits, features, promotions. "
            f"Return ONLY the script text. No explanations, no line breaks, "
            f"no emojis or special characters."
        )

    print(f"[LLM] Generating audio script (~{duration_seconds}s, ~{chars_target} chars, min {min_chars} chars)...")

    max_retries = 3
    script = ""
    best_script = ""

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[LLM] Attempt {attempt}/{max_retries}...")

            # On retry, add extra emphasis on length requirement
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": description},
            ]
            if attempt > 1 and best_script:
                if is_vietnamese:
                    messages.append({
                        "role": "assistant", "content": best_script
                    })
                    messages.append({
                        "role": "user",
                        "content": f"Đoạn văn trên quá ngắn ({len(best_script)} ký tự). "
                                   f"Viết lại DÀI HƠN, ít nhất {min_chars} ký tự. "
                                   f"Thêm chi tiết về công dụng, lợi ích, cảm nhận khách hàng."
                    })
                else:
                    messages.append({
                        "role": "assistant", "content": best_script
                    })
                    messages.append({
                        "role": "user",
                        "content": f"That script was too short ({len(best_script)} chars). "
                                   f"Rewrite it LONGER, at least {min_chars} characters. "
                                   f"Add more details about features, benefits, customer testimonials."
                    })

            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=0.8,
                max_completion_tokens=800,
            )

            content = completion.choices[0].message.content
            if content:
                script = content.strip()

            if script:
                print(f"[LLM] Generated script ({len(script)} chars):\n       \"{script}\"")

                # Track best script (closest to target)
                if not best_script or abs(len(script) - chars_target) < abs(len(best_script) - chars_target):
                    best_script = script

                # Accept if long enough
                if len(script) >= min_chars:
                    return script
                else:
                    print(f"[WARN] Script too short ({len(script)} < {min_chars} chars), retrying...")
                    continue

            print(f"[WARN] LLM returned empty response on attempt {attempt}")

        except Exception as e:
            print(f"[WARN] LLM call failed on attempt {attempt}: {e}")

    # Return best script if we have one, even if short
    if best_script:
        print(f"[WARN] Using best available script ({len(best_script)} chars)")
        return best_script

    # Fallback: generate a scaled script from the description
    if is_vietnamese:
        base = f"Khám phá {description} - sản phẩm chất lượng cao, được yêu thích hàng đầu. "
        extras = [
            "Công nghệ tiên tiến, thiết kế hiện đại, mang đến trải nghiệm tuyệt vời. ",
            "Được hàng triệu khách hàng tin dùng và đánh giá 5 sao. ",
            "Đặt hàng ngay hôm nay để nhận ưu đãi đặc biệt giảm giá lên đến 50%. ",
            "Chất lượng vượt trội, giá cả hợp lý, giao hàng nhanh chóng toàn quốc. ",
            "Sản phẩm đã qua kiểm định nghiêm ngặt, an toàn cho mọi gia đình. ",
        ]
    else:
        base = f"Discover {description} - premium quality, trusted by thousands. "
        extras = [
            "Cutting-edge technology, modern design, delivering an exceptional experience. ",
            "Rated 5 stars by millions of satisfied customers worldwide. ",
            "Order today and receive an exclusive discount of up to 50 percent off. ",
            "Superior quality, competitive pricing, with fast nationwide delivery. ",
            "Rigorously tested and certified safe for the whole family. ",
        ]

    script = base
    for extra in extras:
        if len(script) >= chars_target:
            break
        script += extra

    print(f"[WARN] Using fallback script ({len(script)} chars): \"{script}\"")
    return script


# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Generate TTS Audio via Edge TTS
# ──────────────────────────────────────────────────────────────────────────────

async def _generate_tts_audio_async(
    text: str,
    voice_name: str,
    filepath: str,
) -> None:
    """Internal async helper to run Edge TTS."""
    communicate = edge_tts.Communicate(text, voice_name)
    await communicate.save(filepath)


def generate_tts_audio(
    text: str,
    voice: str = "vi-female",
    output_dir: str = OUTPUT_DIR,
) -> str:
    """
    Convert text to speech using Edge TTS.

    Handles both sync and async contexts (e.g., when called from Gradio
    which already has a running event loop).

    Args:
        text:       The script text to convert.
        voice:      Voice key from EDGE_VOICES.
        output_dir: Directory to save the audio file.

    Returns:
        str: Path to the generated audio file.
    """
    import threading

    os.makedirs(output_dir, exist_ok=True)
    filename = generate_filename("mp3", prefix="audio")
    filepath = os.path.join(output_dir, filename)

    voice_name = EDGE_VOICES.get(voice, voice)
    print(f"[TTS] Generating audio with voice: {voice_name}")

    # Validate text is not empty
    if not text or not text.strip():
        print(f"[ERROR] TTS text is empty, cannot generate audio")
        return ""

    print(f"[TTS] Text to speak ({len(text)} chars): \"{text[:100]}\"")

    # Edge TTS requires an async event loop. When called from within
    # an already-running loop (e.g., Gradio), asyncio.run() will fail.
    # Solution: run in a separate thread with its own event loop.
    exception_holder = [None]

    def _run_tts():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    _generate_tts_audio_async(text, voice_name, filepath)
                )
            finally:
                loop.close()
        except Exception as e:
            exception_holder[0] = e

    thread = threading.Thread(target=_run_tts)
    thread.start()
    thread.join(timeout=60)

    if exception_holder[0]:
        print(f"[ERROR] TTS generation failed: {exception_holder[0]}")
        return ""

    # Validate the file was created and is not empty
    if not os.path.exists(filepath):
        print(f"[ERROR] TTS file was not created: {filepath}")
        return ""

    file_size = os.path.getsize(filepath)
    if file_size == 0:
        print(f"[ERROR] TTS file is empty (0 bytes): {filepath}")
        os.remove(filepath)
        return ""

    duration = get_audio_duration(filepath)
    print(f"[TTS] Audio saved: {filepath} ({duration:.1f}s, {file_size} bytes)")
    return filepath


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Generate Video Prompt via Groq LLM
# ──────────────────────────────────────────────────────────────────────────────

def generate_video_prompt(
    groq_client: Groq,
    description: str,
    duration_seconds: int,
) -> str:
    """
    Use Groq LLM to generate a cinematic video prompt for ComfyUI Wan2.2.

    The prompt describes camera movements, lighting, and visual effects
    suitable for an image-to-video AI model.

    Args:
        groq_client:      Initialized Groq client.
        description:      Product/scene description from the user.
        duration_seconds:  Video duration for context.

    Returns:
        str: The generated video prompt for ComfyUI.
    """
    system_prompt = (
        "You are an expert at writing prompts for AI video generation models. "
        "Given a product or scene description, write a detailed cinematic video prompt "
        "in English that describes: camera movement, lighting, visual effects, atmosphere, "
        "and motion. The prompt should be suitable for a Wan2.2 image-to-video model. "
        "Focus on: smooth camera movements (push-in, dolly, pan), professional lighting "
        "(golden hour, studio, volumetric), product-focused composition, premium aesthetic. "
        "Return ONLY the prompt text, no explanations. Keep it under 200 words. "
        "Do NOT include any Chinese characters."
    )

    user_message = (
        f"Product/Scene: {description}\n"
        f"Video duration: ~{duration_seconds} seconds\n"
        f"Create a cinematic video generation prompt for this."
    )

    print(f"[LLM] Generating video prompt...")

    max_retries = 3
    video_prompt = ""

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[LLM] Attempt {attempt}/{max_retries}...")
            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.9,
                max_completion_tokens=400,
            )

            content = completion.choices[0].message.content
            if content:
                video_prompt = content.strip()

            if video_prompt:
                print(f"[LLM] Generated video prompt:\n       \"{video_prompt[:150]}...\"")
                return video_prompt

            print(f"[WARN] LLM returned empty video prompt on attempt {attempt}")

        except Exception as e:
            print(f"[WARN] LLM call failed on attempt {attempt}: {e}")

    # Fallback prompt
    if not video_prompt:
        video_prompt = (
            f"Ultra cinematic commercial shot of {description}. "
            f"Soft golden morning light, luxury advertisement style, shallow depth of field, "
            f"85mm lens, slow camera push-in, high-end branding style, clean minimal background, "
            f"elegant atmosphere, volumetric lighting, soft reflections, glossy highlights, 4K, "
            f"professional studio commercial, smooth motion, premium aesthetic"
        )
        print(f"[WARN] Using fallback video prompt")

    return video_prompt


# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Generate Video via ComfyUI API
# ──────────────────────────────────────────────────────────────────────────────

def generate_video_from_image(
    image_path: str,
    video_prompt: str,
    duration_seconds: int,
    width: int = 1280,
    height: int = 704,
    steps: int = 20,
    cfg: float = 5.0,
    host: str = COMFYUI_HOST,
    port: int = COMFYUI_PORT,
    output_dir: str = OUTPUT_DIR,
    timeout: int = 600,
) -> str:
    """
    Generate a video from an image using ComfyUI Wan2.2 Image-to-Video.

    Args:
        image_path:       Path to the input image.
        video_prompt:     Positive prompt for video generation.
        duration_seconds: Target video duration in seconds.
        width:            Video width.
        height:           Video height.
        steps:            Sampling steps.
        cfg:              CFG guidance scale.
        host:             ComfyUI server host.
        port:             ComfyUI server port.
        output_dir:       Local directory to save downloaded video.
        timeout:          Max seconds to wait for generation.

    Returns:
        str: Path to the downloaded video file, or empty string on failure.
    """
    # Calculate frame count: duration * fps + 1
    frame_count = duration_seconds * VIDEO_FPS + 1

    print(f"[COMFYUI] Connecting to ComfyUI at {host}:{port}")
    client = ComfyUIClient(host=host, port=port)

    # Upload image
    print(f"[COMFYUI] Uploading image: {image_path}")
    image_name = client.upload_image(image_path)

    # Build workflow
    workflow = build_workflow(
        image_name=image_name,
        positive_prompt=video_prompt,
        width=width,
        height=height,
        length=frame_count,
        steps=steps,
        cfg=cfg,
        fps=VIDEO_FPS,
    )

    # Queue prompt
    print(f"[COMFYUI] Parameters:")
    print(f"          Resolution: {width}x{height}")
    print(f"          Frames:     {frame_count} ({duration_seconds}s at {VIDEO_FPS}fps)")
    print(f"          Steps:      {steps}, CFG: {cfg}")

    result = client.queue_prompt(workflow)
    prompt_id = result.get("prompt_id")

    if not prompt_id:
        print("[ERROR] Failed to get prompt_id from ComfyUI")
        return ""

    # Wait for completion
    print(f"[COMFYUI] Waiting for video generation (timeout: {timeout}s)...")
    history = client.wait_for_completion(prompt_id, timeout=timeout)

    # Get output videos
    videos = client.get_output_videos(history, prompt_id)
    if not videos:
        print("[ERROR] No video output found in ComfyUI history")
        client.dump_history(history, prompt_id)
        return ""

    # Download the first video
    v = videos[0]
    filename = v.get("filename", "unknown")
    subfolder = v.get("subfolder", "")
    vtype = v.get("type", "output")

    os.makedirs(output_dir, exist_ok=True)
    local_path = client.download_video(
        filename=filename,
        subfolder=subfolder,
        vtype=vtype,
        output_dir=output_dir,
    )

    if local_path:
        print(f"[COMFYUI] Video downloaded: {local_path}")
    return local_path


# ──────────────────────────────────────────────────────────────────────────────
# Step 5: Merge Video + Audio (+ optional background music) via ffmpeg
# ──────────────────────────────────────────────────────────────────────────────

def merge_video_audio(
    video_path: str,
    audio_path: str,
    background_music: str = None,
    bg_volume: float = 0.3,
    output_dir: str = OUTPUT_DIR,
) -> str:
    """
    Merge video and audio into a final video file using ffmpeg.

    Optionally mixes in background music at a lower volume.

    Args:
        video_path:       Path to the video file (from ComfyUI).
        audio_path:       Path to the TTS audio file.
        background_music: Optional path to background music file.
        bg_volume:        Volume level for background music (0.0 - 1.0).
        output_dir:       Directory to save the merged output.

    Returns:
        str: Path to the final merged video file.
    """
    # Validate input files
    for label, fpath in [("Video", video_path), ("Audio", audio_path)]:
        if not fpath or not os.path.exists(fpath):
            print(f"[ERROR] {label} file not found: {fpath}")
            return ""
        if os.path.getsize(fpath) == 0:
            print(f"[ERROR] {label} file is empty (0 bytes): {fpath}")
            return ""

    os.makedirs(output_dir, exist_ok=True)
    output_filename = generate_filename("mp4", prefix="final")
    output_path = os.path.join(output_dir, output_filename)

    if background_music and os.path.exists(background_music):
        # Step 5a: Mix TTS audio with background music
        print(f"[MERGE] Mixing audio with background music (volume: {bg_volume})...")
        mixed_audio_path = os.path.join(output_dir, generate_filename("mp3", prefix="mixed"))

        mix_cmd = [
            "ffmpeg", "-y",
            "-stream_loop", "-1",
            "-i", background_music,
            "-i", audio_path,
            "-filter_complex",
            f"[0:a]volume={bg_volume}[bg];[bg][1:a]amix=inputs=2:duration=shortest",
            "-c:a", "libmp3lame",
            mixed_audio_path,
        ]

        print(f"[MERGE] Running: {' '.join(mix_cmd)}")
        result = subprocess.run(mix_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[ERROR] Audio mixing failed: {result.stderr}")
            # Fallback to TTS audio only
            final_audio = audio_path
        else:
            print(f"[MERGE] Mixed audio saved: {mixed_audio_path}")
            final_audio = mixed_audio_path
    else:
        final_audio = audio_path

    # Step 5b: Merge audio into video
    print(f"[MERGE] Merging video + audio...")

    merge_cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", final_audio,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        output_path,
    ]

    print(f"[MERGE] Running: {' '.join(merge_cmd)}")
    result = subprocess.run(merge_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] Video merge failed: {result.stderr}")
        return ""

    duration = get_audio_duration(output_path)
    print(f"[MERGE] Final video saved: {output_path} ({duration:.1f}s)")
    return output_path


# ──────────────────────────────────────────────────────────────────────────────
# Step 6: Generate YouTube Metadata via Groq LLM
# ──────────────────────────────────────────────────────────────────────────────

def generate_youtube_metadata(
    groq_client: Groq,
    description: str,
    audio_script: str = None,
    video_prompt: str = None,
) -> dict:
    """
    Use Groq LLM to generate YouTube title, description, and tags.

    Args:
        groq_client:   Initialized Groq client.
        description:   Product or scene description from the user.
        audio_script:  The TTS script used in the video (for context).
        video_prompt:  The video prompt used (for context).

    Returns:
        dict with keys: title, description, tags (list of str).
    """
    # Detect language from description (simple heuristic)
    is_vietnamese = any(c in description for c in "ắằẳẵặăấầẩẫậâéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ")

    context_parts = [f"Sản phẩm/Chủ đề: {description}" if is_vietnamese else f"Product/Topic: {description}"]
    if audio_script:
        label = "Kịch bản audio" if is_vietnamese else "Audio script"
        context_parts.append(f"{label}: {audio_script[:200]}")
    if video_prompt:
        context_parts.append(f"Video prompt: {video_prompt[:200]}")

    context = "\n".join(context_parts)

    if is_vietnamese:
        system_prompt = (
            "Bạn là chuyên gia YouTube SEO. Dựa vào thông tin về video quảng cáo sản phẩm, "
            "hãy tạo metadata cho video YouTube.\n\n"
            "Trả về ĐÚNG định dạng JSON sau (không giải thích thêm):\n"
            '{"title": "Tiêu đề hấp dẫn (tối đa 100 ký tự)", '
            '"description": "Mô tả chi tiết SEO-friendly (200-500 ký tự, bao gồm hashtag)", '
            '"tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}\n\n'
            "Yêu cầu:\n"
            "- Tiêu đề: ngắn gọn, hấp dẫn, có từ khóa chính\n"
            "- Mô tả: chuyên nghiệp, có hashtag cuối, kêu gọi hành động\n"
            "- Tags: 5-10 từ khóa liên quan, tiếng Việt và tiếng Anh"
        )
    else:
        system_prompt = (
            "You are a YouTube SEO expert. Based on information about a product advertisement video, "
            "generate metadata for the YouTube upload.\n\n"
            "Return EXACTLY this JSON format (no extra explanation):\n"
            '{"title": "Catchy title (max 100 chars)", '
            '"description": "Detailed SEO-friendly description (200-500 chars, include hashtags)", '
            '"tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}\n\n'
            "Requirements:\n"
            "- Title: short, engaging, contains main keyword\n"
            "- Description: professional, include hashtags at end, call to action\n"
            "- Tags: 5-10 relevant keywords"
        )

    print(f"[LLM] Generating YouTube metadata (title, description, tags)...")

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[LLM] Attempt {attempt}/{max_retries}...")
            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": context},
                ],
                temperature=0.7,
                max_completion_tokens=500,
            )

            content = completion.choices[0].message.content
            if content:
                content = content.strip()
                # Extract JSON from response (handle markdown code blocks)
                if "```" in content:
                    # Extract content between code fences
                    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
                    if json_match:
                        content = json_match.group(1).strip()

                metadata = json.loads(content)

                # Validate required keys
                if "title" in metadata and "description" in metadata:
                    if "tags" not in metadata:
                        metadata["tags"] = ["AI", "video", "automation"]
                    elif isinstance(metadata["tags"], str):
                        metadata["tags"] = [t.strip() for t in metadata["tags"].split(",")]

                    print(f"[LLM] YouTube Title: \"{metadata['title']}\"")
                    print(f"[LLM] YouTube Description: \"{metadata['description'][:100]}...\"")
                    print(f"[LLM] YouTube Tags: {metadata['tags']}")
                    return metadata

            print(f"[WARN] LLM returned invalid metadata on attempt {attempt}")

        except json.JSONDecodeError as e:
            print(f"[WARN] Failed to parse JSON on attempt {attempt}: {e}")
        except Exception as e:
            print(f"[WARN] LLM call failed on attempt {attempt}: {e}")

    # Fallback metadata
    fallback = {
        "title": description[:100],
        "description": f"{description}\n\n#AI #video #automation",
        "tags": ["AI", "video", "automation", "product"],
    }
    print(f"[WARN] Using fallback YouTube metadata")
    return fallback


# ──────────────────────────────────────────────────────────────────────────────
# Complete Pipeline
# ──────────────────────────────────────────────────────────────────────────────

def run_pipeline(
    image_path: str,
    description: str,
    duration_seconds: int = 5,
    voice: str = "vi-female",
    background_music: str = None,
    bg_volume: float = 0.3,
    width: int = 1280,
    height: int = 704,
    steps: int = 20,
    cfg: float = 5.0,
    comfyui_host: str = COMFYUI_HOST,
    comfyui_port: int = COMFYUI_PORT,
    output_dir: str = OUTPUT_DIR,
    comfyui_timeout: int = 600,
    audio_script: str = None,
    video_prompt_override: str = None,
    upload_to_youtube: bool = False,
    youtube_title: str = None,
    youtube_description: str = None,
    youtube_tags: list = None,
    youtube_privacy: str = None,
) -> dict:
    """
    Run the complete pipeline: Audio Prompt → Audio → Video Prompt → Video → Merge → YouTube Upload.

    Args:
        image_path:            Path to the input product/scene image.
        description:           Product or scene description.
        duration_seconds:      Target duration in seconds for the final video.
        voice:                 Edge TTS voice key.
        background_music:      Optional background music filename (from music/backgrounds/).
        bg_volume:             Background music volume (0.0 - 1.0).
        width:                 Video width.
        height:                Video height.
        steps:                 ComfyUI sampling steps.
        cfg:                   ComfyUI CFG scale.
        comfyui_host:          ComfyUI server host.
        comfyui_port:          ComfyUI server port.
        output_dir:            Output directory for all generated files.
        comfyui_timeout:       Max seconds to wait for ComfyUI video generation.
        audio_script:          Optional pre-written audio script (skip LLM generation).
        video_prompt_override: Optional pre-written video prompt (skip LLM generation).
        upload_to_youtube:     If True, upload final video to YouTube after merge.
        youtube_title:         Optional YouTube video title (default: description).
        youtube_description:   Optional YouTube video description.
        youtube_tags:          Optional list of YouTube tags.
        youtube_privacy:       Optional privacy status (public/private/unlisted).

    Returns:
        dict with keys:
            - audio_script:  The TTS script text
            - audio_path:    Path to generated audio
            - video_prompt:  The video generation prompt
            - video_path:    Path to generated video (from ComfyUI)
            - final_path:    Path to final merged video
            - duration:      Actual duration of final video
            - youtube_url:   YouTube video URL (if uploaded)
    """
    os.makedirs(output_dir, exist_ok=True)

    # Validate image exists
    if not os.path.exists(image_path):
        print(f"[ERROR] Image not found: {image_path}")
        sys.exit(1)

    groq_client = Groq(api_key=GROQ_API_KEY)

    result = {
        "audio_script": None,
        "audio_path": None,
        "video_prompt": None,
        "video_path": None,
        "final_path": None,
        "duration": 0.0,
        "youtube_url": None,
    }

    print(f"\n{'#'*60}")
    print(f"  🎬 Video Production Pipeline")
    print(f"{'#'*60}")
    print(f"  Image:       {image_path}")
    print(f"  Description: {description}")
    print(f"  Duration:    {duration_seconds}s")
    print(f"  Voice:       {voice}")
    print(f"  Resolution:  {width}x{height}")
    if background_music:
        print(f"  Background:  {background_music}")
    print(f"  Output:      {output_dir}/")
    print(f"{'#'*60}")

    # ── Step 1: Generate Audio Script ─────────────────────────────────────
    print_step(1, "Generate Audio Script (Groq LLM)")

    if audio_script:
        print(f"[SKIP] Using provided audio script: \"{audio_script[:100]}...\"")
        script = audio_script
    else:
        script = generate_audio_prompt(
            groq_client=groq_client,
            description=description,
            duration_seconds=duration_seconds,
            voice=voice,
        )
    result["audio_script"] = script

    # ── Step 2: Generate TTS Audio ────────────────────────────────────────
    print_step(2, "Generate TTS Audio (Edge TTS)")

    audio_path = generate_tts_audio(
        text=script,
        voice=voice,
        output_dir=output_dir,
    )
    result["audio_path"] = audio_path

    if not audio_path:
        print("[ERROR] Audio generation failed. Cannot proceed.")
        return result

    audio_duration = get_audio_duration(audio_path)
    print(f"[INFO] Actual audio duration: {audio_duration:.1f}s (target: {duration_seconds}s)")

    # ── Step 3: Generate Video Prompt ─────────────────────────────────────
    print_step(3, "Generate Video Prompt (Groq LLM)")

    if video_prompt_override:
        print(f"[SKIP] Using provided video prompt: \"{video_prompt_override[:100]}...\"")
        video_prompt = video_prompt_override
    else:
        video_prompt = generate_video_prompt(
            groq_client=groq_client,
            description=description,
            duration_seconds=duration_seconds,
        )
    result["video_prompt"] = video_prompt

    # ── Step 4: Generate Video (ComfyUI) ──────────────────────────────────
    print_step(4, "Generate Video (ComfyUI Wan2.2)")

    video_path = generate_video_from_image(
        image_path=image_path,
        video_prompt=video_prompt,
        duration_seconds=duration_seconds,
        width=width,
        height=height,
        steps=steps,
        cfg=cfg,
        host=comfyui_host,
        port=comfyui_port,
        output_dir=output_dir,
        timeout=comfyui_timeout,
    )
    result["video_path"] = video_path

    if not video_path:
        print("[ERROR] Video generation failed. Cannot proceed to merge.")
        return result

    # ── Step 5: Merge Video + Audio ───────────────────────────────────────
    print_step(5, "Merge Video + Audio (ffmpeg)")

    # Resolve background music path
    bg_path = None
    if background_music:
        bg_path = os.path.join(BG_DIR, background_music)
        if not os.path.exists(bg_path):
            # Try direct path
            if os.path.exists(background_music):
                bg_path = background_music
            else:
                print(f"[WARN] Background music not found: {bg_path}")
                bg_path = None

    final_path = merge_video_audio(
        video_path=video_path,
        audio_path=audio_path,
        background_music=bg_path,
        bg_volume=bg_volume,
        output_dir=output_dir,
    )
    result["final_path"] = final_path
    result["duration"] = get_audio_duration(final_path) if final_path else 0.0

    # ── Step 6: Upload to YouTube (optional) ──────────────────────────────
    if upload_to_youtube and final_path:
        print_step(6, "Upload to YouTube")

        # Generate metadata via Groq if not provided by user
        if not youtube_title or not youtube_description:
            print(f"[YOUTUBE] Generating metadata via Groq LLM...")
            metadata = generate_youtube_metadata(
                groq_client=groq_client,
                description=description,
                audio_script=script,
                video_prompt=video_prompt,
            )
            yt_title = youtube_title or metadata.get("title", description)
            yt_desc = youtube_description or metadata.get("description", f"Auto-generated video: {description}")
            yt_tags = youtube_tags or metadata.get("tags", ["automation", "AI", "video"])
        else:
            yt_title = youtube_title
            yt_desc = youtube_description
            yt_tags = youtube_tags or ["automation", "AI", "video"]

        try:
            print(f"[YOUTUBE] Authenticating...")
            youtube = get_authenticated_service()

            print(f"[YOUTUBE] Uploading: {final_path}")
            print(f"[YOUTUBE] Title: {yt_title}")
            print(f"[YOUTUBE] Description: {yt_desc[:100]}...")
            print(f"[YOUTUBE] Tags: {yt_tags}")
            print(f"[YOUTUBE] Privacy: {youtube_privacy or 'public'}")

            video_url = upload_video(
                youtube=youtube,
                file_path=final_path,
                title=yt_title,
                description=yt_desc,
                tags=yt_tags,
                privacy_status=youtube_privacy,
            )
            result["youtube_url"] = video_url

            if video_url:
                print(f"[YOUTUBE] ✅ Upload successful: {video_url}")
            else:
                print(f"[YOUTUBE] ❌ Upload failed (no URL returned)")

        except Exception as e:
            print(f"[YOUTUBE] ❌ Upload failed: {e}")
    elif upload_to_youtube and not final_path:
        print(f"\n[YOUTUBE] ⚠️ Skipping YouTube upload: no final video was produced.")

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'#'*60}")
    print(f"  ✅ Pipeline Complete!")
    print(f"{'#'*60}")
    print(f"  Audio Script: \"{script[:80]}...\"")
    print(f"  Audio File:   {audio_path}")
    print(f"  Video Prompt: \"{video_prompt[:80]}...\"")
    print(f"  Video File:   {video_path}")
    print(f"  Final Video:  {final_path}")
    print(f"  Duration:     {result['duration']:.1f}s")
    if result["youtube_url"]:
        print(f"  YouTube URL:  {result['youtube_url']}")
    print(f"{'#'*60}\n")

    return result


# ──────────────────────────────────────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Complete Video Production Pipeline: Audio + Video Generation + Merge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage (Vietnamese, 5 seconds)
  python pipeline.py --image product.jpg --description "Sữa rửa mặt ABC cao cấp"

  # English voice, 10 seconds, with background music
  python pipeline.py --image product.jpg --description "Luxury perfume brand" \\
      --duration 10 --voice en-us-female \\
      --background "Hopeful Freedom - Asher Fulero.mp3"

  # Custom resolution and ComfyUI settings
  python pipeline.py --image product.jpg --description "Smart watch" \\
      --duration 8 --width 832 --height 480 --steps 30 --cfg 6.0

  # Provide your own scripts (skip LLM generation)
  python pipeline.py --image product.jpg --description "Phone" \\
      --audio-script "Buy the amazing phone today!" \\
      --video-prompt "Cinematic slow push-in on a smartphone..."
        """,
    )

    # Required
    parser.add_argument("--image", required=True,
                        help="Path to the input image file")
    parser.add_argument("--description", required=True,
                        help="Product or scene description for prompt generation")

    # Duration & Voice
    parser.add_argument("--duration", type=int, default=5,
                        help="Target duration in seconds (default: 5)")
    parser.add_argument("--voice", default="vi-female",
                        choices=list(EDGE_VOICES.keys()),
                        help="TTS voice (default: vi-female)")

    # Background music
    parser.add_argument("--background", default=None,
                        help="Background music filename (from music/backgrounds/)")
    parser.add_argument("--bg-volume", type=float, default=0.3,
                        help="Background music volume 0.0-1.0 (default: 0.3)")

    # Video parameters
    parser.add_argument("--width", type=int, default=1280,
                        help="Video width (default: 1280)")
    parser.add_argument("--height", type=int, default=704,
                        help="Video height (default: 704)")
    parser.add_argument("--steps", type=int, default=20,
                        help="ComfyUI sampling steps (default: 20)")
    parser.add_argument("--cfg", type=float, default=5.0,
                        help="ComfyUI CFG scale (default: 5.0)")

    # ComfyUI connection
    parser.add_argument("--comfyui-host", default=COMFYUI_HOST,
                        help=f"ComfyUI host (default: {COMFYUI_HOST})")
    parser.add_argument("--comfyui-port", type=int, default=COMFYUI_PORT,
                        help=f"ComfyUI port (default: {COMFYUI_PORT})")
    parser.add_argument("--comfyui-timeout", type=int, default=600,
                        help="Max seconds to wait for ComfyUI (default: 600)")

    # Output
    parser.add_argument("--output-dir", default=OUTPUT_DIR,
                        help=f"Output directory (default: {OUTPUT_DIR})")

    # Override prompts
    parser.add_argument("--audio-script", default=None,
                        help="Pre-written audio script (skip LLM generation)")
    parser.add_argument("--video-prompt", default=None,
                        help="Pre-written video prompt (skip LLM generation)")

    # YouTube upload
    parser.add_argument("--upload-youtube", action="store_true", default=False,
                        help="Upload final video to YouTube after pipeline completes")
    parser.add_argument("--youtube-title", default=None,
                        help="YouTube video title (default: description)")
    parser.add_argument("--youtube-description", default=None,
                        help="YouTube video description")
    parser.add_argument("--youtube-tags", default=None,
                        help="Comma-separated YouTube tags (e.g., 'ai,video,product')")
    parser.add_argument("--youtube-privacy", default=None,
                        choices=["public", "private", "unlisted"],
                        help="YouTube privacy status (default: public)")

    args = parser.parse_args()

    # Parse comma-separated tags
    yt_tags = None
    if args.youtube_tags:
        yt_tags = [t.strip() for t in args.youtube_tags.split(",")]

    run_pipeline(
        image_path=args.image,
        description=args.description,
        duration_seconds=args.duration,
        voice=args.voice,
        background_music=args.background,
        bg_volume=args.bg_volume,
        width=args.width,
        height=args.height,
        steps=args.steps,
        cfg=args.cfg,
        comfyui_host=args.comfyui_host,
        comfyui_port=args.comfyui_port,
        output_dir=args.output_dir,
        comfyui_timeout=args.comfyui_timeout,
        audio_script=args.audio_script,
        video_prompt_override=args.video_prompt,
        upload_to_youtube=args.upload_youtube,
        youtube_title=args.youtube_title,
        youtube_description=args.youtube_description,
        youtube_tags=yt_tags,
        youtube_privacy=args.youtube_privacy,
    )


if __name__ == "__main__":
    main()
