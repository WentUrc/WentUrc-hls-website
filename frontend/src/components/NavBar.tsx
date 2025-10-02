"use client"
import Link from 'next/link'
import { PlaySquare } from 'lucide-react'

export default function NavBar() {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur border-slate-200 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <PlaySquare size={18} className="text-blue-600" />
            <span>WentUrc HLS 列表</span>
          </Link>
        </div>
        <div />
      </div>
    </header>
  )
}
