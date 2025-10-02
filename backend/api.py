from __future__ import annotations
from quart import Blueprint, jsonify, current_app  # type: ignore
import time
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
    app = current_app
    lock = app.scan_locks['video']
    now = time.time()
    last = app.scan_last.get('video', 0.0)
    debounce = app.config.get('SCAN_DEBOUNCE_SECONDS', 10)

    # 正在运行
    if lock.locked():
        return jsonify({'error': 'video scan is already running'}), 409
    # 防抖
    if last and (now - last) < debounce:
        wait_sec = max(0, int(debounce - (now - last)))
        return jsonify({'error': f'video scan debounced, retry in ~{wait_sec}s'}), 429
    lines: list[str] = []

    def log(line: str):
        lines.append(line)
        current_app.logger.info(line)

    async with lock:
        app.scan_last['video'] = time.time()
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
    app = current_app
    lock = app.scan_locks['music']
    now = time.time()
    last = app.scan_last.get('music', 0.0)
    debounce = app.config.get('SCAN_DEBOUNCE_SECONDS', 10)

    # 正在运行
    if lock.locked():
        return jsonify({'error': 'music scan is already running'}), 409
    # 防抖
    if last and (now - last) < debounce:
        wait_sec = max(0, int(debounce - (now - last)))
        return jsonify({'error': f'music scan debounced, retry in ~{wait_sec}s'}), 429
    lines: list[str] = []

    def log(line: str):
        lines.append(line)
        current_app.logger.info(line)

    async with lock:
        app.scan_last['music'] = time.time()
        result = await scan_and_convert_music(cfg, log=log)
    return jsonify({'result': result, 'logs': lines[-200:]})
