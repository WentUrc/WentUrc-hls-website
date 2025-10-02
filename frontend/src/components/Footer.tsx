import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="w-full text-sm text-slate-600 dark:text-slate-400">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © {new Date().getFullYear()} WentUrc. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Home Page
            </Link>
            <a
              href="https://wenturc.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Main Site
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
