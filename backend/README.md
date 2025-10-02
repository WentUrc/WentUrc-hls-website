# Backend (Quart)

Minimal backend service to manage HLS conversion and playlists.

## Setup

1. Create and activate a virtual environment (optional but recommended)
2. Install dependencies

```bash
pip install -r backend/requirements.txt
```

## Run

```bash
python -m backend.app
# or
python backend/app.py
```

## API

- GET /api/health
- GET /api/video/playlist
- POST /api/scan/video
- GET /api/music/playlist
- POST /api/scan/music

Environment variables (optional):
- VIDEO_UPLOAD_DIR, VIDEO_HLS_DIR, VIDEO_PLAYLIST_FILE
- VIDEO_HLS_PUBLIC_PREFIX, VIDEO_ORIG_PUBLIC_PREFIX
- MUSIC_UPLOAD_DIR, MUSIC_HLS_DIR, MUSIC_PLAYLIST_FILE
- MUSIC_HLS_PUBLIC_PREFIX, MUSIC_ORIG_PUBLIC_PREFIX
- FFMPEG_TIMEOUT_SECONDS, FFMPEG_LOGLEVEL, STRATEGY (auto|copy|transcode), FORCE_REENCODE (0/1), VERBOSE (0/1)
