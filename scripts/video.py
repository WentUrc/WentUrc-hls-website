#!/usr/bin/env python3

# 该脚本作为早期 video 转换工具，现已弃用

import os
import json
import hashlib
import re
import sys
import subprocess
import unicodedata
import shutil
from pathlib import Path

# --------------- 路径与前缀（可通过环境变量覆盖） ---------------
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent

UPLOAD_DIR = Path(os.getenv('VIDEO_UPLOAD_DIR', ROOT_DIR / 'video-upload'))
HLS_DIR = Path(os.getenv('VIDEO_HLS_DIR', ROOT_DIR / 'video-hls'))
PLAYLIST_FILE = Path(os.getenv('VIDEO_PLAYLIST_FILE', ROOT_DIR / 'video-playlist' / 'playlist.json'))

HLS_PUBLIC_PREFIX = os.getenv('HLS_PUBLIC_PREFIX', '/video-hls').rstrip('/')
ORIG_PUBLIC_PREFIX = os.getenv('ORIG_PUBLIC_PREFIX', '/video-upload').rstrip('/')

FFMPEG_TIMEOUT = int(os.getenv('FFMPEG_TIMEOUT_SECONDS', '900'))  # 默认 15 分钟
FFMPEG_LOGLEVEL = os.getenv('FFMPEG_LOGLEVEL', 'error')  # 可设为 info/verbose 获得更多日志
VERBOSE = os.getenv('VERBOSE', '1') not in ('0', 'false', 'False')
STRATEGY = os.getenv('STRATEGY', 'auto').lower()  # auto|copy|transcode
FORCE_REENCODE = os.getenv('FORCE_REENCODE', '0') in ('1', 'true', 'True')

HLS_DIR.mkdir(parents=True, exist_ok=True)
PLAYLIST_FILE.parent.mkdir(parents=True, exist_ok=True)

# 允许的扩展名（大小写不敏感）
EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.ts'}


def log(msg: str):
    if VERBOSE:
        print(msg, file=sys.stderr, flush=True)


# --------------- 工具函数 ---------------
def safe_name(filename: str) -> str:
    name_no_ext = Path(filename).stem
    norm = unicodedata.normalize('NFKC', name_no_ext)
    # 非字母数字、空格、中文、日文或连字符的字符都替换为连字符
    safe = re.sub(r"[^\w\s\u4e00-\u9fff\u3040-\u30ff\-]", "-", norm)
    # 把空格、下划线和多个连字符合并为单个连字符
    safe = re.sub(r"[_\s\-]+", "-", safe).strip('-')
    if not safe:
        safe = hashlib.md5(name_no_ext.encode('utf-8')).hexdigest()[:8]
    return safe


def short_id(s: str) -> str:
    return hashlib.md5(s.encode('utf-8')).hexdigest()[:8]


def parse_artist_title(name_no_ext: str):
    if ' - ' in name_no_ext:
        artist, title = name_no_ext.split(' - ', 1)
        return artist.strip(), title.strip()
    return '未知艺术家', name_no_ext


def probe_codecs(src: Path):
    """返回 (vcodec, acodec) 或 (None, None) 如果 ffprobe 不可用/失败。"""
    if not shutil.which('ffprobe'):
        log('[PROBE] 未找到 ffprobe，跳过编解码探测（将按策略回退）。')
        return None, None
    try:
        # 视频编码
        v = subprocess.run([
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', str(src)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        vcodec = v.stdout.decode().strip() if v.returncode == 0 else None
        # 音频编码
        a = subprocess.run([
            'ffprobe', '-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', str(src)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        acodec = a.stdout.decode().strip() if a.returncode == 0 else None
        log(f"[PROBE] {src.name} vcodec={vcodec or '?'} acodec={acodec or '?'}")
        return vcodec, acodec
    except Exception as e:
        log(f"[PROBE] 探测失败：{e}")
        return None, None


def decide_codecs(src: Path):
    """根据策略选择编码参数，返回 (v_args, a_args, note)。"""
    s = STRATEGY
    vcodec, acodec = probe_codecs(src) if s in ('auto',) else (None, None)
    # 目标期望：HLS 友好 -> H.264 + AAC
    if s == 'copy':
        return (['-c:v', 'copy'], ['-c:a', 'copy'], 'copy(force)')
    if s == 'transcode':
        return (['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'], ['-c:a', 'aac', '-b:a', '128k'], 'transcode(force)')
    # auto
    if vcodec == 'h264' and acodec == 'aac':
        return (['-c:v', 'copy'], ['-c:a', 'copy'], 'copy(h264+aac)')
    if vcodec == 'h264' and acodec and acodec != 'aac':
        return (['-c:v', 'copy'], ['-c:a', 'aac', '-b:a', '128k'], f'vcopy+atrans({acodec}->aac)')
    # 回退：重编码
    return (['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'], ['-c:a', 'aac', '-b:a', '128k'], 'transcode(fallback)')


def transcode_to_hls(src: Path, outdir: Path, timeout_sec: int) -> bool:
    """使用 ffmpeg 转码为 HLS；若已有 playlist.m3u8 则跳过。成功返回 True，失败 False。"""
    outdir.mkdir(parents=True, exist_ok=True)
    m3u8 = outdir / 'playlist.m3u8'
    if m3u8.exists() and not FORCE_REENCODE:
        log(f"[SKIP] 已存在 HLS：{m3u8}")
        return True
    if not shutil.which('ffmpeg'):
        print('WARN: 未找到 ffmpeg 可执行文件（请安装并加入 PATH），跳过转码', file=sys.stderr, flush=True)
        return False
    v_args, a_args, note = decide_codecs(src)
    cmd = [
        'ffmpeg', '-y', '-nostdin',
        '-i', str(src),
        *v_args,
        *a_args,
        '-hls_time', '6', '-hls_list_size', '0',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', str(outdir / 'segment_%03d.ts'),
        str(m3u8),
        '-loglevel', FFMPEG_LOGLEVEL,
    ]
    log(f"[FFMPEG] 开始转码 → {m3u8}\n         源: {src}\n         策略: {note} (FORCE={FORCE_REENCODE})\n         命令: {' '.join(cmd)}")
    try:
        # 在详细模式或更高日志级别下，直通 ffmpeg 输出到控制台，便于观察进度
        stream_logs = VERBOSE or FFMPEG_LOGLEVEL.lower() not in ('error', 'fatal', 'panic', 'quiet')
        if stream_logs:
            r = subprocess.run(cmd, timeout=timeout_sec)
        else:
            r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout_sec)
        if r.returncode != 0:
            print(f"WARN: ffmpeg 转码失败：{src.name}\n{r.stderr.decode(errors='ignore')[:1000]}", file=sys.stderr, flush=True)
            return False
        log(f"[OK] 生成完成：{m3u8}")
        return True
    except subprocess.TimeoutExpired:
        print(f"WARN: ffmpeg 转码超时：{src.name}", file=sys.stderr, flush=True)
        return False
    except Exception as e:
        print(f"WARN: ffmpeg 异常：{src.name} -> {e}", file=sys.stderr, flush=True)
        return False


def write_meta(outdir: Path, meta: dict):
    try:
        with (outdir / 'meta.json').open('w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        log(f"[META] 写入 {outdir/'meta.json'}")
    except Exception as e:
        print(f"WARN: 写入 meta.json 失败：{outdir} -> {e}", file=sys.stderr, flush=True)


def read_meta(outdir: Path) -> dict:
    p = outdir / 'meta.json'
    if p.exists():
        try:
            return json.loads(p.read_text(encoding='utf-8'))
        except Exception as e:
            print(f"WARN: 读取 meta.json 失败：{p} -> {e}", file=sys.stderr, flush=True)
    return {}


# --------------- 主流程：扫描上传并转码 ---------------
tracks = []
seen_safe = set()

if UPLOAD_DIR.exists():
    log(f"[SCAN] 扫描上传目录：{UPLOAD_DIR}（扩展名：{', '.join(sorted(EXTS))}）")
    found = 0
    for dirpath, dirnames, filenames in os.walk(UPLOAD_DIR):
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in EXTS:
                continue
            found += 1
            full = Path(dirpath) / fn
            safe = safe_name(fn)
            outdir = HLS_DIR / safe
            log(f"[FILE] 发现：{full} -> safe={safe}")
            has_hls = transcode_to_hls(full, outdir, FFMPEG_TIMEOUT)

            name_no_ext = os.path.splitext(fn)[0]
            artist, title = parse_artist_title(name_no_ext)
            fmt = ext.lstrip('.')

            # 写 meta.json（覆盖/更新）
            meta = {
                'originalFile': fn,
                'artist': artist,
                'title': title,
                'format': fmt,
            }
            write_meta(outdir, meta)

            id_ = short_id(safe)
            seen_safe.add(safe)
            track = {
                'id': id_,
                'artist': artist,
                'title': title,
                'originalFile': f"{ORIG_PUBLIC_PREFIX}/{fn}",
                'hlsUrl': f"{HLS_PUBLIC_PREFIX}/{safe}/playlist.m3u8" if has_hls else None,
                'hasHLS': bool(has_hls),
                'format': fmt,
            }
            tracks.append(track)
    if found == 0:
        log(f"[SCAN] 未在 {UPLOAD_DIR} 内发现可处理的文件。")
else:
    log(f"[WARN] 上传目录不存在：{UPLOAD_DIR}")


# --------------- 补扫 HLS 目录，包含无源视频的已转码内容 ---------------
for entry in sorted(HLS_DIR.glob('*/')):
    if not entry.is_dir():
        continue
    safe_dir = entry.name
    if safe_dir in seen_safe:
        continue
    if not (entry / 'playlist.m3u8').exists():
        continue
    meta = read_meta(entry)
    artist = meta.get('artist', '未知艺术家')
    title = meta.get('title', safe_dir)
    original_file_name = meta.get('originalFile')
    fmt = meta.get('format')

    id_ = short_id(safe_dir)
    track = {
        'id': id_,
        'artist': artist,
        'title': title,
        'originalFile': f"{ORIG_PUBLIC_PREFIX}/{original_file_name}" if original_file_name else None,
        'hlsUrl': f"{HLS_PUBLIC_PREFIX}/{safe_dir}/playlist.m3u8",
        'hasHLS': True,
        'format': fmt,
    }
    tracks.append(track)


# --------------- 写入播放列表（基于标题排序） ---------------
tracks.sort(key=lambda x: (x.get('title') or ''))
with PLAYLIST_FILE.open('w', encoding='utf-8') as f:
    json.dump(tracks, f, ensure_ascii=False, indent=2)

log(f"[DONE] 写入 {len(tracks)} 条到 {PLAYLIST_FILE}")
