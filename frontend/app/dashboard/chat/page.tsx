'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { PaperAirplaneIcon, DocumentIcon, UserCircleIcon, BackspaceIcon, Bars3Icon, XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { apiClient } from '@/lib/api'

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

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  // Load conversations for current hub
  const loadConversations = (hub: string) => {
    const stored = localStorage.getItem(`conversations_${hub}`)
    if (stored) {
      const parsedConversations = JSON.parse(stored).map((conv: any) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }))
      setConversations(parsedConversations)
    } else {
      setConversations([])
    }
  }

  // Save conversations for current hub
  const saveConversations = (hub: string, convs: Conversation[]) => {
    localStorage.setItem(`conversations_${hub}`, JSON.stringify(convs))
  }

  // Create new conversation
  const createNewConversation = () => {
    if (!selectedHub) return

    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const updatedConversations = [newConversation, ...conversations]
    setConversations(updatedConversations)
    setCurrentConversationId(newConversation.id)
    setMessages([])
    saveConversations(selectedHub, updatedConversations)
  }

  // Load conversation
  const loadConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      setCurrentConversationId(conversationId)
      setMessages(conversation.messages)
    }
  }

  // Update conversation with new message
  const updateConversation = (conversationId: string, newMessages: Message[]) => {
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        // Generate title from first user message
        let title = conv.title
        if (title === 'New Chat' && newMessages.length > 0) {
          const firstUserMessage = newMessages.find(m => m.role === 'user')
          if (firstUserMessage) {
            title = firstUserMessage.content.length > 50
              ? firstUserMessage.content.substring(0, 50) + '...'
              : firstUserMessage.content
          }
        }
        return {
          ...conv,
          title,
          messages: newMessages,
          updatedAt: new Date()
        }
      }
      return conv
    })
    setConversations(updatedConversations)
    if (selectedHub) {
      saveConversations(selectedHub, updatedConversations)
    }
  }

  // Delete conversation
  const deleteConversation = (conversationId: string) => {
    const updatedConversations = conversations.filter(c => c.id !== conversationId)
    setConversations(updatedConversations)
    
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null)
      setMessages([])
    }
    
    if (selectedHub) {
      saveConversations(selectedHub, updatedConversations)
    }
  }

  // Check authentication on page load - logout ONLY on actual refresh
  useEffect(() => {
    const now = Date.now()
    const lastLoad = localStorage.getItem('lastPageLoad')
    const justLoggedIn = localStorage.getItem('justLoggedIn')

    // If just logged in, clear the flag and don't check for refresh
    if (justLoggedIn) {
      localStorage.removeItem('justLoggedIn')
      localStorage.setItem('lastPageLoad', now.toString())
      return
    }

    // Check if this is an actual page refresh vs navigation
    const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const isActualRefresh = navigationType && navigationType.type === 'reload'

    if (lastLoad && isActualRefresh) {
      const timeDiff = now - parseInt(lastLoad)
      // Only logout on actual refresh, not navigation
      if (timeDiff > 3000) {
        localStorage.removeItem('isAuthenticated')
        localStorage.removeItem('user')
        localStorage.removeItem('loadTime')
        localStorage.removeItem('justLoggedIn')
        window.location.href = '/login'
        return
      }
    }

    // Update last load time for navigation tracking
    localStorage.setItem('lastPageLoad', now.toString())
  }, [])

  useEffect(() => {
    const switchHub = async () => {
      if (selectedHub && selectedHub !== previousHub) {
        // Save current conversation before switching
        if (previousHub && currentConversationId && messages.length > 0) {
          updateConversation(currentConversationId, messages)
        }
        
        // Unload previous hub if it exists and is different
        if (previousHub) {
          await unloadHub(previousHub)
        }
        
        // Load new hub
        await loadHub()
        
        // Load conversations for the new hub
        loadConversations(selectedHub)
        
        // Start fresh session - no current conversation selected
        setCurrentConversationId(null)
        setMessages([])
        
        setPreviousHub(selectedHub)
      }
    }
    switchHub()
  }, [selectedHub])

  // Save messages to localStorage when they change
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      updateConversation(currentConversationId, messages)
    }
  }, [messages, currentConversationId])

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

  // Check backend connection status
  const checkConnection = async () => {
    try {
      const response = await apiClient.get('/health')
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
      const response = await apiClient.get('/hubs')
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
      const response = await apiClient.post(`/hubs/${selectedHub}/load`)

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || `Hub "${selectedHub}" loaded successfully`)
        fetchLoadedHubs() // Update loaded hubs list
        // Auto-refresh hub list to get latest status
        fetchHubs()
        // Start fresh chat session for the loaded hub
        localStorage.removeItem(`chat_${selectedHub}`)
        setMessages([])
        setConnectionStatus('connected')
      } else {
        const error = await response.json()
        let errorMessage = 'Failed to load hub'
        if (error.detail) {
          if (Array.isArray(error.detail)) {
            errorMessage = error.detail.map((err: any) => err.msg || (typeof err.message === 'string' ? err.message : JSON.stringify(err.message))).join(', ')
          } else if (typeof error.detail === 'string') {
            errorMessage = error.detail
          } else if (error.detail.msg) {
            errorMessage = error.detail.msg
          }
        }
        toast.error(errorMessage)
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
      const response = await apiClient.post(`/hubs/${hubName}/unload`)

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || `Hub "${hubName}" unloaded`)
        fetchLoadedHubs() // Update loaded hubs list
        fetchHubs() // Refresh hub list
        // If the unloaded hub was selected, clear selection but keep conversations
        if (selectedHub === hubName) {
          setSelectedHub('')
          setPreviousHub(null)
          setMessages([])
        }
      } else {
        const error = await response.json()
        let errorMessage = 'Failed to unload hub'
        if (error.detail) {
          if (Array.isArray(error.detail)) {
            errorMessage = error.detail.map((err: any) => err.msg || (typeof err.message === 'string' ? err.message : JSON.stringify(err.message))).join(', ')
          } else if (typeof error.detail === 'string') {
            errorMessage = error.detail
          } else if (error.detail.msg) {
            errorMessage = error.detail.msg
          }
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Failed to unload hub:', error)
      toast.error('Failed to unload hub')
    } finally {
      setIsHubOperationLoading(false)
    }
  }

  const syncHub = async () => {
    if (!selectedHub) return
    setIsHubOperationLoading(true)
    try {
      const response = await apiClient.post(`/hubs/${selectedHub}/sync`)

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || 'Sync completed')
        fetchHubs() // Refresh hub list to get updated file count
      } else {
        const error = await response.json()
        let errorMessage = 'Sync failed'
        if (error.detail) {
          if (Array.isArray(error.detail)) {
            errorMessage = error.detail.map((err: any) => err.msg || (typeof err.message === 'string' ? err.message : JSON.stringify(err.message))).join(', ')
          } else if (typeof error.detail === 'string') {
            errorMessage = error.detail
          } else if (error.detail.msg) {
            errorMessage = error.detail.msg
          }
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Sync failed')
    } finally {
      setIsHubOperationLoading(false)
    }
  }

  const fetchLoadedHubs = async () => {
    try {
      const response = await apiClient.get('/hubs/loaded/list')
      if (response.ok) {
        const data = await response.json()
        setLoadedHubs(data.loaded_hubs)
      }
    } catch (error) {
      console.error('Failed to fetch loaded hubs:', error)
    }
  }

  const clearChat = () => {
    if (currentConversationId) {
      const updatedMessages: Message[] = []
      setMessages(updatedMessages)
      updateConversation(currentConversationId, updatedMessages)
      toast.success('Chat cleared')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendMessage = async (retryCount = 0) => {
    if (!input.trim() || !selectedHub || isLoading) return

    // Create new conversation if none exists
    if (!currentConversationId) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const updatedConversations = [newConversation, ...conversations]
      setConversations(updatedConversations)
      setCurrentConversationId(newConversation.id)
      saveConversations(selectedHub, updatedConversations)
    }

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
      const response = await apiClient.post('/chat', {
        query: userMessage.content,
        hub_name: selectedHub,
        include_sources: true,
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
        // Update conversation title if it's still "New Chat"
        if (currentConversationId) {
          updateConversation(currentConversationId, [...messages, userMessage, assistantMessage])
        }
        fetchLoadedHubs()
        setConnectionStatus('connected')
      } else {
        const errorData = await response.json()
        let errorMsg = 'Failed to get response'
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMsg = errorData.detail.map((err: any) => err.msg || (typeof err.message === 'string' ? err.message : JSON.stringify(err.message))).join(', ')
          } else if (typeof errorData.detail === 'string') {
            errorMsg = errorData.detail
          } else if (errorData.detail.msg) {
            errorMsg = errorData.detail.msg
          }
        }
        
        if (retryCount < 2 && (errorMsg.includes('network') || errorMsg.includes('connection'))) {
          console.log(`Retrying chat request (attempt ${retryCount + 1})...`)
          setTimeout(() => sendMessage(retryCount + 1), 2000)
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
        if (currentConversationId) {
          updateConversation(currentConversationId, [...messages, userMessage, errorMessage])
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMsg = 'Network error - please check your connection'
      setConnectionStatus('disconnected')
      
      if (retryCount < 2) {
        console.log(`Retrying chat request due to network error (attempt ${retryCount + 1})...`)
        setTimeout(() => sendMessage(retryCount + 1), 3000)
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
      if (currentConversationId) {
        updateConversation(currentConversationId, [...messages, userMessage, errorMessage])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className={`bg-white border-r border-secondary-200 transition-all duration-300 ${
        sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'
      }`}>
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary-900">Hub Controls</h2>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1 rounded-md hover:bg-secondary-100"
            >
              <XMarkIcon className="h-5 w-5 text-secondary-500" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Select Hub
              </label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full border border-secondary-300 rounded px-3 py-2 bg-white"
                disabled={isLoadingHubs}
              >
                <option value="">Select a hub...</option>
                {hubs.map((hub) => (
                  <option key={hub.hub_name} value={hub.hub_name}>
                    {hub.hub_name} ({hub.file_count} files)
                  </option>
                ))}
              </select>
            </div>

            {selectedHub && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-600">Status:</span>
                  <span className={`text-sm ${loadedHubs.includes(selectedHub) ? 'text-green-600' : 'text-secondary-500'}`}>
                    {loadedHubs.includes(selectedHub) ? 'Loaded' : 'Not Loaded'}
                  </span>
                </div>
                
                <button
                  onClick={loadHub}
                  disabled={loadedHubs.includes(selectedHub) || isHubOperationLoading}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isHubOperationLoading ? 'Loading...' : 'Load Hub'}
                </button>
                
                <button
                  onClick={() => unloadHub(selectedHub)}
                  disabled={!loadedHubs.includes(selectedHub) || isHubOperationLoading}
                  className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isHubOperationLoading ? 'Unloading...' : 'Unload Hub'}
                </button>
                
                <button
                  onClick={syncHub}
                  disabled={!loadedHubs.includes(selectedHub) || isHubOperationLoading}
                  className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isHubOperationLoading ? 'Syncing...' : 'Sync Hub'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary-900">Chat History</h2>
          </div>
          {selectedHub && (
            <div className="mt-2">
              <button
                onClick={createNewConversation}
                className="w-full btn-primary text-sm py-2"
              >
                <PlusIcon className="h-4 w-4 mr-1 inline" />
                New Chat
              </button>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {!selectedHub ? (
            <div className="p-4 text-center text-secondary-500">
              Select a hub to view conversations
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-secondary-500">
              No conversations yet. Start a new chat!
            </div>
          ) : (
            <div className="p-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                    currentConversationId === conversation.id
                      ? 'bg-primary-100 border border-primary-200'
                      : 'hover:bg-secondary-50'
                  }`}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-secondary-900 truncate">
                        {conversation.title}
                      </h3>
                      <p className="text-xs text-secondary-500 mt-1">
                        {conversation.updatedAt.toLocaleDateString()} • {conversation.messages.length} messages
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this conversation?')) {
                          deleteConversation(conversation.id)
                        }
                      }}
                      className="p-1 text-secondary-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 bg-white">
          <div className="flex items-center space-x-4">
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-md hover:bg-secondary-100"
              >
                <Bars3Icon className="h-5 w-5 text-secondary-500" />
              </button>
            )}
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <select
                  value={selectedHub}
                  onChange={(e) => setSelectedHub(e.target.value)}
                  className="text-sm border border-secondary-300 rounded px-2 py-1 bg-white"
                  disabled={isLoadingHubs}
                >
                  <option value="">Select a hub...</option>
                  {hubs.map((hub) => (
                    <option key={hub.hub_name} value={hub.hub_name}>
                      {hub.hub_name} ({hub.file_count} files)
                    </option>
                  ))}
                </select>
                {selectedHub && loadedHubs.includes(selectedHub) && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Loaded
                  </span>
                )}
              </div>
              <h1 className="text-lg font-semibold text-secondary-900">
                {currentConversationId 
                  ? conversations.find(c => c.id === currentConversationId)?.title || 'Chat'
                  : selectedHub 
                    ? 'Start a new conversation' 
                    : 'AI Chat Assistant'
                }
              </h1>
              <p className="text-sm text-secondary-600">
                {selectedHub ? 'Ask questions about your documents' : 'Select a hub to start chatting'}
              </p>
            </div>
          </div>
          
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear chat history"
          >
            <BackspaceIcon className="h-4 w-4 mr-1" />
            Clear Chat
          </button>
        </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <DocumentIcon className="mx-auto h-12 w-12 text-secondary-400" />
            <h3 className="mt-2 text-sm font-medium text-secondary-900">
              {currentConversationId ? 'Start chatting' : 'Select or create a conversation'}
            </h3>
            <p className="mt-1 text-sm text-secondary-500">
              {selectedHub 
                ? 'Ask questions about your documents' 
                : 'Select a hub first'
              }
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
                      <div className="w-8 h-8 bg-create-500 rounded-full flex items-center justify-center">
                        <DocumentIcon className="w-5 h-5 text-white" />
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
                <div className="w-8 h-8 bg-create-500 rounded-full flex items-center justify-center">
                  <DocumentIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-create-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-create-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-create-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
              placeholder={
                !selectedHub 
                  ? "Select a hub first" 
                  : !currentConversationId 
                    ? "Create or select a conversation to start chatting"
                    : "Ask a question about your documents..."
              }
              className="w-full input-field resize-none"
              rows={3}
              disabled={!selectedHub || !currentConversationId || isLoading}
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
              onClick={() => sendMessage()}
              disabled={!input.trim() || !selectedHub || !currentConversationId || isLoading}
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
    </div>
  )
}