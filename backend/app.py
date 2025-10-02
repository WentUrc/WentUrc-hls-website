from __future__ import annotations

from quart import Quart, send_from_directory, websocket, request
import os
from urllib.parse import urlparse


# Support both package and script execution
try:
    from .config import Config
    from .api import bp as api_bp
except Exception:
    import os
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from backend.config import Config
    from backend.api import bp as api_bp


def create_app() -> Quart:
    app = Quart(__name__)
    cfg = Config.from_env()

    # attach config and register blueprints
    app.config['APP_CONFIG'] = cfg
    app.register_blueprint(api_bp, url_prefix='/api')

    # Static serving for HLS and uploads during development (and simple deployments)
    async def _serve_static(root_dir: str, filename: str):
        resp = await send_from_directory(root_dir, filename)
        # Fix common HLS MIME types
        if filename.endswith('.m3u8'):
            resp.mimetype = 'application/vnd.apple.mpegurl'
        elif filename.endswith('.ts'):
            resp.mimetype = 'video/mp2t'
        return resp

    @app.get('/video-hls/<path:filename>')
    async def _video_hls(filename: str):
        return await _serve_static(str(cfg.VIDEO_HLS_DIR), filename)

    @app.get('/music-hls/<path:filename>')
    async def _music_hls(filename: str):
        return await _serve_static(str(cfg.MUSIC_HLS_DIR), filename)

    @app.get('/video-upload/<path:filename>')
    async def _video_upload(filename: str):
        return await send_from_directory(str(cfg.VIDEO_UPLOAD_DIR), filename)

    @app.get('/music-upload/<path:filename>')
    async def _music_upload(filename: str):
        return await send_from_directory(str(cfg.MUSIC_UPLOAD_DIR), filename)

    # WebSocket streaming logs for scans
    import asyncio
    import json as _json
    try:
        from .services.video import scan_and_convert_videos
        from .services.music import scan_and_convert_music
    except Exception:  # running as script (no package context)
        from backend.services.video import scan_and_convert_videos
        from backend.services.music import scan_and_convert_music

    app.scan_locks = {
        'video': asyncio.Lock(),
        'music': asyncio.Lock(),
    }

    async def _stream_scan(kind: str):
        lock = app.scan_locks[kind]
        cfg2 = app.config['APP_CONFIG']

        async with lock:
            async def send_log(line: str):
                try:
                    await websocket.send(_json.dumps({ 'type': 'log', 'line': line }))
                except Exception:
                    # client likely disconnected; stop sending further logs
                    pass

            try:
                if kind == 'video':
                    result = await scan_and_convert_videos(cfg2, log=send_log)
                else:
                    result = await scan_and_convert_music(cfg2, log=send_log)
                await websocket.send(_json.dumps({ 'type': 'done', 'result': result }))
            except Exception as e:  # pragma: no cover
                await websocket.send(_json.dumps({ 'type': 'error', 'message': str(e) }))

    @app.websocket('/ws/scan/video')
    async def ws_scan_video():
        await _stream_scan('video')

    @app.websocket('/ws/scan/music')
    async def ws_scan_music():
        await _stream_scan('music')

    # ========== Global CORS handling ==========
    # 允许的跨域来源（逗号分隔环境变量 CORS_ALLOW_ORIGINS 覆盖）
    # 支持三种写法：
    # 1) 完整 Origin：例如 https://igcrystal.icu
    # 2) 泛域名：例如 https://*.igcrystal.icu 或 *.igcrystal.icu（忽略协议，仅按 host 匹配）
    # 3) 裸主机：例如 igcrystal.icu（按主机名精确匹配）
    _cors_raw = os.getenv('CORS_ALLOW_ORIGINS') or 'https://igcrystal.icu,https://*.igcrystal.icu,https://www.igcrystal.icu'
    _cors_items = [i.strip() for i in _cors_raw.split(',') if i.strip()]
    allowed_exact_origins = set()
    allowed_exact_hosts = set()
    allowed_host_suffixes = set()  # 包含前导点：例如 .igcrystal.icu

    for item in _cors_items:
        if '://' in item:
            # 含协议，可能是完整 Origin，或 host 上带通配符
            u = urlparse(item)
            host = u.netloc
            if host.startswith('*.'):
                allowed_host_suffixes.add(host[1:])  # '*.example.com' -> '.example.com'
            else:
                allowed_exact_origins.add(item)
        else:
            # 不含协议，当作主机或通配符主机
            if item.startswith('*.'):
                allowed_host_suffixes.add(item[1:])
            else:
                allowed_exact_hosts.add(item)

    def _is_origin_allowed(origin: str | None) -> bool:
        if not origin:
            return False
        # 完整 Origin 精确匹配
        if origin in allowed_exact_origins:
            return True
        try:
            u = urlparse(origin)
            host = u.netloc
        except Exception:
            return False
        # 主机精确匹配
        if host in allowed_exact_hosts:
            return True
        # 泛域名后缀匹配
        for suf in allowed_host_suffixes:
            s = suf.lstrip('.')
            if host == s or host.endswith('.' + s):
                return True
        return False

    def _apply_cors_headers(resp):
        # 仅当请求来源在白名单中时，设置允许跨域
        origin = request.headers.get('Origin')
        if _is_origin_allowed(origin):
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Vary'] = 'Origin'
        # 若无需携带凭证，这里不必强制设置 Allow-Credentials
        # 避免缓存错误（不同 Origin）
        else:
            # 不匹配时，不返回 Allow-Origin，浏览器将阻止跨域
            pass
        resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
        # 允许前端常见头；若预检指定了请求头，原样透传
        req_headers = request.headers.get('Access-Control-Request-Headers')
        resp.headers['Access-Control-Allow-Headers'] = req_headers or 'Content-Type, Authorization'
        return resp

    @app.before_request
    async def _cors_preflight():
        if request.method == 'OPTIONS':
            resp = app.response_class(status=204)
            _apply_cors_headers(resp)
            return resp

    @app.after_request
    async def _cors_after(resp):
        try:
            return _apply_cors_headers(resp)
        except Exception:
            return resp

    # ========== Frontend: serve static exported site ==========
    if cfg.FRONTEND_ENABLE:
        from pathlib import Path
        site_dir = Path(cfg.FRONTEND_SITE_DIR) if cfg.FRONTEND_SITE_DIR else None

        if site_dir and site_dir.exists():
            static_dir = site_dir / '_next' / 'static'

            if static_dir.exists():
                @app.get('/_next/static/<path:filename>')
                async def _next_static(filename: str):
                    return await send_from_directory(str(static_dir), filename)

            async def _serve_site_path(p: str):
                # Try direct file
                f1 = site_dir / p.lstrip('/')
                if f1.is_file():
                    return await send_from_directory(str(site_dir), p.lstrip('/'))
                # Try directory index
                f2 = site_dir / p.lstrip('/') / 'index.html'
                if f2.is_file():
                    return await send_from_directory(str(f2.parent), 'index.html')
                # Try html file
                f3 = site_dir / (p.lstrip('/') + '.html')
                if f3.is_file():
                    return await send_from_directory(str(site_dir), p.lstrip('/') + '.html')
                # Fallback to 404 or index
                f404 = site_dir / '404.html'
                if f404.is_file():
                    return await send_from_directory(str(site_dir), '404.html')
                return await send_from_directory(str(site_dir), 'index.html')

            @app.get('/')
            async def _site_index():
                return await send_from_directory(str(site_dir), 'index.html')

            @app.get('/<path:rest>')
            async def _site_catch_all(rest: str):
                return await _serve_site_path('/' + rest)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=8000)
