"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCircle, Send, X, Bot, User } from "lucide-react"

function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<"greeting" | "qualifying" | "recommendations">("greeting")
  const [qualifyingData, setQualifyingData] = useState({
    sector: "",
    budget: "",
    need: "",
  })

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Marhaba! Welcome to SmartSouk. I'm your AI Sales Intelligence Agent. I'm here to help you find the perfect Tunisian handcrafted products tailored to your needs. Let's start with some quick questions to match you with the right items.\n\nFirst question: What sector are you buying for? (e.g., Personal Use, Gift, Business/Resale, Interior Design)",
          },
        ],
      },
    ],
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleQualifyingQuestion = async (userResponse: string) => {
    setInput("")
    sendMessage({ text: userResponse })

    // Simulate processing the answer and moving to next question
    if (stage === "greeting") {
      setQualifyingData((prev) => ({ ...prev, sector: userResponse }))
      setStage("qualifying")
      // Next question will be asked by the API
    } else if (stage === "qualifying" && !qualifyingData.budget) {
      setQualifyingData((prev) => ({ ...prev, budget: userResponse }))
    } else if (stage === "qualifying" && !qualifyingData.need) {
      setQualifyingData((prev) => ({ ...prev, need: userResponse }))
      setStage("recommendations")
    }
  }

  const quickQuestionButtons =
    stage === "qualifying"
      ? [
          "Personal Use",
          "Gift",
          "Business/Resale",
          "Interior Design",
        ]
      : null

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl"
        title="Open Sales Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Window */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <ScrollArea className="h-96 w-full">
            <div className="flex flex-col gap-3 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${
                    message.role === "assistant" ? "justify-start" : "justify-end"
                  }`}
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
            </div>
          </ScrollArea>

          {/* Quick Answer Buttons */}
          {quickQuestionButtons && (
            <CardContent className="p-3 border-t">
              <div className="flex flex-col gap-2">
                {quickQuestionButtons.map((btn) => (
                  <Button
                    key={btn}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQualifyingQuestion(btn)}
                    disabled={isLoading}
                    className="justify-start text-left h-auto py-2"
                  >
                    {btn}
                  </Button>
                ))}
              </div>
            </CardContent>
          )}

          <CardFooter className="border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (input.trim()) {
                  sendMessage({ text: input })
                  setInput("")
                }
              }}
              className="flex w-full gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
