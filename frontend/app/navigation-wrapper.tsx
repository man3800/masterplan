"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-black"
    >
      {label}
    </Link>
  );
}

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isManagePage = pathname?.startsWith("/classifications/manage");

  if (isManagePage) {
    // 분류 관리 페이지는 네비게이션 없이 표시
    return <>{children}</>;
  }

  // 일반 페이지는 네비게이션 포함
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b">
          <span className="font-bold text-lg">MasterPlan</span>
        </div>

        <nav className="p-3 space-y-1 text-sm">
          <NavItem href="/" label="대시보드" />
          <NavItem href="/tasks" label="작업 목록" />
          <NavItem href="/classifications" label="분류 뷰" />
          <NavItem href="/master" label="전체 마스터스케줄" />
          <NavItem href="/projects" label="프로젝트 스케줄" />
          <NavItem href="/rows/new" label="Row 생성" />
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

