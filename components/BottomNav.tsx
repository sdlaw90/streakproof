"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "🏋️" },
  { href: "/history", label: "History", icon: "📅" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/program", label: "Edit", icon: "⚙️" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition " +
                (active ? "text-accent" : "text-faint")
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
