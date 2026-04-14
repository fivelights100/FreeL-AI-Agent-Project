import React from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from "../hooks/useAgent";

interface ChatListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatList({ messages, messagesEndRef }: ChatListProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 space-y-4">
      {messages.filter(msg => msg.role !== "system" && msg.role !== "tool").map((msg, idx) => {
        if (msg.role === "assistant" && msg.tool_calls) {
          return (
            <div key={idx} className="flex justify-start my-2 animate-fade-in-up">
              <details className="max-w-[85%] sm:max-w-[60%] bg-black/20 border border-white/10 rounded-lg text-xs text-white/70 cursor-pointer group w-full overflow-hidden shadow-sm">
                <summary className="px-3 py-2 font-medium flex items-center gap-2 hover:bg-white/5 transition-colors list-none outline-none">
                  <span className="text-[10px] opacity-60 group-open:rotate-90 transition-transform">▶</span>
                  ⚙️ AI 작업 내역 ({msg.tool_calls.length}건의 도구 사용)
                </summary>
                <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                  {msg.tool_calls.map((tc: any, tIdx: number) => (
                    <div key={tIdx} className="bg-black/40 rounded p-2 border border-white/5">
                      <div className="text-blue-300 font-mono mb-1 text-[11px] font-semibold">{tc.function.name}()</div>
                      <div className="text-white/40 font-mono text-[10px] break-all">{tc.function.arguments}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          );
        }
        
        return (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up mb-6`}>
            <div className={`max-w-[85%] p-4 text-[14.5px] leading-relaxed tracking-wide ${
              msg.role === "user" 
                ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-[0_4px_20px_rgba(99,102,241,0.2)]" 
                : "bg-white/[0.03] border border-white/[0.05] text-slate-200 rounded-2xl rounded-tl-sm shadow-sm backdrop-blur-sm"
            }`}>
              {msg.role === "user" ? (
                  typeof msg.content === 'string' ? msg.content : "📸 [화면 캡처 이미지가 전송되었습니다]"
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code(props) {
                      const {children, className, node, ...rest} = props;
                      const match = /language-(\w+)/.exec(className || '');
                      return match ? (
                        <SyntaxHighlighter {...(rest as any)} PreTag="div" children={String(children).replace(/\n$/, '')} language={match[1]} style={vscDarkPlus as any} className="rounded-md my-2 text-sm border border-white/20" />
                      ) : (
                        <code {...rest} className="bg-black/30 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                      )
                    }
                  }}
                >
                  {msg.content || ""}
                </ReactMarkdown>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}