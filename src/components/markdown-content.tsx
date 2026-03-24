"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  /** "chat" = compact for chat bubbles; "detail" = normal for detail panels */
  variant?: "chat" | "detail";
}

export function MarkdownContent({ content, variant = "chat" }: MarkdownContentProps) {
  const isChat = variant === "chat";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className={`font-bold ${isChat ? "text-base mb-1" : "text-lg mb-2"}`}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={`font-semibold ${isChat ? "text-sm mb-1" : "text-base mb-1.5"}`}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={`font-semibold ${isChat ? "text-sm mb-0.5" : "text-sm mb-1"}`}>{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className={`${isChat ? "text-sm mb-1.5 last:mb-0" : "text-sm mb-2 last:mb-0"}`}>{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className={`list-disc pl-4 ${isChat ? "text-sm mb-1.5 space-y-0.5" : "text-sm mb-2 space-y-1"}`}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={`list-decimal pl-4 ${isChat ? "text-sm mb-1.5 space-y-0.5" : "text-sm mb-2 space-y-1"}`}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Bold & italic
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        // Code
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-black/10 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto my-1.5">
                {children}
              </code>
            );
          }
          return (
            <code className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
          );
        },
        pre: ({ children }) => <div className="my-1.5">{children}</div>,
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-current/20 pl-3 my-1.5 opacity-80">
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="border-current/10 my-2" />,
        // Table
        table: ({ children }) => (
          <div className="overflow-x-auto my-1.5">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-current/10 px-2 py-1 bg-black/5 font-medium text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-current/10 px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
