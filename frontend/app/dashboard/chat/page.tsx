'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { PaperAirplaneIcon, DocumentIcon, UserCircleIcon, BackspaceIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{
    content: string
    metadata: any
  }>
}

interface Hub {
  hub_name: string
  status: string
  file_count: number
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const hubName = searchParams.get('hub') || ''
  const [hubs, setHubs] = useState<Hub[]>([])
  const [selectedHub, setSelectedHub] = useState(hubName)
  const [previousHub, setPreviousHub] = useState<string | null>(null)
  const [loadedHubs, setLoadedHubs] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHubs, setIsLoadingHubs] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHubOperationLoading, setIsHubOperationLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check authentication on page load - logout ONLY on refresh
  useEffect(() => {
    if (sessionStorage.getItem('pageLoaded')) {
      // This is a refresh, logout
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('user')
      localStorage.removeItem('loadTime')
      window.location.href = '/login'
    }
    // Mark that page has loaded
    sessionStorage.setItem('pageLoaded', 'true')
  }, [])

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(`chat_${selectedHub}`)
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages))
      } catch (e) {
        console.error('Failed to load saved messages:', e)
      }
    }
  }, [selectedHub])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0 && selectedHub) {
      localStorage.setItem(`chat_${selectedHub}`, JSON.stringify(messages))
    }
  }, [messages, selectedHub])

  useEffect(() => {
    fetchHubs()
    fetchLoadedHubs()
  }, [])

  // Auto-refresh loaded hubs every 30 seconds for synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLoadedHubs()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const switchHub = async () => {
      if (selectedHub && selectedHub !== previousHub) {
        // Unload previous hub if it exists and is different
        if (previousHub) {
          await unloadHub(previousHub)
        }
        // Load new hub
        await loadHub()
        setPreviousHub(selectedHub)
      }
    }
    switchHub()
  }, [selectedHub])

  // Check backend connection status
  const checkConnection = async () => {
    try {
      const response = await fetch('/api/health')
      setConnectionStatus(response.ok ? 'connected' : 'disconnected')
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  useEffect(() => {
    checkConnection()
    // Check connection every 60 seconds
    const interval = setInterval(checkConnection, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchHubs = async () => {
    try {
      const response = await fetch('/api/hubs')
      if (response.ok) {
        const data = await response.json()
        setHubs(data.hubs)
      }
    } catch (error) {
      console.error('Failed to fetch hubs:', error)
      toast.error('Failed to load hubs')
    } finally {
      setIsLoadingHubs(false)
    }
  }

  const loadHub = async () => {
    if (!selectedHub) return

    setIsHubOperationLoading(true)
    try {
      const response = await fetch(`/api/hubs/${selectedHub}/load`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || `Hub "${selectedHub}" loaded successfully`)
        fetchLoadedHubs() // Update loaded hubs list
        // Auto-refresh hub list to get latest status
        fetchHubs()
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Failed to load hub')
        // If load fails, clear selection
        setSelectedHub('')
        setPreviousHub(null)
      }
    } catch (error) {
      console.error('Failed to load hub:', error)
      toast.error('Failed to load hub')
      setSelectedHub('')
      setPreviousHub(null)
    } finally {
      setIsHubOperationLoading(false)
    }
  }

  const unloadHub = async (hubName: string) => {
    setIsHubOperationLoading(true)
    try {
      const response = await fetch(`/api/hubs/${hubName}/unload`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || `Hub "${hubName}" unloaded`)
        fetchLoadedHubs() // Update loaded hubs list
        fetchHubs() // Refresh hub list
        // If the unloaded hub was selected, clear selection and messages
        if (selectedHub === hubName) {
          setSelectedHub('')
          setPreviousHub(null)
          setMessages([])
          localStorage.removeItem(`chat_${hubName}`)
        }
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Failed to unload hub')
      }
    } catch (error) {
      console.error('Failed to unload hub:', error)
      toast.error('Failed to unload hub')
    } finally {
      setIsHubOperationLoading(false)
    }
  }

  const fetchLoadedHubs = async () => {
    try {
      const response = await fetch('/api/hubs/loaded/list')
      if (response.ok) {
        const data = await response.json()
        setLoadedHubs(data.loaded_hubs)
      }
    } catch (error) {
      console.error('Failed to fetch loaded hubs:', error)
    }
  }

  const clearChat = () => {
    setMessages([])
    if (selectedHub) {
      localStorage.removeItem(`chat_${selectedHub}`)
    }
    toast.success('Chat cleared')
  }

  const sendMessage = async (retryCount = 0) => {
    if (!input.trim() || !selectedHub || isLoading) return

    setError(null)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          hub_name: selectedHub,
          include_sources: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer,
          timestamp: new Date(),
          sources: data.sources,
        }
        setMessages(prev => [...prev, assistantMessage])
        // Update loaded hubs list in case backend auto-loaded the hub
        fetchLoadedHubs()
        setConnectionStatus('connected') // Reset connection status on success
      } else {
        const errorData = await response.json()
        const errorMsg = errorData.detail || 'Failed to get response'
        
        // Auto-retry logic for network errors (max 2 retries)
        if (retryCount < 2 && (errorMsg.includes('network') || errorMsg.includes('connection'))) {
          console.log(`Retrying chat request (attempt ${retryCount + 1})...`)
          setTimeout(() => sendMessage(retryCount + 1), 2000) // Retry after 2 seconds
          return
        }
        
        setError(errorMsg)
        toast.error(errorMsg)

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${errorMsg}`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMsg = 'Network error - please check your connection'
      setConnectionStatus('disconnected')
      
      // Auto-retry for network errors
      if (retryCount < 2) {
        console.log(`Retrying chat request due to network error (attempt ${retryCount + 1})...`)
        setTimeout(() => sendMessage(retryCount + 1), 3000) // Retry after 3 seconds
        return
      }
      
      setError(errorMsg)
      toast.error(errorMsg)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-secondary-200">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">AI Chat Assistant</h1>
          <p className="text-sm text-secondary-600">
            Ask questions about your documents
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center text-xs">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span className={`${
              connectionStatus === 'connected' ? 'text-green-600' :
              connectionStatus === 'disconnected' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
            </span>
          </div>
          <select
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="input-field max-w-xs"
            disabled={isLoadingHubs || isHubOperationLoading}
          >
            <option value="">Select a hub...</option>
            {hubs.map((hub) => (
              <option key={hub.hub_name} value={hub.hub_name}>
                {hub.hub_name} ({hub.file_count} files) {loadedHubs.includes(hub.hub_name) ? '●' : ''}
              </option>
            ))}
          </select>
          {isHubOperationLoading && (
            <div className="flex items-center text-sm text-secondary-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
              Processing...
            </div>
          )}
          {selectedHub && loadedHubs.includes(selectedHub) && !isHubOperationLoading && (
            <div className="flex items-center text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Hub loaded
            </div>
          )}
          {loadedHubs.length > 0 && (
            <button
              onClick={async () => {
                setIsHubOperationLoading(true)
                // Unload all loaded hubs
                const unloadPromises = loadedHubs.map(hubName => unloadHub(hubName))
                await Promise.all(unloadPromises)
                // Clear selection if current hub was unloaded
                if (selectedHub && loadedHubs.includes(selectedHub)) {
                  setSelectedHub('')
                  setPreviousHub(null)
                }
                setIsHubOperationLoading(false)
                toast.success(`Unloaded ${loadedHubs.length} hub(s)`)
              }}
              disabled={isHubOperationLoading}
              className="btn-secondary text-xs px-3 py-1 disabled:opacity-50"
              title="Unload all loaded hubs for better memory management"
            >
              Unload All ({loadedHubs.length})
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <DocumentIcon className="mx-auto h-12 w-12 text-secondary-400" />
            <h3 className="mt-2 text-sm font-medium text-secondary-900">Start a conversation</h3>
            <p className="mt-1 text-sm text-secondary-500">
              Select a hub and ask questions about your documents
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-secondary-200 text-secondary-900'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center">
                        <DocumentIcon className="w-5 h-5 text-primary-600" />
                      </div>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-secondary-200">
                        <p className="text-xs text-secondary-500 mb-2">Sources:</p>
                        <div className="space-y-2">
                          {message.sources.slice(0, 3).map((source, index) => (
                            <div key={index} className="text-xs bg-secondary-50 rounded p-2">
                              <p className="text-secondary-700 line-clamp-2">{source.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <UserCircleIcon className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-secondary-200 rounded-lg px-4 py-3 max-w-3xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center">
                  <DocumentIcon className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-secondary-200 p-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedHub ? "Ask a question about your documents..." : "Select a hub first"}
              className="w-full input-field resize-none"
              rows={3}
              disabled={!selectedHub || isLoading}
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              className="btn-secondary self-end disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear chat history"
            >
              <BackspaceIcon className="h-5 w-5" />
            </button>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !selectedHub || isLoading}
              className="btn-primary self-end disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-secondary-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}