'use client';

import { Flame, BarChart3, TrendingUp, UserRound, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { TabId } from '@/types';
import TodayView from '@/components/today/TodayView';
import WeekView from '@/components/week/WeekView';
import MonthView from '@/components/month/MonthView';
import ProfileView from '@/components/profile/ProfileView';
import ThemeToggle from '@/components/ui/ThemeToggle';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'today',   label: 'Today',   icon: Flame },
  { id: 'week',    label: 'Week',    icon: BarChart3 },
  { id: 'month',   label: 'Month',   icon: TrendingUp },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Thali" className="w-9 h-9 rounded-xl shrink-0" />
      <div>
        <h1 className="font-brand text-base font-bold text-ink leading-tight tracking-wide">Thali</h1>
        <p className="text-xs text-ink-muted leading-tight">calorie &amp; macro tracker</p>
      </div>
    </div>
  );
}

export default function AppShell() {
  const { tab, setTab } = useApp();
  const { user, logout } = useAuth();
  const activeLabel = TABS.find(t => t.id === tab)?.label ?? '';

  return (
    <div className="min-h-screen bg-app flex">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-surface border-r border-line z-20">
        <div className="px-5 py-5 border-b border-line">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-accent-soft text-primary'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <Icon size={19} strokeWidth={tab === id ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-line space-y-1">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-muted hover:bg-surface-2 hover:text-danger transition-colors"
          >
            <LogOut size={18} />
            Log out
          </button>
          <p className="px-4 pt-1 text-xs text-ink-muted truncate">{user?.email}</p>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 bg-surface border-b border-line">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={logout}
                aria-label="Log out"
                className="p-2 rounded-xl text-ink-muted hover:bg-surface-2 hover:text-danger transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
          <nav className="grid grid-cols-4 border-t border-line">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs border-b-2 transition-colors ${
                  tab === id
                    ? 'text-primary border-primary'
                    : 'text-ink-muted border-transparent'
                }`}
              >
                <Icon size={19} strokeWidth={tab === id ? 2.4 : 2} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {/* Desktop page title bar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-surface border-b border-line">
          <h2 className="text-lg font-semibold text-ink">{activeLabel}</h2>
          <ThemeToggle />
        </div>

        {/* Content */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 pb-10 lg:px-8 lg:py-6">
          {tab === 'today'   && <TodayView />}
          {tab === 'week'    && <WeekView />}
          {tab === 'month'   && <MonthView />}
          {tab === 'profile' && <ProfileView />}
        </main>
      </div>
    </div>
  );
}
