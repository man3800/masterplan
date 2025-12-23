import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "MasterPlan",
  description: "사내 마스터 스케줄 관리",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-50">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-white border-r flex-shrink-0">
            <div className="h-14 flex items-center px-4 border-b">
              <span className="font-bold text-lg">MasterPlan</span>
            </div>

            <nav className="p-3 space-y-1 text-sm">
              <NavItem href="/" label="대시보드" />
              <NavItem href="/tasks" label="작업 목록" />
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
      </body>
    </html>
  );
}

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
