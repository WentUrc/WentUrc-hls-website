# WentUrc HLS 列表

一个包含前端（Next.js）与后端（Quart）的媒体管理与 HLS 播放站点。支持：
- 上传目录扫描与 HLS 列表生成（视频/音频）
- HLS 播放预览
- 移动端/平板/桌面自适应界面

## 窝的目录结构

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

## 窝的前端（frontend）
- 技术栈：Next.js 15（App Router + Turbopack）、Tailwind CSS、lucide-react、sonner、hls.js。
- 主要页面：
  - `/`：入口导航
  - `/video`：视频列表与播放（<lg 隐藏列表，提供上下切换；视频就绪后淡入）
  - `/music`：音频列表与播放（自研 AudioPlayer，支持 HLS、进度/音量/播放模式、键盘快捷键、移动端紧凑模式）

### 生产构建（静态导出）

```powershell
cd frontend
npm install
npm run build
```

主要是说，构建完成后，Next 输出的静态文件会放在 `frontend/assets`（已通过 `distDir: 'assets'` 指向），随后 `scripts/collect_frontend_export.js` 会把产物拷贝到仓库根的 `assets/` 目录，便于静态服务器（如 Nginx）直接部署。

> [!WARNING]
>
> Next 警告“rewrites 在 export 下不生效”。
>
> 本项目通过后端（或前置代理）处理 API 与静态资源路径。静态部署时请在服务器（如 Nginx）上配置对应反向代理。

## 窝的后端（backend）
- 技术栈：Quart（async Flask 风格）、uvicorn/hypercorn、aiohttp。
- 功能：
  - 提供 API：
    - `GET /api/health`
    - `GET /api/video/playlist`、`POST /api/scan/video`
    - `GET /api/music/playlist`、`POST /api/scan/music`
  - 负责扫描上传目录、生成播放列表与 HLS 资源（FFmpeg 调用策略见环境变量）

> [!NOTE]
>
> 说白了，其实就是脚本的升级版，只不过加了前端更方便了

## 展示

[👉 展示页面](https://hls.wenturc.com)

> [!NOTE]
>
> 安全考虑，没有在前端加入上传入口，也没有在后端加入上传 `API` 端点
>
> 所以用其他的方式上传吧
>
> 唔，这么说来，那窝写这个前端的作用是什么呢？
>
> 主要就是方便查看资源啦！
>
> 这个 “开始工作” 按钮的作用是？
>
> 这个按钮是用来扫描 `*-upload` 目录里面的资源的，额，但是好像多此一举了？
>
> 但是至少比在终端里运行脚本方便了一点点吧？
>
> 感觉还是不对，那为啥不加个登录，然后跳转到管理面板，这样就可以放心上传了
>
> 呃，确实。。。 (\*/ω＼\*) 一开始没想到
>
> **算了不管了** (ノへ￣、)
