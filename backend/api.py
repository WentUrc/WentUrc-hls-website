from __future__ import annotations
from quart import Blueprint, jsonify, current_app  # type: ignore
from .config import Config
from .services.video import scan_and_convert_videos
from .services.music import scan_and_convert_music


bp = Blueprint('api', __name__)


def get_cfg() -> Config:
    return current_app.config['APP_CONFIG']


@bp.get('/health')
async def health():
    return jsonify({'status': 'ok'})


@bp.get('/video/playlist')
async def get_video_playlist():
    cfg = get_cfg()
    try:
        text = cfg.VIDEO_PLAYLIST_FILE.read_text(encoding='utf-8')
        # Validate JSON to avoid propagating corrupt files
        import json as _json
        data = _json.loads(text)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify([])
    except Exception as e:  # pragma: no cover
        current_app.logger.exception("read video playlist failed: %s", e)
        return jsonify([])


@bp.post('/scan/video')
async def scan_video():
    cfg = get_cfg()
    lines: list[str] = []

    def log(line: str):
        lines.append(line)
        current_app.logger.info(line)

    result = await scan_and_convert_videos(cfg, log=log)
    return jsonify({'result': result, 'logs': lines[-200:]})


@bp.get('/music/playlist')
async def get_music_playlist():
    cfg = get_cfg()
    try:
        text = cfg.MUSIC_PLAYLIST_FILE.read_text(encoding='utf-8')
        import json as _json
        data = _json.loads(text)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify([])
    except Exception as e:  # pragma: no cover
        current_app.logger.exception("read music playlist failed: %s", e)
        return jsonify([])


@bp.post('/scan/music')
async def scan_music():
    cfg = get_cfg()
    lines: list[str] = []

    def log(line: str):
        lines.append(line)
        current_app.logger.info(line)

    result = await scan_and_convert_music(cfg, log=log)
    return jsonify({'result': result, 'logs': lines[-200:]})
