# WentUrc HLS Website

一个包含前端（Next.js）与后端（Quart）的媒体管理与 HLS 播放站点。支持：
- 上传目录扫描与 HLS 列表生成（视频/音频）
- HLS 播放预览（自研音频播放器 + HLS.js；视频 HLS 播放）
- 移动端/平板/桌面自适应界面与细节优化（触控、快捷键、动画、滚动条样式等）

## 目录结构

```
assets/                  # 前端静态导出产物（构建后收集至此，用于静态部署）
backend/                 # Quart 后端服务与 API
frontend/                # Next.js 15 App Router 前端
music-hls/               # 音频 HLS 片段目录（由后端生成/读取）
music-playlist/          # 音频播放列表 JSON（由后端生成/读取）
music-upload/            # 音频上传的原始文件目录
video-hls/               # 视频 HLS 片段目录（由后端生成/读取）
video-playlist/          # 视频播放列表 JSON（由后端生成/读取）
video-upload/            # 视频上传的原始文件目录
scripts/
  └─ collect_frontend_export.js  # 构建后把前端导出结果收集到仓库根的 assets/
```

## 前端（frontend）
- 技术栈：Next.js 15（App Router + Turbopack）、Tailwind CSS、lucide-react、sonner、hls.js。
- 主要页面：
  - `/`：入口导航
  - `/video`：视频列表与播放（<lg 隐藏列表，提供上下切换；视频就绪后淡入）
  - `/music`：音频列表与播放（自研 AudioPlayer，支持 HLS、进度/音量/播放模式、键盘快捷键、移动端紧凑模式）

### 本地开发
Windows PowerShell 示例：

```powershell
cd frontend
npm install
npm run dev
```

打开 http://localhost:3000 访问。

### 生产构建（静态导出）

```powershell
cd frontend
npm install
npm run build
```

构建完成后，Next 输出的静态文件会放在 `frontend/assets`（已通过 `distDir: 'assets'` 指向），随后 `scripts/collect_frontend_export.js` 会把产物拷贝到仓库根的 `assets/` 目录，便于静态服务器（如 Nginx）直接部署。

> 注意：Next 警告“rewrites 在 export 下不生效”。本项目通过后端（或前置代理）处理 API 与静态资源路径。静态部署时请在服务器（如 Nginx）上配置对应反向代理。

### 配置说明（frontend）
- `next.config.ts`
  - `output: 'export'`：静态导出
  - `distDir: 'assets'`：构建输出目录
  - `images.unoptimized: true`：禁用图片优化以兼容静态导出
  - `rewrites()`：开发期/SSR 模式可用；纯静态导出时需要由前置代理（如 Nginx）处理同等规则

## 后端（backend）
- 技术栈：Quart（async Flask 风格）、uvicorn/hypercorn、aiohttp。
- 功能：
  - 提供 API：
    - `GET /api/health`
    - `GET /api/video/playlist`、`POST /api/scan/video`
    - `GET /api/music/playlist`、`POST /api/scan/music`
  - 负责扫描上传目录、生成播放列表与 HLS 资源（FFmpeg 调用策略见环境变量）

### 安装与运行

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python ./app.py
```

后端默认监听 8000（以代码为准）。

### 重要环境变量（示例）
- 视频：
  - `VIDEO_UPLOAD_DIR`, `VIDEO_HLS_DIR`, `VIDEO_PLAYLIST_FILE`
  - `VIDEO_HLS_PUBLIC_PREFIX`, `VIDEO_ORIG_PUBLIC_PREFIX`
- 音频：
  - `MUSIC_UPLOAD_DIR`, `MUSIC_HLS_DIR`, `MUSIC_PLAYLIST_FILE`
  - `MUSIC_HLS_PUBLIC_PREFIX`, `MUSIC_ORIG_PUBLIC_PREFIX`
- 通用/转码：
  - `FFMPEG_TIMEOUT_SECONDS`, `FFMPEG_LOGLEVEL`, `STRATEGY`(auto|copy|transcode), `FORCE_REENCODE`(0/1), `VERBOSE`(0/1)

## 部署

### 方案 A：前后端同机 + Nginx 静态托管
1. 构建前端并收集导出：`frontend` 运行 `npm run build`，产物位于仓库根 `assets/`
2. Nginx 将 `assets/` 作为站点根；转发 `/api`、`/video-hls`、`/music-hls`、`/video-upload`、`/music-upload`、`/ws` 到后端 8000
3. 后端用 `uvicorn` 或 `hypercorn` 常驻运行

#### 可参考的 Nginx 配置：

```nginx

    # WebSocket 透传（必须放在通用 / 之前）
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    # proxy
    location = /index.html {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Surrogate-Control "no-store" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Surrogate-Control "no-store" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }

```

### 方案 B：容器化（可选）
- 将 `assets/` 作为静态卷挂载到 Nginx 容器
- 后端单独容器暴露 8000，Nginx 反代上述路径
