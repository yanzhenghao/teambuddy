"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "总览",
  "/kanban": "看板",
  "/gantt": "甘特图",
  "/report": "日报",
  "/requirement": "需求管理",
  "/standup": "Standup",
  "/admin/users": "用户管理",
};

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "TeamBuddy";

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-surface-200 z-30 flex items-center px-4">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg hover:bg-surface-100"
        aria-label="打开菜单"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex-1 text-center">
        <span className="font-semibold text-sm text-gray-800">{title}</span>
      </div>
      <div className="w-9" /> {/* Spacer to balance the hamburger button */}
    </header>
  );
}
