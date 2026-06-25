import Link from 'next/link';
import { Network, ListChecks, BookOpen, Play } from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';

const nav = [
  { href: '/org', label: 'Organograma', icon: Network },
  { href: '/findings', label: 'Findings', icon: ListChecks },
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { href: '/runs', label: 'Runs', icon: Play },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-white/10 bg-black/30 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <span className="font-semibold bg-gradient-to-r from-brevus-purple-light to-brevus-cyan bg-clip-text text-transparent">
            Brevus Hub
          </span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-white/10">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
