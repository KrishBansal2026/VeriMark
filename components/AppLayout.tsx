'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { NavProvider } from './NavContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Standalone authentication and access error pages have no sidebar or authenticated app navigation
  const isStandalonePage =
    pathname === '/login' ||
    pathname.startsWith('/login') ||
    pathname === '/access-denied' ||
    pathname.startsWith('/access-denied');

  if (isStandalonePage) {
    return (
      <main className="min-h-screen w-full bg-[#070d1e] text-slate-100 flex flex-col">
        {children}
      </main>
    );
  }

  return (
    <NavProvider>
      <div className="flex min-h-screen w-full bg-[#070d1e] text-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </NavProvider>
  );
}
