from __future__ import annotations

import asyncio
import hashlib
import re
import unicodedata
from pathlib import Path
from typing import Tuple, Optional, List


def safe_name(filename: str) -> str:
    name_no_ext = Path(filename).stem
    norm = unicodedata.normalize('NFKC', name_no_ext)
    safe = re.sub(r"[^\w\s\u4e00-\u9fff\u3040-\u30ff\-]", "-", norm)
    safe = re.sub(r"[_\s\-]+", "-", safe).strip('-')
    if not safe:
        safe = hashlib.md5(name_no_ext.encode('utf-8')).hexdigest()[:8]
    return safe


def short_id(s: str) -> str:
    return hashlib.md5(s.encode('utf-8')).hexdigest()[:8]


def parse_artist_title(name_no_ext: str) -> Tuple[str, str]:
    if ' - ' in name_no_ext:
        artist, title = name_no_ext.split(' - ', 1)
        return artist.strip(), title.strip()
    return '未知艺术家', name_no_ext


async def run_streamed(cmd: List[str], timeout: Optional[int] = None, on_stdout=None, on_stderr=None) -> int:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    async def reader(stream, cb):
        if not cb:
            return
        while True:
            line = await stream.readline()
            if not line:
                break
            cb(line.decode(errors='ignore').rstrip())
    try:
        await asyncio.wait_for(asyncio.gather(reader(proc.stdout, on_stdout), reader(proc.stderr, on_stderr)), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        return 124
    return await proc.wait()
