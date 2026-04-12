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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl"
        title="Open Sales Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                Sales Intelligence Agent
              </h3>
              <p className="text-xs text-muted-foreground">Online • Ready to help</p>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleChat} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <ScrollArea className="h-96 w-full">
            <div ref={scrollRef} className="flex flex-col gap-3 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  {message.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 max-w-xs text-sm ${
                      message.role === "assistant"
                        ? "bg-gray-100 text-gray-900"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {getMessageText(message)}
                  </div>
                  {message.role === "user" && (
                    <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-2 justify-start">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="rounded-lg px-3 py-3 max-w-xs bg-gray-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <CardFooter className="border-t p-3">
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
                className="flex-1 text-sm"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  )
}
