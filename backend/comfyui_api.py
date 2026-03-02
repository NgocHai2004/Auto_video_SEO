"""
ComfyUI API Client for Wan2.2 Image-to-Video Generation

This script builds a workflow prompt and sends it to the ComfyUI API
to generate videos from images using the Wan2.2 ti2v model.

Usage:
    python comfyui_api.py --image path/to/image.jpg --prompt "your prompt text"

Requirements:
    pip install requests websocket-client
"""

import json
import uuid
import urllib.request
import urllib.parse
import argparse
import os
import sys
import time
from pathlib import Path

try:
    import websocket
except ImportError:
    websocket = None


# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

COMFYUI_HOST = "192.168.22.24"
COMFYUI_PORT = 8188

DEFAULT_POSITIVE_PROMPT = (
    "Ultra cinematic beauty product commercial of a facial cleanser bottle standing on a wet marble surface. "
    "Soft golden morning light, luxury skincare advertisement, shallow depth of field, 85mm lens, slow camera push-in, "
    "water droplets splashing gently around the bottle, creamy foam texture swirling in slow motion, "
    "high-end cosmetics branding style, clean and minimal background, elegant atmosphere, "
    "volumetric lighting, soft reflections, glossy highlights, 4K, professional studio commercial, "
    "smooth motion, premium aesthetic, advertising film quality"
)

DEFAULT_NEGATIVE_PROMPT = (
    "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，"
    "JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，"
    "形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"
)


# ──────────────────────────────────────────────────────────────────────────────
# Workflow Builder
# ──────────────────────────────────────────────────────────────────────────────

def build_workflow(
    image_name: str,
    positive_prompt: str = DEFAULT_POSITIVE_PROMPT,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
    width: int = 1280,
    height: int = 704,
    length: int = 121,
    steps: int = 20,
    cfg: float = 5.0,
    seed: int = None,
    sampler_name: str = "uni_pc",
    scheduler: str = "simple",
    denoise: float = 1.0,
    shift: float = 8.0,
    fps: int = 24,
    filename_prefix: str = "video/ComfyUI",
    unet_name: str = "wan2.2_ti2v_5B_fp16.safetensors",
    clip_name: str = "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    vae_name: str = "wan2.2_vae.safetensors",
) -> dict:
    """
    Build a ComfyUI API workflow prompt for Wan2.2 Image-to-Video generation.

    Args:
        image_name:       Name of the image uploaded to ComfyUI (via /upload/image).
        positive_prompt:  Positive text prompt describing the desired video.
        negative_prompt:  Negative text prompt for things to avoid.
        width:            Output video width in pixels.
        height:           Output video height in pixels.
        length:           Number of frames to generate (121 = ~5s at 24fps).
        steps:            Number of sampling steps.
        cfg:              Classifier-free guidance scale.
        seed:             Random seed (None = random).
        sampler_name:     Sampler algorithm name.
        scheduler:        Scheduler type.
        denoise:          Denoise strength (1.0 for full generation).
        shift:            ModelSamplingSD3 shift parameter.
        fps:              Output video frames per second.
        filename_prefix:  Prefix for saved video files.
        unet_name:        UNET model filename.
        clip_name:        CLIP model filename.
        vae_name:         VAE model filename.

    Returns:
        dict: The complete workflow prompt ready to send to ComfyUI API.
    """
    if seed is None:
        import random
        seed = random.randint(0, 2**53 - 1)

    workflow = {
        # ── KSampler ──────────────────────────────────────────────────────
        "3": {
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": sampler_name,
                "scheduler": scheduler,
                "denoise": denoise,
                "model": ["48", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["55", 0],
            },
            "class_type": "KSampler",
            "_meta": {"title": "KSampler"},
        },
        # ── Positive Prompt ───────────────────────────────────────────────
        "6": {
            "inputs": {
                "text": positive_prompt,
                "clip": ["38", 0],
            },
            "class_type": "CLIPTextEncode",
            "_meta": {"title": "CLIP Text Encode (Positive Prompt)"},
        },
        # ── Negative Prompt ───────────────────────────────────────────────
        "7": {
            "inputs": {
                "text": negative_prompt,
                "clip": ["38", 0],
            },
            "class_type": "CLIPTextEncode",
            "_meta": {"title": "CLIP Text Encode (Negative Prompt)"},
        },
        # ── VAE Decode ────────────────────────────────────────────────────
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["39", 0],
            },
            "class_type": "VAEDecode",
            "_meta": {"title": "VAE Decode"},
        },
        # ── Load Diffusion Model (UNET) ──────────────────────────────────
        "37": {
            "inputs": {
                "unet_name": unet_name,
                "weight_dtype": "default",
            },
            "class_type": "UNETLoader",
            "_meta": {"title": "Load Diffusion Model"},
        },
        # ── Load CLIP ─────────────────────────────────────────────────────
        "38": {
            "inputs": {
                "clip_name": clip_name,
                "type": "wan",
                "device": "default",
            },
            "class_type": "CLIPLoader",
            "_meta": {"title": "Load CLIP"},
        },
        # ── Load VAE ──────────────────────────────────────────────────────
        "39": {
            "inputs": {
                "vae_name": vae_name,
            },
            "class_type": "VAELoader",
            "_meta": {"title": "Load VAE"},
        },
        # ── ModelSamplingSD3 ──────────────────────────────────────────────
        "48": {
            "inputs": {
                "shift": shift,
                "model": ["37", 0],
            },
            "class_type": "ModelSamplingSD3",
            "_meta": {"title": "ModelSamplingSD3"},
        },
        # ── Image to Video Latent ─────────────────────────────────────────
        "55": {
            "inputs": {
                "width": width,
                "height": height,
                "length": length,
                "batch_size": 1,
                "vae": ["39", 0],
                "start_image": ["56", 0],
            },
            "class_type": "Wan22ImageToVideoLatent",
            "_meta": {"title": "Wan22ImageToVideoLatent"},
        },
        # ── Load Image ────────────────────────────────────────────────────
        "56": {
            "inputs": {
                "image": image_name,
            },
            "class_type": "LoadImage",
            "_meta": {"title": "Load Image"},
        },
        # ── Create Video ──────────────────────────────────────────────────
        "57": {
            "inputs": {
                "fps": fps,
                "images": ["8", 0],
            },
            "class_type": "CreateVideo",
            "_meta": {"title": "Create Video"},
        },
        # ── Save Video ────────────────────────────────────────────────────
        "58": {
            "inputs": {
                "filename_prefix": filename_prefix,
                "format": "auto",
                "codec": "auto",
                "video-preview": "",
                "video": ["57", 0],
            },
            "class_type": "SaveVideo",
            "_meta": {"title": "Save Video"},
        },
    }

    return workflow


# ──────────────────────────────────────────────────────────────────────────────
# ComfyUI API Client
# ──────────────────────────────────────────────────────────────────────────────

class ComfyUIClient:
    """Client for interacting with the ComfyUI API."""

    def __init__(self, host: str = COMFYUI_HOST, port: int = COMFYUI_PORT):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.client_id = str(uuid.uuid4())

    def _make_request(self, endpoint: str, data: bytes = None, method: str = "GET",
                      content_type: str = "application/json") -> dict:
        """Make an HTTP request to the ComfyUI API."""
        url = f"{self.base_url}/{endpoint}"
        req = urllib.request.Request(url, data=data, method=method)
        if data and content_type:
            req.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as e:
            print(f"[ERROR] Failed to connect to ComfyUI at {self.base_url}: {e}")
            print("        Make sure ComfyUI is running and accessible.")
            sys.exit(1)

    def upload_image(self, image_path: str, subfolder: str = "", overwrite: bool = True) -> str:
        """
        Upload an image to ComfyUI's input directory.

        Args:
            image_path:  Local path to the image file.
            subfolder:   Optional subfolder within ComfyUI's input directory.
            overwrite:   Whether to overwrite existing files.

        Returns:
            str: The filename as stored by ComfyUI (use this in the workflow).
        """
        image_path = Path(image_path)
        if not image_path.exists():
            print(f"[ERROR] Image file not found: {image_path}")
            sys.exit(1)

        # Build multipart form data
        boundary = f"----WebKitFormBoundary{uuid.uuid4().hex[:16]}"
        body = b""

        # Image file field
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="image"; filename="{image_path.name}"\r\n'.encode()
        mime_type = self._get_mime_type(image_path.suffix)
        body += f"Content-Type: {mime_type}\r\n\r\n".encode()
        with open(image_path, "rb") as f:
            body += f.read()
        body += b"\r\n"

        # Overwrite field
        body += f"--{boundary}\r\n".encode()
        body += b'Content-Disposition: form-data; name="overwrite"\r\n\r\n'
        body += b"true\r\n" if overwrite else b"false\r\n"

        # Subfolder field (if provided)
        if subfolder:
            body += f"--{boundary}\r\n".encode()
            body += b'Content-Disposition: form-data; name="subfolder"\r\n\r\n'
            body += f"{subfolder}\r\n".encode()

        body += f"--{boundary}--\r\n".encode()

        url = f"{self.base_url}/upload/image"
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode("utf-8"))
                uploaded_name = result.get("name", image_path.name)
                subfolder_result = result.get("subfolder", "")
                print(f"[OK] Image uploaded: {uploaded_name} (subfolder: {subfolder_result})")
                return uploaded_name
        except urllib.error.URLError as e:
            print(f"[ERROR] Failed to upload image: {e}")
            sys.exit(1)

    def queue_prompt(self, workflow: dict) -> dict:
        """
        Queue a workflow prompt for execution on ComfyUI.

        Args:
            workflow: The workflow dict (from build_workflow).

        Returns:
            dict: Response containing prompt_id and other info.
        """
        payload = {
            "prompt": workflow,
            "client_id": self.client_id,
        }
        data = json.dumps(payload).encode("utf-8")
        result = self._make_request("prompt", data=data, method="POST")
        prompt_id = result.get("prompt_id", "unknown")
        print(f"[OK] Prompt queued: {prompt_id}")
        return result

    def get_history(self, prompt_id: str) -> dict:
        """Get the execution history for a specific prompt."""
        return self._make_request(f"history/{prompt_id}")

    def get_queue(self) -> dict:
        """Get the current queue status."""
        return self._make_request("queue")

    def wait_for_completion(self, prompt_id: str, timeout: int = 600) -> dict:
        """
        Wait for a prompt to finish executing.

        Uses WebSocket if available, otherwise falls back to polling.

        Args:
            prompt_id: The prompt ID returned by queue_prompt.
            timeout:   Maximum seconds to wait.

        Returns:
            dict: The history entry for the completed prompt.
        """
        if websocket is not None:
            return self._wait_websocket(prompt_id, timeout)
        else:
            return self._wait_polling(prompt_id, timeout)

    def _wait_websocket(self, prompt_id: str, timeout: int) -> dict:
        """Wait for completion using WebSocket connection."""
        ws_url = f"ws://{self.host}:{self.port}/ws?clientId={self.client_id}"
        ws = websocket.WebSocket()
        ws.settimeout(timeout)
        ws.connect(ws_url)
        print(f"[WS] Connected, waiting for prompt {prompt_id}...")

        try:
            while True:
                raw = ws.recv()
                if isinstance(raw, str):
                    msg = json.loads(raw)
                    msg_type = msg.get("type", "")
                    data = msg.get("data", {})

                    if msg_type == "progress":
                        value = data.get("value", 0)
                        max_val = data.get("max", 0)
                        if max_val > 0:
                            pct = (value / max_val) * 100
                            print(f"\r[PROGRESS] {value}/{max_val} ({pct:.1f}%)", end="", flush=True)

                    elif msg_type == "executing":
                        node = data.get("node")
                        if node is None and data.get("prompt_id") == prompt_id:
                            print("\n[OK] Execution complete!")
                            break

                    elif msg_type == "execution_error":
                        if data.get("prompt_id") == prompt_id:
                            print(f"\n[ERROR] Execution failed: {data}")
                            break
        finally:
            ws.close()

        return self.get_history(prompt_id)

    def _wait_polling(self, prompt_id: str, timeout: int) -> dict:
        """Wait for completion by polling the history endpoint."""
        print(f"[POLL] Waiting for prompt {prompt_id} (polling every 5s)...")
        print("       TIP: Install websocket-client for real-time progress updates.")
        start = time.time()
        while time.time() - start < timeout:
            history = self.get_history(prompt_id)
            if prompt_id in history:
                entry = history[prompt_id]
                status = entry.get("status", {})
                outputs = entry.get("outputs", {})

                # Check for error
                status_str = status.get("status_str", "")
                if status_str == "error" or "error" in status:
                    print(f"\n[ERROR] Execution failed: {status}")
                    return history

                # Check for completion: status_str == "success", or outputs are populated,
                # or status.completed is True
                is_complete = (
                    status.get("completed", False)
                    or status_str == "success"
                    or (len(outputs) > 0)
                )
                if is_complete:
                    print("\n[OK] Execution complete!")
                    return history

            elapsed = int(time.time() - start)
            print(f"\r[POLL] Waiting... ({elapsed}s elapsed)", end="", flush=True)
            time.sleep(5)

        print(f"\n[TIMEOUT] Prompt did not complete within {timeout}s")
        return {}

    def get_output_videos(self, history: dict, prompt_id: str) -> list:
        """
        Extract output video file info from the execution history.

        Args:
            history:   History dict from get_history or wait_for_completion.
            prompt_id: The prompt ID to look up.

        Returns:
            list: List of dicts with video file information.
        """
        videos = []
        if prompt_id not in history:
            return videos

        outputs = history[prompt_id].get("outputs", {})
        for node_id, node_output in outputs.items():
            # Check all possible output keys that ComfyUI nodes may use
            for key in ("videos", "gifs", "images", "video", "gif"):
                if key in node_output:
                    items = node_output[key]
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict):
                                videos.append(item)
                    elif isinstance(items, dict):
                        videos.append(items)
        return videos

    def dump_history(self, history: dict, prompt_id: str):
        """Print the raw history structure for debugging."""
        if prompt_id not in history:
            print(f"[DEBUG] Prompt {prompt_id} not found in history")
            return
        entry = history[prompt_id]
        outputs = entry.get("outputs", {})
        print(f"\n[DEBUG] History entry keys: {list(entry.keys())}")
        print(f"[DEBUG] Status: {entry.get('status', {})}")
        print(f"[DEBUG] Output node IDs: {list(outputs.keys())}")
        for node_id, node_output in outputs.items():
            print(f"[DEBUG] Node {node_id} output keys: {list(node_output.keys())}")
            for key, val in node_output.items():
                if isinstance(val, list) and len(val) > 0:
                    print(f"[DEBUG]   {key}: {val[:3]}{'...' if len(val) > 3 else ''}")
                else:
                    val_str = str(val)
                    if len(val_str) > 200:
                        val_str = val_str[:200] + "..."
                    print(f"[DEBUG]   {key}: {val_str}")

    def download_video(self, filename: str, subfolder: str = "", vtype: str = "output",
                       output_dir: str = "output") -> str:
        """
        Download a video file from ComfyUI to a local directory.

        Args:
            filename:   The video filename on the ComfyUI server.
            subfolder:  Subfolder on the server (e.g., "video").
            vtype:      Type of output ("output", "temp", "input").
            output_dir: Local directory to save the file.

        Returns:
            str: The local path of the downloaded file.
        """
        os.makedirs(output_dir, exist_ok=True)

        params = urllib.parse.urlencode({
            "filename": filename,
            "subfolder": subfolder,
            "type": vtype,
        })
        url = f"{self.base_url}/view?{params}"

        local_path = os.path.join(output_dir, filename)

        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                with open(local_path, "wb") as f:
                    while True:
                        chunk = response.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)
            print(f"[OK] Downloaded: {local_path}")
            return local_path
        except urllib.error.URLError as e:
            print(f"[ERROR] Failed to download {filename}: {e}")
            return ""

    @staticmethod
    def _get_mime_type(suffix: str) -> str:
        """Get MIME type from file extension."""
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
            ".gif": "image/gif",
        }
        return mime_map.get(suffix.lower(), "application/octet-stream")


# ──────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate video from image using ComfyUI Wan2.2 Image-to-Video",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage with default prompt
  python comfyui_api.py --image photo.jpg

  # Custom prompt (single line)
  python comfyui_api.py --image photo.jpg --prompt "A cat walking in a garden, cinematic, 4K"

  # Multi-line prompt from a text file
  python comfyui_api.py --image photo.jpg --prompt-file my_prompt.txt

  # Custom resolution and frame count
  python comfyui_api.py --image photo.jpg --prompt "Ocean waves" --width 832 --height 480 --length 81

  # Download video to a specific folder
  python comfyui_api.py --image photo.jpg --output-dir ./my_videos

  # Just output the workflow JSON (no execution)
  python comfyui_api.py --image photo.jpg --dry-run
        """,
    )

    # Required arguments
    parser.add_argument("--image", required=True, help="Path to the input image file")

    # Prompt arguments
    parser.add_argument("--prompt", default=None,
                        help="Positive prompt text describing the desired video")
    parser.add_argument("--prompt-file", default=None,
                        help="Path to a text file containing the positive prompt (supports multi-line)")
    parser.add_argument("--negative-prompt", default=DEFAULT_NEGATIVE_PROMPT,
                        help="Negative prompt text (things to avoid)")

    # Video parameters
    parser.add_argument("--width", type=int, default=1280, help="Video width (default: 1280)")
    parser.add_argument("--height", type=int, default=704, help="Video height (default: 704)")
    parser.add_argument("--length", type=int, default=121,
                        help="Number of frames (default: 121, ~5s at 24fps)")
    parser.add_argument("--fps", type=int, default=24, help="Output video FPS (default: 24)")

    # Sampling parameters
    parser.add_argument("--steps", type=int, default=20, help="Sampling steps (default: 20)")
    parser.add_argument("--cfg", type=float, default=5.0, help="CFG scale (default: 5.0)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed (default: random)")
    parser.add_argument("--sampler", default="uni_pc", help="Sampler name (default: uni_pc)")
    parser.add_argument("--scheduler", default="simple", help="Scheduler type (default: simple)")
    parser.add_argument("--shift", type=float, default=8.0,
                        help="ModelSamplingSD3 shift (default: 8.0)")

    # Output
    parser.add_argument("--filename-prefix", default="video/ComfyUI",
                        help="Output filename prefix (default: video/ComfyUI)")
    parser.add_argument("--output-dir", default="output",
                        help="Local directory to download generated videos (default: output)")

    # Connection
    parser.add_argument("--host", default=COMFYUI_HOST, help=f"ComfyUI host (default: {COMFYUI_HOST})")
    parser.add_argument("--port", type=int, default=COMFYUI_PORT,
                        help=f"ComfyUI port (default: {COMFYUI_PORT})")

    # Behavior flags
    parser.add_argument("--dry-run", action="store_true",
                        help="Only print the workflow JSON, don't execute")
    parser.add_argument("--no-wait", action="store_true",
                        help="Queue the prompt but don't wait for completion")
    parser.add_argument("--no-download", action="store_true",
                        help="Don't download the video after generation")
    parser.add_argument("--timeout", type=int, default=600,
                        help="Max seconds to wait for completion (default: 600)")

    args = parser.parse_args()

    # ── Resolve prompt text ───────────────────────────────────────────────
    if args.prompt_file:
        prompt_file = Path(args.prompt_file)
        if not prompt_file.exists():
            print(f"[ERROR] Prompt file not found: {args.prompt_file}")
            sys.exit(1)
        with open(prompt_file, "r", encoding="utf-8") as f:
            positive_prompt = f.read().strip()
        print(f"[INFO] Loaded prompt from file: {args.prompt_file}")
    elif args.prompt:
        positive_prompt = args.prompt
    else:
        positive_prompt = DEFAULT_POSITIVE_PROMPT

    # ── Initialize client ─────────────────────────────────────────────────
    client = ComfyUIClient(host=args.host, port=args.port)

    # ── Upload image ──────────────────────────────────────────────────────
    image_name = os.path.basename(args.image)
    if not args.dry_run:
        print(f"\n{'='*60}")
        print("  ComfyUI Wan2.2 Image-to-Video Generator")
        print(f"{'='*60}\n")
        print(f"[INFO] Uploading image: {args.image}")
        image_name = client.upload_image(args.image)

    # ── Build workflow ────────────────────────────────────────────────────
    workflow = build_workflow(
        image_name=image_name,
        positive_prompt=positive_prompt,
        negative_prompt=args.negative_prompt,
        width=args.width,
        height=args.height,
        length=args.length,
        steps=args.steps,
        cfg=args.cfg,
        seed=args.seed,
        sampler_name=args.sampler,
        scheduler=args.scheduler,
        shift=args.shift,
        fps=args.fps,
        filename_prefix=args.filename_prefix,
    )

    # ── Dry run: just print the JSON ──────────────────────────────────────
    if args.dry_run:
        print(json.dumps({"prompt": workflow}, indent=2))
        return

    # ── Queue the prompt ──────────────────────────────────────────────────
    print(f"\n[INFO] Parameters:")
    print(f"       Resolution: {args.width}x{args.height}")
    print(f"       Frames:     {args.length} ({args.length / args.fps:.1f}s at {args.fps}fps)")
    print(f"       Steps:      {args.steps}")
    print(f"       CFG:        {args.cfg}")
    print(f"       Sampler:    {args.sampler} / {args.scheduler}")
    print(f"       Seed:       {workflow['3']['inputs']['seed']}")
    print()

    result = client.queue_prompt(workflow)
    prompt_id = result.get("prompt_id")

    if not prompt_id:
        print("[ERROR] Failed to get prompt_id from response")
        sys.exit(1)

    # ── Wait for completion ───────────────────────────────────────────────
    if args.no_wait:
        print(f"[INFO] Prompt queued. Check ComfyUI for progress.")
        print(f"       Prompt ID: {prompt_id}")
        return

    print(f"[INFO] Waiting for execution to complete...")
    history = client.wait_for_completion(prompt_id, timeout=args.timeout)

    # ── Show results & download ───────────────────────────────────────────
    videos = client.get_output_videos(history, prompt_id)
    if videos:
        print(f"\n[RESULT] Generated {len(videos)} video(s):")
        downloaded_files = []
        for v in videos:
            filename = v.get("filename", "unknown")
            subfolder = v.get("subfolder", "")
            vtype = v.get("type", "output")
            print(f"         - {subfolder}/{filename}" if subfolder else f"         - {filename}")
            print(f"           View: {client.base_url}/view?filename={urllib.parse.quote(filename)}"
                  f"&subfolder={urllib.parse.quote(subfolder)}&type={vtype}")

            # Download video to local folder
            if not args.no_download:
                local_path = client.download_video(
                    filename=filename,
                    subfolder=subfolder,
                    vtype=vtype,
                    output_dir=args.output_dir,
                )
                if local_path:
                    downloaded_files.append(local_path)

        if downloaded_files:
            print(f"\n[DONE] {len(downloaded_files)} video(s) saved to: {os.path.abspath(args.output_dir)}")
    else:
        print("\n[INFO] No video outputs found in history.")
        client.dump_history(history, prompt_id)
        print("[INFO] Check ComfyUI UI for results.")


# ──────────────────────────────────────────────────────────────────────────────
# Programmatic Usage Example
# ──────────────────────────────────────────────────────────────────────────────

def generate_video(
    image_path: str,
    prompt: str,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT,
    width: int = 1280,
    height: int = 704,
    length: int = 121,
    steps: int = 20,
    cfg: float = 5.0,
    seed: int = None,
    host: str = COMFYUI_HOST,
    port: int = COMFYUI_PORT,
    wait: bool = True,
    timeout: int = 600,
) -> dict:
    """
    High-level function to generate a video from an image.

    This is the simplest way to use this module programmatically:

        from comfyui_api import generate_video

        result = generate_video(
            image_path="my_photo.jpg",
            prompt="A beautiful sunset over the ocean, cinematic, 4K",
        )

    Args:
        image_path:      Path to the local image file.
        prompt:          Positive text prompt.
        negative_prompt: Negative text prompt.
        width:           Video width in pixels.
        height:          Video height in pixels.
        length:          Number of frames.
        steps:           Sampling steps.
        cfg:             CFG guidance scale.
        seed:            Random seed (None for random).
        host:            ComfyUI server host.
        port:            ComfyUI server port.
        wait:            Whether to wait for completion.
        timeout:         Max seconds to wait.

    Returns:
        dict with keys:
            - prompt_id: The queued prompt ID
            - history:   The execution history (if wait=True)
            - videos:    List of output video info dicts (if wait=True)
    """
    client = ComfyUIClient(host=host, port=port)

    # Upload image
    image_name = client.upload_image(image_path)

    # Build and queue workflow
    workflow = build_workflow(
        image_name=image_name,
        positive_prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        length=length,
        steps=steps,
        cfg=cfg,
        seed=seed,
    )

    result = client.queue_prompt(workflow)
    prompt_id = result.get("prompt_id")

    output = {"prompt_id": prompt_id, "history": None, "videos": []}

    if wait and prompt_id:
        history = client.wait_for_completion(prompt_id, timeout=timeout)
        output["history"] = history
        output["videos"] = client.get_output_videos(history, prompt_id)

    return output


if __name__ == "__main__":
    main()
