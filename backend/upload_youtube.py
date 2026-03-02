import os
import logging
from pathlib import Path

import google_auth_oauthlib.flow
import googleapiclient.discovery
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError

# ================= CONFIG =================
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
PRIVACY_STATUS = "public"   # public | private | unlisted
CATEGORY_ID = "22"
# ==========================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


def get_authenticated_service():
    creds = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logging.info("Refreshing access token...")
            creds.refresh(Request())
        else:
            logging.info("First time authentication required.")
            flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(
                "client_secret_423544055327-tj2t94kgbi8utnnap33p0i6lsk550slb.apps.googleusercontent.com.json", SCOPES
            )
            creds = flow.run_local_server(port=8080)  # run_console removed in newer versions

        with open("token.json", "w") as token:
            token.write(creds.to_json())

    youtube = googleapiclient.discovery.build(
        "youtube", "v3", credentials=creds
    )

    return youtube


def upload_video(youtube, file_path, title=None, description=None, tags=None, privacy_status=None):
    """Upload a video to YouTube and return the video URL.

    Args:
        youtube:        Authenticated YouTube API service object.
        file_path:      Path to the video file.
        title:          Video title (default: filename stem).
        description:    Video description (default: auto-generated).
        tags:           List of tags (default: ["automation", "python", "youtube"]).
        privacy_status: Privacy status (default: PRIVACY_STATUS constant).

    Returns:
        str: YouTube video URL, or empty string on failure.
    """
    file_path = Path(file_path)

    if not file_path.exists():
        logging.error(f"File not found: {file_path}")
        return ""

    title = title or file_path.stem
    description = description or f"Auto uploaded video: {title}"
    tags = tags or ["automation", "python", "youtube"]
    privacy_status = privacy_status or PRIVACY_STATUS

    request_body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": CATEGORY_ID
        },
        "status": {
            "privacyStatus": privacy_status
        }
    }

    media = MediaFileUpload(str(file_path), chunksize=-1, resumable=True)

    request = youtube.videos().insert(
        part="snippet,status",
        body=request_body,
        media_body=media
    )

    logging.info(f"Uploading: {file_path.name}")

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            logging.info(f"Progress: {int(status.progress() * 100)}%")

    video_url = f"https://www.youtube.com/watch?v={response['id']}"
    logging.info(f"Upload complete: {video_url}")
    return video_url


def main():
    youtube = get_authenticated_service()

    video_path = "pipeline_output/final_22adc71727fd_20260301_144552.mp4"

    try:
        upload_video(youtube, video_path)
    except HttpError as e:
        logging.error(f"HTTP Error: {e}")
    except Exception as e:
        logging.error(f"Unexpected error: {e}")


if __name__ == "__main__":
    main()