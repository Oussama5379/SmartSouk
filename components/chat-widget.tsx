"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useEffect, useRef, useState } from "react"
import { Bot, MessageCircle, Send, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatContext, LeadQualificationResult } from "@/lib/tracking-types"

interface ChatWidgetProps {
  sessionId?: string
  currentPageUrl?: string
  activeProductId?: string | null
  onOpen?: () => void
  storeName?: string
}

interface ConversationTurn {
  role: "user" | "assistant"
  content: string
}

function getMessageText(message: Pick<UIMessage, "parts">): string {
  if (!message.parts || !Array.isArray(message.parts)) {
    return ""
  }

  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

function buildConversationHistory(messages: UIMessage[]): ConversationTurn[] {
  return messages
    .filter((message): message is UIMessage & { role: "user" | "assistant" } =>
      message.role === "user" || message.role === "assistant"
    )
    .map((message) => ({
      role: message.role,
      content: getMessageText(message).trim(),
    }))
    .filter((turn) => turn.content.length > 0)
}

export function ChatWidget({
  sessionId,
  currentPageUrl,
  activeProductId,
  onOpen,
  storeName,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const leadQualifiedRef = useRef(false)
  const leadQualificationInFlightRef = useRef(false)

  const buildChatContext = (): ChatContext => ({
    session_id: sessionId || undefined,
    current_page_url: currentPageUrl || undefined,
    active_product_id: activeProductId ?? undefined,
  })

  const { messages, sendMessage, setMessages, status } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [
        {
          id: "welcome",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `Marhaba! Welcome to ${storeName?.trim() || "SmartSouk"}. Tell me what you're shopping for and I'll recommend products right away. If needed, I'll ask: "What's your budget in dinars?"`,
            },
          ],
        },
    ] as UIMessage[],
    onFinish: ({ messages: finishedMessages }) => {
      const userTurnCount = finishedMessages.filter((message) => message.role === "user").length
      if (
        userTurnCount < 3 ||
        leadQualifiedRef.current ||
        leadQualificationInFlightRef.current
      ) {
        return
      }

      leadQualificationInFlightRef.current = true
      void qualifyLead(finishedMessages).finally(() => {
        leadQualificationInFlightRef.current = false
      })
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendUserMessage = (text: string) => {
    const trimmedText = text.trim()
    if (!trimmedText) {
      return
    }

    void sendMessage(
      { text: trimmedText },
      {
        body: buildChatContext(),
      }
    )
  }

  const qualifyLead = async (chatMessages: UIMessage[]) => {
    try {
      const conversationHistory = buildConversationHistory(chatMessages)
      if (conversationHistory.length < 2) {
        return
      }

      const response = await fetch("/api/qualify-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationHistory,
          ...buildChatContext(),
        }),
      })

      if (!response.ok) {
        return
      }

      const qualification = (await response.json()) as LeadQualificationResult
      leadQualifiedRef.current = true

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `lead_${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text: qualification.summary }],
        } as UIMessage,
      ])
    } catch (error) {
      console.error("[chat-widget] Lead qualification failed:", error)
    }
  }

  const toggleChat = () => {
    setIsOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen
      if (nextIsOpen) {
        onOpen?.()
      }
      return nextIsOpen
    })
  }

  return (
    <>
      <Button
        onClick={toggleChat}
        size="lg"
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-none border-2 border-black bg-black text-white shadow-lg transition hover:bg-accent hover:text-white sm:bottom-6 sm:right-6"
        title="Open Sales Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {isOpen && (
        <Card className="fixed inset-x-2 bottom-2 top-2 z-50 flex max-h-[calc(100dvh-1rem)] w-auto flex-col rounded-none border-2 border-black shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:top-auto sm:max-h-[80dvh] sm:w-[24rem]">
          <CardHeader className="flex flex-row items-center justify-between border-b-2 border-black bg-muted/30 pb-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                Sales Intelligence Agent
              </h3>
              <p className="text-xs text-muted-foreground">Online • Ready to help</p>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleChat} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <ScrollArea className="min-h-0 flex-1 w-full">
            <div ref={scrollRef} className="flex flex-col gap-3 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  {message.role === "assistant" && (
                    <div className="h-6 w-6 rounded-none border border-black bg-muted flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-accent" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] border border-black px-3 py-2 text-sm ${
                      message.role === "assistant"
                        ? "bg-muted text-foreground"
                        : "bg-black text-white"
                    }`}
                  >
                    {getMessageText(message)}
                  </div>
                  {message.role === "user" && (
                    <div className="h-6 w-6 rounded-none border border-black bg-black flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-2 justify-start">
                  <div className="h-6 w-6 rounded-none border border-black bg-muted flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                  <div className="max-w-[85%] border border-black bg-muted px-3 py-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <CardFooter className="border-t-2 border-black p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!input.trim()) {
                  return
                }

                sendUserMessage(input)
                setInput("")
              }}
              className="flex w-full gap-2"
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your message..."
                className="flex-1 rounded-none border-2 border-black text-sm"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-none border-2 border-black bg-black text-white hover:bg-accent"
                disabled={isLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  )
}
