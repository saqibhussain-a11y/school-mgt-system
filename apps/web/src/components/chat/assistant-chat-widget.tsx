"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface ChatMessageDto {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

// A single floating widget, mounted once in the dashboard shell — not a
// dedicated page — so it's reachable from anywhere a parent/student is,
// the same way a real "ask us anything" chat bubble would be.
export function AssistantChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isEligible = user?.role === "PARENT" || user?.role === "STUDENT";

  useEffect(() => {
    if (!open || !isEligible) return;
    setLoadingHistory(true);
    apiFetch<ChatMessageDto[]>("/api/chat")
      .then(setMessages)
      .catch(() => toast.error("Failed to load chat history"))
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);

    const optimisticUser: ChatMessageDto = {
      id: `pending-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const reply = await apiFetch<ChatMessageDto>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      // Roll back the optimistic bubble and hand the text back — a failed
      // send shouldn't make someone retype their question from scratch.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setInput(content);
      toast.error(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    try {
      await apiFetch("/api/chat", { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to clear the conversation");
    }
  }

  if (!isEligible) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="icon"
            className="fixed right-5 bottom-5 z-40 size-12 rounded-full shadow-lg"
            aria-label="Open assistant"
          />
        }
      >
        <MessageCircle className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle>Assistant</SheetTitle>
          <Button size="sm" variant="ghost" onClick={handleClear} disabled={messages.length === 0}>
            <Trash2 className="size-4" />
            Clear
          </Button>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {loadingHistory ? (
            <Loader2 className="size-5 animate-spin self-center text-muted-foreground" />
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ask about fees, attendance, or recent announcements.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "USER"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            ))
          )}
          {sending && (
            <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question…"
            className="min-h-10 flex-1 resize-none"
            rows={1}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !input.trim()} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
