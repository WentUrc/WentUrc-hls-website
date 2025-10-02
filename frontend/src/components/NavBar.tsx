"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlaySquare, Video, Music } from 'lucide-react'

export default function NavBar() {
  const pathname = usePathname()
  const isVideo = pathname?.startsWith('/video')
  const isMusic = pathname?.startsWith('/music')
  return (
    <header className="sticky top-0 z-10 border-b bg-white/70 dark:bg-slate-900/70 backdrop-blur border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <Link href="/" className="min-w-0 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-sm">
            <PlaySquare size={24} className="shrink-0 text-blue-600" />
            <span className="truncate select-none">WentUrc HLS 列表</span>
          </Link>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/video"
            aria-current={isVideo ? 'page' : undefined}
            className={`${isVideo
              ? 'text-blue-600 dark:text-blue-400 font-medium'
              : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
            } inline-flex items-center gap-1.5 px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-sm`}
          >
            <Video size={16} />
            <span className="hidden sm:inline">视频</span>
          </Link>
          <Link
            href="/music"
            aria-current={isMusic ? 'page' : undefined}
            className={`${isMusic
              ? 'text-blue-600 dark:text-blue-400 font-medium'
              : 'text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
            } inline-flex items-center gap-1.5 px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-sm`}
          >
            <Music size={16} />
            <span className="hidden sm:inline">音频</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
