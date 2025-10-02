import Link from 'next/link'
import { Video, Music } from 'lucide-react'

export default function Page() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
  <h1 className="text-4xl sm:text-5xl font-bold">
    <span className="text-blue-600">WentUrc HLS </span>列表
  </h1>
  <p className="text-slate-600 dark:text-slate-300">管理上传文件、生成 HLS、预览播放列表</p>
  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/video"
          className="group rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 p-4 flex items-center gap-3 select-none transition-colors"
        >
          <Video size={24} className="text-slate-700 dark:text-slate-200" />
          <span className="text-base font-medium text-slate-800 dark:text-slate-100">视频</span>
        </Link>
        <Link
          href="/music"
          className="group rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 p-4 flex items-center gap-3 select-none transition-colors"
        >
          <Music size={24} className="text-slate-700 dark:text-slate-200" />
          <span className="text-base font-medium text-slate-800 dark:text-slate-100">音乐</span>
        </Link>
      </div>
    </div>
  )
}
 
