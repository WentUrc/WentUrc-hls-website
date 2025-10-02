import Link from 'next/link'
import { Video, Music } from 'lucide-react'

export default function Page() {
  return (
    <div className="p-6 space-y-4">
  <h1 className="text-3xl font-bold text-blue-600">WentUrc HLS 列表</h1>
  <p className="text-slate-600">管理上传文件、生成 HLS、预览播放列表</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/video" className="rounded-lg border border-slate-200 p-5 hover:bg-slate-50 flex items-center gap-2">
          <Video size={18}/> 视频
        </Link>
        <Link href="/music" className="rounded-lg border border-slate-200 p-5 hover:bg-slate-50 flex items-center gap-2">
          <Music size={18}/> 音乐
        </Link>
      </div>
    </div>
  )
}
 
