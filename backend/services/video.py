from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple
import os

from ..config import Config
from ..utils import safe_name, short_id, parse_artist_title


def probe_codecs(src: Path) -> Tuple[str | None, str | None]:
    if not shutil.which('ffprobe'):
        return None, None
    try:
        v = subprocess.run([
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', str(src)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        vcodec = v.stdout.decode().strip() if v.returncode == 0 else None
        a = subprocess.run([
            'ffprobe', '-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', str(src)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        acodec = a.stdout.decode().strip() if a.returncode == 0 else None
        return vcodec, acodec
    except Exception:
        return None, None


def decide_codecs(cfg: Config, src: Path) -> Tuple[list[str], list[str], str]:
    s = cfg.STRATEGY
    vcodec, acodec = probe_codecs(src) if s in ('auto',) else (None, None)
    if s == 'copy':
        return (['-c:v', 'copy'], ['-c:a', 'copy'], 'copy(force)')
    if s == 'transcode':
        return (['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'], ['-c:a', 'aac', '-b:a', '128k'], 'transcode(force)')
    if vcodec == 'h264' and acodec == 'aac':
        return (['-c:v', 'copy'], ['-c:a', 'copy'], 'copy(h264+aac)')
    if vcodec == 'h264' and acodec and acodec != 'aac':
        return (['-c:v', 'copy'], ['-c:a', 'aac', '-b:a', '128k'], f'vcopy+atrans({acodec}->aac)')
    return (['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'], ['-c:a', 'aac', '-b:a', '128k'], 'transcode(fallback)')


def write_meta(outdir: Path, meta: dict):
    outdir.mkdir(parents=True, exist_ok=True)
    with (outdir / 'meta.json').open('w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


async def transcode_to_hls(cfg: Config, src: Path, outdir: Path, log) -> bool:
    outdir.mkdir(parents=True, exist_ok=True)
    m3u8 = outdir / 'playlist.m3u8'
    if m3u8.exists() and not cfg.FORCE_REENCODE:
        log(f"[SKIP] 已存在 HLS：{m3u8}")
        return True
    if not shutil.which('ffmpeg'):
        log('WARN: 未找到 ffmpeg 可执行文件（请安装并加入 PATH），跳过转码')
        return False
    v_args, a_args, note = decide_codecs(cfg, src)
    cmd = [
        'ffmpeg', '-y', '-nostdin',
        '-i', str(src),
        *v_args, *a_args,
        '-hls_time', '6', '-hls_list_size', '0',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', str(outdir / 'segment_%03d.ts'),
        str(m3u8),
        '-loglevel', cfg.FFMPEG_LOGLEVEL,
    ]
    log(f"[FFMPEG] 开始转码 → {m3u8}\n         源: {src}\n         策略: {note} (FORCE={cfg.FORCE_REENCODE})\n         命令: {' '.join(cmd)}")
    try:
        stream_logs = cfg.VERBOSE or cfg.FFMPEG_LOGLEVEL.lower() not in ('error', 'fatal', 'panic', 'quiet')
        if stream_logs:
            proc = await asyncio.create_subprocess_exec(*cmd)
            try:
                await asyncio.wait_for(proc.wait(), timeout=cfg.FFMPEG_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                proc.kill()
                log(f"WARN: ffmpeg 转码超时：{src.name}")
                return False
            rc = proc.returncode
        else:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            try:
                out, err = await asyncio.wait_for(proc.communicate(), timeout=cfg.FFMPEG_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                proc.kill()
                log(f"WARN: ffmpeg 转码超时：{src.name}")
                return False
            rc = proc.returncode
            if rc != 0:
                log(f"WARN: ffmpeg 转码失败：{src.name}\n{(err or b'')[:1000].decode(errors='ignore')}")
        if rc != 0:
            return False
        log(f"[OK] 生成完成：{m3u8}")
        return True
    except Exception as e:
        log(f"WARN: ffmpeg 异常：{src.name} -> {e}")
        return False


async def scan_and_convert_videos(cfg: Config, log=print) -> Dict:
    tracks: List[dict] = []
    seen_safe: set[str] = set()
    exts = {'.mp4', '.mkv', '.avi', '.mov', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.ts'}

    if cfg.VIDEO_UPLOAD_DIR.exists():
        log(f"[SCAN] 扫描上传目录：{cfg.VIDEO_UPLOAD_DIR}（扩展名：{', '.join(sorted(exts))}）")
        found = 0
        for dirpath, dirnames, filenames in os.walk(cfg.VIDEO_UPLOAD_DIR):
            for fn in filenames:
                ext = Path(fn).suffix.lower()
                if ext not in exts:
                    continue
                found += 1
                full = Path(dirpath) / fn
                safe = safe_name(fn)
                outdir = cfg.VIDEO_HLS_DIR / safe
                log(f"[FILE] 发现：{full} -> safe={safe}")
                has_hls = await transcode_to_hls(cfg, full, outdir, log)

                name_no_ext = Path(fn).stem
                artist, title = parse_artist_title(name_no_ext)
                fmt = ext.lstrip('.')

                meta = {'originalFile': fn, 'artist': artist, 'title': title, 'format': fmt}
                write_meta(outdir, meta)

                id_ = short_id(safe)
                seen_safe.add(safe)
                track = {
                    'id': id_, 'artist': artist, 'title': title,
                    'originalFile': f"{cfg.VIDEO_ORIG_PUBLIC_PREFIX}/{fn}",
                    'hlsUrl': f"{cfg.VIDEO_HLS_PUBLIC_PREFIX}/{safe}/playlist.m3u8" if has_hls else None,
                    'hasHLS': bool(has_hls), 'format': fmt,
                }
                tracks.append(track)
        if found == 0:
            log(f"[SCAN] 未在 {cfg.VIDEO_UPLOAD_DIR} 内发现可处理的文件。")
    else:
        log(f"[WARN] 上传目录不存在：{cfg.VIDEO_UPLOAD_DIR}")

    # 补扫 HLS 目录
    for entry in sorted(cfg.VIDEO_HLS_DIR.glob('*/')):
        if not entry.is_dir():
            continue
        safe_dir = entry.name
        if safe_dir in seen_safe:
            continue
        if not (entry / 'playlist.m3u8').exists():
            continue
        meta = {}
        p = entry / 'meta.json'
        if p.exists():
            try:
                meta = json.loads(p.read_text(encoding='utf-8'))
            except Exception:
                meta = {}
        artist = meta.get('artist', '未知艺术家')
        title = meta.get('title', safe_dir)
        original_file_name = meta.get('originalFile')
        fmt = meta.get('format')

        id_ = short_id(safe_dir)
        track = {
            'id': id_, 'artist': artist, 'title': title,
            'originalFile': f"{cfg.VIDEO_ORIG_PUBLIC_PREFIX}/{original_file_name}" if original_file_name else None,
            'hlsUrl': f"{cfg.VIDEO_HLS_PUBLIC_PREFIX}/{safe_dir}/playlist.m3u8",
            'hasHLS': True, 'format': fmt,
        }
        tracks.append(track)

    # 写入播放列表
    tracks.sort(key=lambda x: (x.get('title') or ''))
    cfg.VIDEO_PLAYLIST_FILE.write_text(json.dumps(tracks, ensure_ascii=False, indent=2), encoding='utf-8')
    log(f"[DONE] 写入 {len(tracks)} 条到 {cfg.VIDEO_PLAYLIST_FILE}")
    return {'count': len(tracks), 'playlist': str(cfg.VIDEO_PLAYLIST_FILE)}
