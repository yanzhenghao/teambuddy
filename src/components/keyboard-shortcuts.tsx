"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const commands: Command[] = [
    {
      id: "goto-requirement",
      label: "跳转到需求管理",
      shortcut: "G R",
      action: () => {
        router.push("/requirement");
        setIsOpen(false);
      },
    },
    {
      id: "goto-kanban",
      label: "跳转到看板",
      shortcut: "G K",
      action: () => {
        router.push("/kanban");
        setIsOpen(false);
      },
    },
    {
      id: "goto-gantt",
      label: "跳转到甘特图",
      shortcut: "G G",
      action: () => {
        router.push("/gantt");
        setIsOpen(false);
      },
    },
    {
      id: "goto-standup",
      label: "跳转到 Standup",
      shortcut: "G S",
      action: () => {
        router.push("/standup");
        setIsOpen(false);
      },
    },
    {
      id: "goto-report",
      label: "跳转到日报",
      shortcut: "G D",
      action: () => {
        router.push("/report");
        setIsOpen(false);
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Command+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearch("");
      }
    },
    [isOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setIsOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入命令或快捷键..."
            className="w-full px-4 py-3 text-lg bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              未找到匹配的命令
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="text-gray-700">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded border border-gray-200">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-center">
          按 <kbd className="px-1 py-0.5 bg-white rounded border border-gray-200">Esc</kbd> 关闭
        </div>
      </div>
    </div>
  );
}
