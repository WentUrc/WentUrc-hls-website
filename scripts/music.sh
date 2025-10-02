#!/bin/bash
set -euo pipefail

# Resolve project paths relative to this script for portability (dev and prod)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Project directories (can be overridden by env)
MUSIC_DIR="${MUSIC_DIR:-$ROOT_DIR/music-upload}"
HLS_DIR="${HLS_DIR:-$ROOT_DIR/music-hls}"
PLAYLIST_FILE="${PLAYLIST_FILE:-$ROOT_DIR/music-playlist/playlist.json}"

# Public URL prefixes used in generated playlist.json (can be overridden by env)
# Defaults: HLS at /music-hls, originals at /music-upload; change via HLS_PUBLIC_PREFIX/ORIG_PUBLIC_PREFIX
HLS_PUBLIC_PREFIX="${HLS_PUBLIC_PREFIX:-/music-hls}"
ORIG_PUBLIC_PREFIX="${ORIG_PUBLIC_PREFIX:-/music-upload}"

# Normalize (strip trailing slashes)
HLS_PREFIX="${HLS_PUBLIC_PREFIX%/}"
ORIG_PREFIX="${ORIG_PUBLIC_PREFIX%/}"

TIMEOUT_CMD="$(command -v timeout || echo '')"

mkdir -p "$HLS_DIR"
mkdir -p "$(dirname "$PLAYLIST_FILE")"

# safe filename: use hyphen '-' as separator (no underscores)
safe_filename() {
    local fn="$1"
    python3 - "$fn" <<'PYCODE'
import sys, re, unicodedata, hashlib
fn = sys.argv[1]
name = re.sub(r"\.(flac|mp3|wav|m4a)$", "", fn, flags=re.IGNORECASE)
norm = unicodedata.normalize('NFKC', name)
# 非字母数字、空格、中文、日文或连字符的字符都替换为连字符
safe = re.sub(r"[^\w\s\u4e00-\u9fff\u3040-\u30ff\-]", "-", norm)
# 把空格、下划线和多个连字符合并为单个连字符
safe = re.sub(r"[_\s\-]+", "-", safe).strip('-')
if not safe:
    safe = hashlib.md5(name.encode()).hexdigest()[:8]
print(safe)
PYCODE
}

# id from safe name (稳定)
generate_id() {
    echo -n "$1" | md5sum | cut -c1-8
}

# parse "Artist - Title" 风格的文件名
parse_filename() {
    local name="${1%.*}"
    if [[ "$name" == *" - "* ]]; then
        artist="${name%% - *}"
        title="${name#* - }"
    else
        artist="未知艺术家"
        title="$name"
    fi
}

# 记录已见 safe（避免重复）
declare -A seen

# 写头
echo '{"tracks": [' > "$PLAYLIST_FILE"
first=true

# 遍历 MUSIC_DIR（使用 -print0 以支持任意文件名）
while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    safe=$(safe_filename "$filename")
    id=$(generate_id "$safe")
    ext="${filename##*.}"
    parse_filename "$filename"

    outdir="$HLS_DIR/$safe"
    hasHLS=false

    if [[ -f "$outdir/playlist.m3u8" ]]; then
        echo "跳过：$filename（已存在 HLS）"
        hasHLS=true
    else
        mkdir -p "$outdir"
        echo "✔️ 处理：$filename → $safe (ID: $id)"
        cmd=(ffmpeg -nostdin -i "$file" -vn -c:a aac -b:a 128k -ar 44100 -ac 2 \
            -hls_time 10 -hls_list_size 0 \
            -hls_segment_filename "$outdir/segment_%03d.ts" \
            "$outdir/playlist.m3u8" -y -loglevel error)

        if [[ -n "$TIMEOUT_CMD" ]]; then
            if "$TIMEOUT_CMD" 300 "${cmd[@]}"; then
                hasHLS=true
            else
                echo "⚠️ 转码超时或失败：$filename"
                hasHLS=false
            fi
        else
            if "${cmd[@]}"; then
                hasHLS=true
            else
                echo "⚠️ ffmpeg 转码失败：$filename"
                hasHLS=false
            fi
        fi
    fi

    # 写 meta.json（覆盖/更新），便于后续从 HLS 恢复信息
    if [[ -d "$outdir" ]]; then
        mkdir -p "$outdir"
        # 用简单的方式写 json（转义双引号）
        printf '{\n  "originalFile": "%s",\n  "artist": "%s",\n  "title": "%s"\n}\n' \
            "$(printf '%s' "$filename" | sed 's/"/\\"/g')" \
            "$(printf '%s' "$artist" | sed 's/"/\\"/g')" \
            "$(printf '%s' "$title" | sed 's/"/\\"/g')" >"$outdir/meta.json"
    fi

    # 标记已见
    seen["$safe"]=1

    # 写入 JSON 条目（控制逗号）
    if [[ "$first" == false ]]; then
        echo "," >> "$PLAYLIST_FILE"
    fi
    first=false

    cat <<JSON >> "$PLAYLIST_FILE"
  {
    "id": "$id",
    "artist": "$artist",
    "title": "$title",
        "originalFile": "$ORIG_PREFIX/$filename",
        "hlsUrl": $([ "$hasHLS" = true ] && echo "\"$HLS_PREFIX/$safe/playlist.m3u8\"" || echo null),
    "hasHLS": $([ "$hasHLS" = true ] && echo true || echo false),
    "format": "$ext"
  }
JSON

done < <(find "$MUSIC_DIR" -type f \( -iname "*.flac" -o -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) -print0)

# 补扫 HLS_DIR 中已有但未在 MUSIC_DIR 中列出的项（优先读取 meta.json）
for d in "$HLS_DIR"/*/; do
    [[ -d "$d" ]] || continue
    if [[ -f "$d/playlist.m3u8" ]]; then
        safe_dir=$(basename "$d")
        # 如果已经被处理过就跳过
        if [[ -n "${seen[$safe_dir]:-}" ]]; then
            continue
        fi

        # 读取 meta.json（若存在），否则降级
        if [[ -f "$d/meta.json" ]]; then
            # 使用 python 解析以支持 unicode
            read_artist=$(python3 - <<PY
import json,sys
m=json.load(open("$d/meta.json"))
print(m.get("artist","未知艺术家"))
PY
)
            read_title=$(python3 - <<PY
import json,sys
m=json.load(open("$d/meta.json"))
print(m.get("title", "$safe_dir"))
PY
)
            read_original=$(python3 - <<PY
import json,sys
m=json.load(open("$d/meta.json"))
print(m.get("originalFile") if m.get("originalFile") is not None else "null")
PY
)
            artist="$read_artist"
            title="$read_title"
            if [[ "$read_original" == "null" ]]; then
                originalFile=null
            else
                originalFile="\"$ORIG_PREFIX/$read_original\""
            fi
        else
            artist="未知艺术家"
            title="$safe_dir"
            originalFile=null
        fi

        id=$(generate_id "$safe_dir")
        hasHLS=true

        if [[ "$first" == false ]]; then
            echo "," >> "$PLAYLIST_FILE"
        fi
        first=false

        cat <<JSON >> "$PLAYLIST_FILE"
  {
    "id": "$id",
    "artist": "$artist",
    "title": "$title",
    "originalFile": $originalFile,
        "hlsUrl": "$HLS_PREFIX/$safe_dir/playlist.m3u8",
    "hasHLS": true,
    "format": null
  }
JSON

        seen["$safe_dir"]=1
    fi
done

# 结束 JSON
echo "" >> "$PLAYLIST_FILE"
echo "]}" >> "$PLAYLIST_FILE"

chmod -R 755 "$HLS_DIR"
chmod 644 "$PLAYLIST_FILE"

echo "🎉 完成！播放列表：$PLAYLIST_FILE"
