# Backend - Video Pipeline API

Backend service for video generation pipeline with TTS, ComfyUI integration, and YouTube upload.

## Features

- Text-to-Speech (TTS) with Edge TTS
- Video generation via ComfyUI API
- Background music mixing
- YouTube upload integration
- Batch processing support

## Requirements

- Python 3.10+
- FFmpeg
- ComfyUI server running

## Installation

```bash
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file with:

```env
COMFYUI_URL=http://localhost:8188
```

## Running

### Development

```bash
python main.py
```

### With Docker

```bash
docker-compose up --build
```

## API Endpoints

- `POST /pipeline/run` - Run single video pipeline
- `POST /batch/run` - Run batch processing
- `GET /batch/status/{batch_id}` - Get batch status
- `GET /backgrounds` - List background music files

## Project Structure

```
backend/
├── main.py           # FastAPI application
├── pipeline.py       # Pipeline logic
├── comfyui_api.py    # ComfyUI integration
├── gradio_app.py     # Gradio interface (optional)
├── batch_demo.py     # Batch processing demo
├── upload_youtube.py # YouTube upload
├── requirements.txt  # Python dependencies
├── Dockerfile.backend
├── docker-compose.yml
└── music/           # Background music files
    └── backgrounds/
```
