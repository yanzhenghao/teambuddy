import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { MobileHeader } from "@/components/mobile-header";
import { MainLayoutClient } from "./main-layout-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TeamBuddy - 研发小组管家",
  description: "研发小组管家 Agent，每日进展收集、可视化看板、需求澄清与任务分配",
};

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <MainLayoutClient>{children}</MainLayoutClient>
          <KeyboardShortcuts />
        </ToastProvider>
      </body>
    </html>
  );
}
