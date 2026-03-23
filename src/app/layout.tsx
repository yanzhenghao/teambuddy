import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamBuddy - 研发小组管家",
  description: "研发小组管家 Agent，每日进展收集、可视化看板、需求澄清与任务分配",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
