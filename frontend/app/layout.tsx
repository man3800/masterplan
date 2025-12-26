import "./globals.css";
import Link from "next/link";
import { NavigationWrapper } from "./navigation-wrapper";

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
        <NavigationWrapper>
          {children}
        </NavigationWrapper>
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
