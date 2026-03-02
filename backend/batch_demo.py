"""
Batch Video Pipeline: Auto-process all image+description pairs in a folder.

Scans the target folder (default: test_demo/) for image files (.jpg, .png, .webp)
paired with a .txt file containing the description (same name, e.g., anh1.jpg + anh1.txt).

For each pair, runs the full pipeline:
  1. Generate audio script (Groq LLM)
  2. Generate TTS audio (Edge TTS)
  3. Generate video prompt (Groq LLM)
  4. Generate video (ComfyUI Wan2.2)
  5. Merge video + audio (ffmpeg)
  6. Upload to YouTube (optional)

Usage:
    # Process all pairs in test_demo/ (no YouTube upload)
    python batch_demo.py

    # Process with YouTube upload
    python batch_demo.py --upload-youtube

    # Custom folder, duration, voice
    python batch_demo.py --folder my_products --duration 8 --voice en-us-female

    # With background music
    python batch_demo.py --upload-youtube --background "Hopeful Freedom - Asher Fulero.mp3"
"""

import argparse
import glob
import os
import sys
import time

from pipeline import run_pipeline, EDGE_VOICES, OUTPUT_DIR, COMFYUI_HOST, COMFYUI_PORT

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")


def find_pairs(folder: str) -> list:
    """
    Find image + description text file pairs in a folder.

    For each image file, looks for a .txt file with the same stem name.
    E.g., anh1.jpg → anh1.txt

    Returns:
        list of dicts: [{"image": "path/to/img.jpg", "description": "text content", "name": "anh1"}, ...]
    """
    pairs = []

    if not os.path.isdir(folder):
        print(f"[ERROR] Folder not found: {folder}")
        return pairs

    # Find all image files
    files = sorted(os.listdir(folder))
    image_files = [f for f in files if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS]

    for img_file in image_files:
        stem = os.path.splitext(img_file)[0]
        txt_file = os.path.join(folder, f"{stem}.txt")
        img_path = os.path.join(folder, img_file)

        if os.path.exists(txt_file):
            with open(txt_file, "r", encoding="utf-8") as f:
                description = f.read().strip()

            if description:
                pairs.append({
                    "image": img_path,
                    "description": description,
                    "name": stem,
                })
            else:
                print(f"[WARN] Empty description file, skipping: {txt_file}")
        else:
            print(f"[WARN] No description file found for {img_file}, skipping (expected: {stem}.txt)")

    return pairs


def main():
    parser = argparse.ArgumentParser(
        description="Batch Video Pipeline: Auto-process image+description pairs in a folder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all pairs in test_demo/
  python batch_demo.py

  # Process with YouTube upload
  python batch_demo.py --upload-youtube

  # Custom folder and settings
  python batch_demo.py --folder my_products --duration 8 --voice en-us-female

  # With background music and YouTube upload
  python batch_demo.py --upload-youtube --youtube-privacy unlisted \\
      --background "Hopeful Freedom - Asher Fulero.mp3"
        """,
    )

    # Folder
    parser.add_argument("--folder", default="test_demo",
                        help="Folder containing image+txt pairs (default: test_demo)")

    # Pipeline settings
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

    # YouTube upload
    parser.add_argument("--upload-youtube", action="store_true", default=False,
                        help="Upload each final video to YouTube")
    parser.add_argument("--youtube-privacy", default=None,
                        choices=["public", "private", "unlisted"],
                        help="YouTube privacy status (default: public)")

    # Delay between items
    parser.add_argument("--delay", type=int, default=5,
                        help="Delay in seconds between processing each pair (default: 5)")

    args = parser.parse_args()

    # Find all pairs
    pairs = find_pairs(args.folder)

    if not pairs:
        print(f"[ERROR] No image+description pairs found in '{args.folder}/'")
        print(f"        Expected format: image.jpg + image.txt in the same folder")
        sys.exit(1)

    total = len(pairs)
    print(f"\n{'#'*60}")
    print(f"  📦 Batch Video Pipeline")
    print(f"{'#'*60}")
    print(f"  Folder:     {args.folder}/")
    print(f"  Pairs found: {total}")
    for i, pair in enumerate(pairs, 1):
        print(f"    {i}. {pair['name']}: \"{pair['description'][:60]}...\"")
    print(f"  Duration:   {args.duration}s")
    print(f"  Voice:      {args.voice}")
    print(f"  YouTube:    {'✅ Enabled' if args.upload_youtube else '❌ Disabled'}")
    if args.upload_youtube:
        print(f"  Privacy:    {args.youtube_privacy or 'public'}")
    print(f"  Output:     {args.output_dir}/")
    print(f"{'#'*60}\n")

    # Process each pair
    results = []
    success_count = 0
    fail_count = 0

    for i, pair in enumerate(pairs, 1):
        print(f"\n{'='*60}")
        print(f"  🎬 Processing {i}/{total}: {pair['name']}")
        print(f"     Image:       {pair['image']}")
        print(f"     Description: {pair['description']}")
        print(f"{'='*60}\n")

        try:
            result = run_pipeline(
                image_path=pair["image"],
                description=pair["description"],
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
                upload_to_youtube=args.upload_youtube,
                youtube_privacy=args.youtube_privacy,
            )

            result["name"] = pair["name"]
            results.append(result)

            if result.get("final_path"):
                success_count += 1
            else:
                fail_count += 1

        except Exception as e:
            print(f"[ERROR] Failed to process {pair['name']}: {e}")
            results.append({"name": pair["name"], "error": str(e)})
            fail_count += 1

        # Delay between items (skip after last)
        if i < total and args.delay > 0:
            print(f"\n[WAIT] Waiting {args.delay}s before next item...")
            time.sleep(args.delay)

    # ── Final Summary ─────────────────────────────────────────────────────
    print(f"\n{'#'*60}")
    print(f"  📊 Batch Pipeline Summary")
    print(f"{'#'*60}")
    print(f"  Total:     {total}")
    print(f"  ✅ Success: {success_count}")
    print(f"  ❌ Failed:  {fail_count}")
    print(f"{'─'*60}")

    for r in results:
        name = r.get("name", "?")
        if r.get("error"):
            print(f"  ❌ {name}: ERROR - {r['error']}")
        elif r.get("final_path"):
            yt = r.get("youtube_url", "")
            duration = r.get("duration", 0)
            print(f"  ✅ {name}: {r['final_path']} ({duration:.1f}s)")
            if yt:
                print(f"     🎬 YouTube: {yt}")
        else:
            print(f"  ⚠️ {name}: Pipeline completed but no final video")

    print(f"{'#'*60}\n")


if __name__ == "__main__":
    main()
