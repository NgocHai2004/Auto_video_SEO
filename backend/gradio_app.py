import gradio as gr
import requests
import os
import time
import shutil
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pipeline import (
    run_pipeline,
    EDGE_VOICES,
    OUTPUT_DIR,
    BG_DIR,
    COMFYUI_HOST,
    COMFYUI_PORT,
)
from batch_demo import find_pairs, IMAGE_EXTENSIONS

API_URL = "http://localhost:5000"


# ================= LOAD BACKGROUNDS =================
def load_backgrounds():
    """Load available background music files."""
    bg_files = []
    if os.path.exists(BG_DIR):
        bg_files = [f for f in os.listdir(BG_DIR) if f.endswith(".mp3")]
    if not bg_files:
        try:
            r = requests.get(f"{API_URL}/backgrounds", timeout=3)
            if r.status_code == 200:
                bg_files = r.json().get("backgrounds", [])
        except Exception:
            pass
    return bg_files


# ================= GENERATE AUDIO (API) =================
def generate_audio(prompt, voice):
    if not prompt:
        return None

    try:
        r = requests.post(
            f"{API_URL}/tts/edge-groq",
            json={"prompt": prompt, "voice": voice}
        )

        if r.status_code == 200:
            filename = "generated_audio.mp3"
            with open(filename, "wb") as f:
                f.write(r.content)
            return filename
    except Exception as e:
        print(f"[ERROR] Audio generation failed: {e}")

    return None


# ================= MERGE (API) =================
def merge(video_file, audio_file, background):
    if not video_file or not audio_file:
        return None

    try:
        files = {
            "video": open(video_file, "rb"),
            "audio": open(audio_file, "rb")
        }

        data = {"background": background}

        r = requests.post(f"{API_URL}/merge", files=files, data=data)

        if r.status_code == 200:
            output = "merged_output.mp4"
            with open(output, "wb") as f:
                f.write(r.content)
            return output
    except Exception as e:
        print(f"[ERROR] Merge failed: {e}")

    return None


# ================= FULL PIPELINE =================
def run_full_pipeline(
    image_file,
    description,
    duration,
    voice,
    background,
    bg_volume,
    width,
    height,
    steps,
    cfg,
    audio_script_override,
    video_prompt_override,
    upload_youtube,
    youtube_privacy,
    progress=gr.Progress(),
):
    """Run the complete pipeline from Gradio UI."""
    if not image_file:
        return None, None, "❌ Please upload an image.", "", "", ""

    if not description:
        return None, None, "❌ Please provide a product/scene description.", "", "", ""

    progress(0.1, desc="Starting pipeline...")

    try:
        result = run_pipeline(
            image_path=image_file,
            description=description,
            duration_seconds=int(duration),
            voice=voice,
            background_music=background if background else None,
            bg_volume=bg_volume,
            width=int(width),
            height=int(height),
            steps=int(steps),
            cfg=cfg,
            comfyui_host=COMFYUI_HOST,
            comfyui_port=COMFYUI_PORT,
            output_dir=OUTPUT_DIR,
            comfyui_timeout=600,
            audio_script=audio_script_override if audio_script_override else None,
            video_prompt_override=video_prompt_override if video_prompt_override else None,
            upload_to_youtube=upload_youtube,
            youtube_privacy=youtube_privacy if youtube_privacy else None,
        )

        final_video = result.get("final_path") or None
        audio_file = result.get("audio_path") or None
        audio_script = result.get("audio_script") or ""
        video_prompt = result.get("video_prompt") or ""
        duration_actual = result.get("duration", 0)
        youtube_url = result.get("youtube_url") or ""

        # Validate paths exist before returning to Gradio
        if final_video and not os.path.isfile(final_video):
            final_video = None
        if audio_file and not os.path.isfile(audio_file):
            audio_file = None

        status = f"✅ Pipeline complete! Duration: {duration_actual:.1f}s"
        if not final_video:
            status = "⚠️ Pipeline finished but final video was not produced. Check logs."
        if not audio_file:
            status += "\n⚠️ Audio file was not generated properly."
        if youtube_url:
            status += f"\n🎬 YouTube: {youtube_url}"
        elif upload_youtube:
            status += "\n⚠️ YouTube upload was requested but failed."

        return final_video, audio_file, status, audio_script, video_prompt, youtube_url

    except Exception as e:
        return None, None, f"❌ Pipeline error: {str(e)}", "", "", ""


# ================= BATCH PIPELINE =================
def run_batch_pipeline(
    folder_files,
    batch_duration,
    batch_voice,
    batch_background,
    batch_bg_volume,
    batch_width,
    batch_height,
    batch_steps,
    batch_cfg,
    batch_upload_youtube,
    batch_youtube_privacy,
    schedule_time,
    delay_between,
    progress=gr.Progress(),
):
    """Run the batch pipeline from Gradio UI with uploaded folder files."""
    if not folder_files or len(folder_files) == 0:
        return "❌ Please upload image+txt file pairs.", ""

    # ── Handle scheduled start time ───────────────────────────────────────
    if schedule_time and schedule_time.strip():
        try:
            # Use TZ env var for timezone awareness (set in Docker or system)
            tz_name = os.environ.get("TZ")
            try:
                tz = ZoneInfo(tz_name) if tz_name else None
            except (KeyError, TypeError):
                tz = None

            now = datetime.now(tz)
            # Parse HH:MM format
            parts = schedule_time.strip().split(":")
            target_hour = int(parts[0])
            target_minute = int(parts[1]) if len(parts) > 1 else 0

            target_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)

            # If target time already passed today, schedule for tomorrow
            if target_time <= now:
                target_time += timedelta(days=1)

            wait_seconds = (target_time - now).total_seconds()

            if wait_seconds > 0:
                progress(0, desc=f"⏰ Scheduled: waiting until {target_time.strftime('%Y-%m-%d %H:%M %Z')}...")
                print(f"[SCHEDULE] Waiting until {target_time.strftime('%Y-%m-%d %H:%M %Z')} ({wait_seconds:.0f}s)")

                # Wait in small intervals to keep the UI responsive
                waited = 0
                while waited < wait_seconds:
                    chunk = min(10, wait_seconds - waited)
                    time.sleep(chunk)
                    waited += chunk
                    remaining = wait_seconds - waited
                    if remaining > 0:
                        mins_left = int(remaining / 60)
                        secs_left = int(remaining % 60)
                        progress(0, desc=f"⏰ Starting in {mins_left}m {secs_left}s (at {target_time.strftime('%H:%M')})...")

                print(f"[SCHEDULE] Schedule time reached, starting batch pipeline...")

        except (ValueError, IndexError):
            # Invalid time format, start immediately
            print(f"[WARN] Invalid schedule time '{schedule_time}', starting immediately")

    delay_secs = int(delay_between) if delay_between else 0

    # Create temp directory and copy uploaded files
    tmp_dir = tempfile.mkdtemp(prefix="batch_")

    try:
        # Copy uploaded files to temp directory
        for file_path in folder_files:
            filename = os.path.basename(file_path)
            dst = os.path.join(tmp_dir, filename)
            shutil.copy2(file_path, dst)

        # Find pairs in the temp directory
        pairs = find_pairs(tmp_dir)

        if not pairs:
            return (
                "❌ No valid image+description pairs found.\n\n"
                "**Expected format:** For each image, upload a `.txt` file with the same name.\n"
                "- `product1.jpg` + `product1.txt`\n"
                "- `product2.png` + `product2.txt`\n\n"
                f"Files uploaded: {[os.path.basename(f) for f in folder_files]}",
                "",
            )

        total = len(pairs)
        log_lines = []
        log_lines.append(f"📦 Found {total} image+description pairs")
        if delay_secs > 0:
            log_lines.append(f"⏳ Delay between items: {delay_secs}s")
        log_lines.append("")

        for i, pair in enumerate(pairs):
            log_lines.append(f"  {i+1}. **{pair['name']}**: {pair['description'][:60]}...")
        log_lines.append("")

        results = []
        success_count = 0
        fail_count = 0

        for i, pair in enumerate(pairs, 1):
            progress(i / (total + 1), desc=f"Processing {pair['name']} ({i}/{total})...")

            log_lines.append(f"---\n### 🎬 [{i}/{total}] {pair['name']}")
            log_lines.append(f"- Image: `{os.path.basename(pair['image'])}`")
            log_lines.append(f"- Description: {pair['description']}")
            log_lines.append(f"- Started: {datetime.now().strftime('%H:%M:%S')}")

            try:
                result = run_pipeline(
                    image_path=pair["image"],
                    description=pair["description"],
                    duration_seconds=int(batch_duration),
                    voice=batch_voice,
                    background_music=batch_background if batch_background else None,
                    bg_volume=batch_bg_volume,
                    width=int(batch_width),
                    height=int(batch_height),
                    steps=int(batch_steps),
                    cfg=batch_cfg,
                    comfyui_host=COMFYUI_HOST,
                    comfyui_port=COMFYUI_PORT,
                    output_dir=OUTPUT_DIR,
                    comfyui_timeout=600,
                    upload_to_youtube=batch_upload_youtube,
                    youtube_privacy=batch_youtube_privacy if batch_youtube_privacy else None,
                )

                result["name"] = pair["name"]
                results.append(result)

                final_path = result.get("final_path", "")
                duration_actual = result.get("duration", 0)
                youtube_url = result.get("youtube_url", "")

                if final_path:
                    success_count += 1
                    log_lines.append(f"- ✅ Video: `{final_path}` ({duration_actual:.1f}s)")
                    if youtube_url:
                        log_lines.append(f"- 🎬 YouTube: {youtube_url}")
                    elif batch_upload_youtube:
                        log_lines.append(f"- ⚠️ YouTube upload failed")
                else:
                    fail_count += 1
                    log_lines.append(f"- ❌ Pipeline completed but no final video produced")

            except Exception as e:
                fail_count += 1
                log_lines.append(f"- ❌ Error: {str(e)}")
                results.append({"name": pair["name"], "error": str(e)})

            log_lines.append(f"- Finished: {datetime.now().strftime('%H:%M:%S')}")
            log_lines.append("")

            # Delay between items (skip after last)
            if i < total and delay_secs > 0:
                log_lines.append(f"⏳ Waiting {delay_secs}s before next item...")
                progress(i / (total + 1), desc=f"⏳ Waiting {delay_secs}s before next item...")
                time.sleep(delay_secs)

        # Summary
        progress(1.0, desc="Batch complete!")
        log_lines.append(f"---\n## 📊 Summary")
        log_lines.append(f"- **Total:** {total}")
        log_lines.append(f"- **✅ Success:** {success_count}")
        log_lines.append(f"- **❌ Failed:** {fail_count}")
        log_lines.append(f"- **Completed at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        if any(r.get("youtube_url") for r in results):
            log_lines.append(f"\n### 🎬 YouTube Links")
            for r in results:
                yt = r.get("youtube_url", "")
                if yt:
                    log_lines.append(f"- **{r.get('name', '?')}**: {yt}")

        status = f"✅ Batch complete! {success_count}/{total} succeeded"
        if fail_count > 0:
            status += f", {fail_count} failed"

        return status, "\n".join(log_lines)

    except Exception as e:
        return f"❌ Batch pipeline error: {str(e)}", ""

    finally:
        # Clean up temp directory
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


# ================= UI =================
background_list = load_backgrounds()

with gr.Blocks(title="🎬 Video Production Pipeline", theme=gr.themes.Soft()) as demo:
    gr.Markdown("# 🎬 Video Production Pipeline\n### Audio Prompt → TTS Audio → Video Prompt → Video → Merge")

    # ── Tab 1: Full Pipeline ──────────────────────────────────────────────
    with gr.Tab("🚀 Full Pipeline"):
        gr.Markdown("### Complete automated pipeline: from image + description → final video with audio")

        with gr.Row():
            with gr.Column(scale=1):
                pipeline_image = gr.Image(
                    label="📸 Product/Scene Image",
                    type="filepath",
                )
                pipeline_description = gr.Textbox(
                    label="📝 Description",
                    lines=3,
                    placeholder="Sữa rửa mặt ABC cao cấp, làm sạch sâu, dưỡng ẩm tự nhiên...",
                )

                with gr.Row():
                    pipeline_duration = gr.Slider(
                        minimum=3, maximum=30, value=5, step=1,
                        label="⏱️ Duration (seconds)",
                    )
                    pipeline_voice = gr.Dropdown(
                        choices=list(EDGE_VOICES.keys()),
                        value="vi-female",
                        label="🎙️ Voice",
                    )

                with gr.Accordion("🎵 Background Music", open=False):
                    pipeline_background = gr.Dropdown(
                        choices=[""] + background_list,
                        value="",
                        label="Background Music",
                    )
                    pipeline_bg_volume = gr.Slider(
                        minimum=0.0, maximum=1.0, value=0.3, step=0.05,
                        label="Background Volume",
                    )

                with gr.Accordion("⚙️ Advanced Settings", open=False):
                    with gr.Row():
                        pipeline_width = gr.Number(value=1280, label="Width")
                        pipeline_height = gr.Number(value=704, label="Height")
                    with gr.Row():
                        pipeline_steps = gr.Number(value=20, label="Steps")
                        pipeline_cfg = gr.Slider(
                            minimum=1.0, maximum=15.0, value=5.0, step=0.5,
                            label="CFG Scale",
                        )

                with gr.Accordion("✏️ Override Prompts (Optional)", open=False):
                    pipeline_audio_script = gr.Textbox(
                        label="Custom Audio Script",
                        lines=2,
                        placeholder="Leave empty to auto-generate via LLM...",
                    )
                    pipeline_video_prompt = gr.Textbox(
                        label="Custom Video Prompt",
                        lines=3,
                        placeholder="Leave empty to auto-generate via LLM...",
                    )

                with gr.Accordion("📺 YouTube Upload", open=False):
                    pipeline_upload_youtube = gr.Checkbox(
                        label="🚀 Upload to YouTube after pipeline completes",
                        value=False,
                    )
                    pipeline_youtube_privacy = gr.Dropdown(
                        choices=["public", "private", "unlisted"],
                        value="public",
                        label="Privacy Status",
                    )
                    gr.Markdown(
                        "💡 *Title, description & tags are auto-generated by Groq AI. "
                        "First-time use requires OAuth authentication.*"
                    )

                pipeline_btn = gr.Button("🎬 Run Pipeline", variant="primary", size="lg")

            with gr.Column(scale=1):
                pipeline_status = gr.Textbox(label="📊 Status", interactive=False)
                pipeline_video_output = gr.Video(label="🎥 Final Video")
                pipeline_audio_output = gr.Audio(label="🔊 Generated Audio")

                with gr.Accordion("📋 Generated Prompts", open=True):
                    pipeline_gen_audio_script = gr.Textbox(
                        label="Generated Audio Script",
                        interactive=False,
                        lines=3,
                    )
                    pipeline_gen_video_prompt = gr.Textbox(
                        label="Generated Video Prompt",
                        interactive=False,
                        lines=4,
                    )
                    pipeline_youtube_url = gr.Textbox(
                        label="🔗 YouTube URL",
                        interactive=False,
                        lines=1,
                    )

        pipeline_btn.click(
            run_full_pipeline,
            inputs=[
                pipeline_image,
                pipeline_description,
                pipeline_duration,
                pipeline_voice,
                pipeline_background,
                pipeline_bg_volume,
                pipeline_width,
                pipeline_height,
                pipeline_steps,
                pipeline_cfg,
                pipeline_audio_script,
                pipeline_video_prompt,
                pipeline_upload_youtube,
                pipeline_youtube_privacy,
            ],
            outputs=[
                pipeline_video_output,
                pipeline_audio_output,
                pipeline_status,
                pipeline_gen_audio_script,
                pipeline_gen_video_prompt,
                pipeline_youtube_url,
            ],
        )

    # ── Tab 2: Generate Audio Only ────────────────────────────────────────
    with gr.Tab("🎙️ Generate Audio"):
        gr.Markdown("### Generate audio from prompt via Groq LLM + Edge TTS")

        prompt = gr.Textbox(
            label="Prompt",
            lines=3,
            placeholder="Quảng cáo máy giặt Kangaroo trong 5 giây...",
        )

        voice = gr.Dropdown(
            list(EDGE_VOICES.keys()),
            value="vi-female",
            label="Voice",
        )

        btn = gr.Button("Generate Audio", variant="primary")
        audio_output = gr.Audio()

        btn.click(generate_audio, inputs=[prompt, voice], outputs=audio_output)

    # ── Tab 3: Merge Audio + Video ────────────────────────────────────────
    with gr.Tab("🎬 Merge Audio + Video"):
        gr.Markdown("### Merge uploaded video and audio files")

        video_input = gr.File(label="Upload Video (.mp4)")
        audio_input = gr.File(label="Upload Audio (.mp3)")

        background = gr.Dropdown(
            [""] + background_list,
            value="",
            label="Background Music (Optional)",
        )

        merge_btn = gr.Button("Merge", variant="primary")
        video_output = gr.Video()

        merge_btn.click(
            merge,
            inputs=[video_input, audio_input, background],
            outputs=video_output,
        )

    # ── Tab 4: Batch Pipeline ─────────────────────────────────────────────
    with gr.Tab("📦 Batch Pipeline"):
        gr.Markdown(
            "### Batch auto-generate videos from a folder of image+description pairs\n"
            "Upload multiple image files (`.jpg`, `.png`, `.webp`) with matching `.txt` description files.\n"
            "Example: `anh1.jpg` + `anh1.txt`, `anh2.jpg` + `anh2.txt`"
        )

        with gr.Row():
            with gr.Column(scale=1):
                batch_folder_files = gr.File(
                    label="📁 Upload Image + TXT pairs",
                    file_count="multiple",
                    file_types=[".jpg", ".jpeg", ".png", ".webp", ".bmp", ".txt"],
                )

                gr.Markdown(
                    "💡 *Upload image files and their matching `.txt` files together. "
                    "Each `.txt` file should have the same name as its image and contain the product description.*"
                )

                with gr.Row():
                    batch_duration = gr.Slider(
                        minimum=3, maximum=30, value=5, step=1,
                        label="⏱️ Duration (seconds)",
                    )
                    batch_voice = gr.Dropdown(
                        choices=list(EDGE_VOICES.keys()),
                        value="vi-female",
                        label="🎙️ Voice",
                    )

                with gr.Accordion("🎵 Background Music", open=False):
                    batch_background = gr.Dropdown(
                        choices=[""] + background_list,
                        value="",
                        label="Background Music",
                    )
                    batch_bg_volume = gr.Slider(
                        minimum=0.0, maximum=1.0, value=0.3, step=0.05,
                        label="Background Volume",
                    )

                with gr.Accordion("⚙️ Advanced Settings", open=False):
                    with gr.Row():
                        batch_width = gr.Number(value=1280, label="Width")
                        batch_height = gr.Number(value=704, label="Height")
                    with gr.Row():
                        batch_steps = gr.Number(value=20, label="Steps")
                        batch_cfg = gr.Slider(
                            minimum=1.0, maximum=15.0, value=5.0, step=0.5,
                            label="CFG Scale",
                        )

                with gr.Accordion("📺 YouTube Upload", open=False):
                    batch_upload_youtube = gr.Checkbox(
                        label="🚀 Upload each video to YouTube",
                        value=False,
                    )
                    batch_youtube_privacy = gr.Dropdown(
                        choices=["public", "private", "unlisted"],
                        value="public",
                        label="Privacy Status",
                    )
                    gr.Markdown(
                        "💡 *Title, description & tags are auto-generated by Groq AI for each video.*"
                    )

                with gr.Accordion("📅 Scheduling", open=False):
                    batch_schedule_time = gr.Textbox(
                        label="⏰ Schedule Start Time (HH:MM)",
                        placeholder="e.g., 21:00 — Leave empty to start immediately",
                        value="",
                    )
                    batch_delay = gr.Slider(
                        minimum=0, maximum=3600, value=0, step=10,
                        label="⏳ Delay between items (seconds)",
                    )
                    gr.Markdown(
                        "💡 *Set a start time to schedule the batch (24h format, e.g., `21:00`). "
                        "Delay adds a pause between processing each image pair.*"
                    )

                batch_btn = gr.Button("📦 Run Batch Pipeline", variant="primary", size="lg")

            with gr.Column(scale=1):
                batch_status = gr.Textbox(label="📊 Status", interactive=False)
                batch_log = gr.Markdown(label="📋 Processing Log")

        batch_btn.click(
            run_batch_pipeline,
            inputs=[
                batch_folder_files,
                batch_duration,
                batch_voice,
                batch_background,
                batch_bg_volume,
                batch_width,
                batch_height,
                batch_steps,
                batch_cfg,
                batch_upload_youtube,
                batch_youtube_privacy,
                batch_schedule_time,
                batch_delay,
            ],
            outputs=[
                batch_status,
                batch_log,
            ],
        )

demo.launch(server_port=7860, share=True)
