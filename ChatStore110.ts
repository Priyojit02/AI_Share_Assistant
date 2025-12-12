import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { Chat, Message, Agent, ChatCreateRequest, JobResponse, API_BASE_URL } from '@/lib/api';
import { generateChatTitle } from '@/lib/utils';

// Chat mode types
export type ChatMode = 'normal' | 'agent';

interface ChatState {
  // Data
  chats: Chat[];
  currentChatId: string | null;
  models: Record<string, string[]>;
  agents: Agent[];
  
  // Selected config
  selectedProvider: string;
  selectedModel: string;
  selectedAgentId: string | null;
  chatMode: ChatMode;
  
  // Loading states (per chat)
  loadingChatId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  currentJob: JobResponse | null;
  
  // Connection status
  isConnected: boolean;
  connectionError: string | null;
  
  // Streaming control
  streamingCleanup: (() => void) | null;
  stopStreaming: () => void;
  startJobPolling: (chatId: string, jobId: string) => void;
  restartJobStreaming: (chatId: string, jobId: string) => void;
  
  // Actions
  fetchModels: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  createChat: (config?: Partial<ChatCreateRequest>) => Promise<Chat>;
  setCurrentChat: (chatId: string | null) => void;
  deleteChat: (chatId: string) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateLastMessage: (chatId: string, content: string) => void;
  removeMessagesFromIndex: (chatId: string, startIndex: number) => void;
  sendMessage: (content: string) => Promise<void>;
  setSelectedProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedAgentId: (agentId: string | null) => void;
  setChatMode: (mode: ChatMode) => void;
  clearChats: () => void;
  syncChatsFromBackend: () => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      chats: [],
      currentChatId: null,
      models: {},
      agents: [],
      selectedProvider: '',
      selectedModel: '',
      selectedAgentId: null,
      chatMode: 'normal',
      loadingChatId: null,
      isLoading: false,
      isStreaming: false,
      currentJob: null,
      isConnected: false,
      connectionError: null,
      
      // Streaming control
      streamingCleanup: null as (() => void) | null,

      // Stop streaming function
      stopStreaming: () => {
        const { streamingCleanup, loadingChatId } = get();
        if (streamingCleanup) {
          streamingCleanup();
          set({ 
            streamingCleanup: null, 
            isStreaming: false, 
            loadingChatId: null,
            currentJob: null 
          });
        }
      },

      // Start polling for job status updates
      startJobPolling: (chatId: string, jobId: string) => {
        // Set loading state to show the job is still active
        set({ loadingChatId: chatId, isLoading: true });
        
        let pollTimeout: NodeJS.Timeout | null = null;
        
        const poll = async () => {
          try {
            const status = await api.getJobStatus(jobId);
            
            if (status.status === 'completed') {
              const { chats, agents } = get();
              const chat = chats.find(c => c.id === chatId);
              if (!chat) return;

              const agentName = (() => {
                const agentId = chat.agent_id || undefined;
                const match = agentId ? agents.find(a => a.id === agentId) : undefined;
                if (match?.name) return match.name;
                if (agentId) return agentId;
                return 'agent';
              })();

              let finalMessage = status.result_message || 'Completed';
              if (status.output_docx_url) {
                const docxUrl = status.output_docx_url.startsWith('http') 
                  ? status.output_docx_url 
                  : `${API_BASE_URL}${status.output_docx_url}`;
                finalMessage += `\n\n📄 [Download Technical Specification Document (${agentName})](${docxUrl})`;
              }
              
              const updatedChats = chats.map(c => {
                if (c.id === chatId) {
                  const lastMessage = c.messages[c.messages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    // Update the existing assistant message
                    const updatedMessages = [...c.messages];
                    updatedMessages[updatedMessages.length - 1] = {
                      ...lastMessage,
                      content: finalMessage,
                      timestamp: new Date().toISOString()
                    };
                    return { ...c, messages: updatedMessages };
                  } else {
                    // Add new assistant message
                    return { ...c, messages: [...c.messages, { role: 'assistant' as const, content: finalMessage, timestamp: new Date().toISOString() }] };
                  }
                }
                return c;
              });
              
              set({ 
                chats: updatedChats,
                loadingChatId: null, 
                isLoading: false, 
                isStreaming: false, 
                currentJob: null,
                streamingCleanup: null
              });
              return;
            } else if (status.status === 'failed') {
              const { chats } = get();
              const updatedChats = chats.map(c => {
                if (c.id === chatId) {
                  const lastMessage = c.messages[c.messages.length - 1];
                  const errorMessage = `❌ Error: ${status.error || 'Job failed'}`;
                  if (lastMessage && lastMessage.role === 'assistant') {
                    // Update the existing assistant message with error
                    const updatedMessages = [...c.messages];
                    updatedMessages[updatedMessages.length - 1] = {
                      ...lastMessage,
                      content: errorMessage,
                      timestamp: new Date().toISOString()
                    };
                    return { ...c, messages: updatedMessages };
                  } else {
                    // Add new error message
                    return { ...c, messages: [...c.messages, { role: 'assistant' as const, content: errorMessage, timestamp: new Date().toISOString() }] };
                  }
                }
                return c;
              });
              
              set({ 
                chats: updatedChats,
                loadingChatId: null, 
                isLoading: false, 
                isStreaming: false, 
                currentJob: null,
                streamingCleanup: null
              });
              return;
            } else if (status.status === 'running' || status.status === 'queued') {
              // Update job status and continue polling
              set({ currentJob: { ...status, job_id: jobId, chat_id: chatId } });
              pollTimeout = setTimeout(poll, 1000);
            }
          } catch (error) {
            console.error('Polling error:', error);
            set({ 
              loadingChatId: null, 
              isLoading: false, 
              isStreaming: false, 
              currentJob: null,
              streamingCleanup: null
            });
          }
        };
        
        // Start polling
        poll();
        
        // Store the cleanup function
        set({ streamingCleanup: () => {
          if (pollTimeout) {
            clearTimeout(pollTimeout);
          }
        } });
      },

      // Restart streaming for an active job (when tab becomes visible)
      restartJobStreaming: (chatId: string, jobId: string) => {
        // First stop any existing streaming or polling
        const { stopStreaming } = get();
        if (stopStreaming) {
          stopStreaming();
        }

        const { chats, agents } = get();
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;

        const agentName = (() => {
          const agentId = chat.agent_id || undefined;
          const match = agentId ? agents.find(a => a.id === agentId) : undefined;
          if (match?.name) return match.name;
          if (agentId) return agentId;
          return 'agent';
        })();

        // Set streaming state
        set({ loadingChatId: chatId, isLoading: false, isStreaming: true });

        // Restart EventSource streaming
        const cleanup = api.streamJobEvents(
          jobId,
          (data) => {
            // Update the last assistant message with streaming data
            const { chats, updateLastMessage } = get();
            const chat = chats.find(c => c.id === chatId);
            const lastMsg = chat?.messages[chat.messages.length - 1];
            if (lastMsg?.role === 'assistant') {
              // Parse the data to get the content
              try {
                const parsed = JSON.parse(data);
                if (parsed.result && parsed.result.text) {
                  updateLastMessage(chatId, parsed.result.text);
                } else if (parsed.message) {
                  updateLastMessage(chatId, parsed.message);
                }
              } catch {
                // If not JSON, treat as raw text
                updateLastMessage(chatId, data);
              }
            }
            // Keep status as running during streaming
            set((state) => ({ 
              currentJob: state.currentJob ? { ...state.currentJob, status: 'running' } : null 
            }));
          },
          (result) => {
            // Clear cleanup function when streaming completes
            set({ streamingCleanup: null });
            
            if (result.status === 'completed' && result.result) {
              // Update to completed status
              set((state) => ({ 
                currentJob: state.currentJob ? { ...state.currentJob, status: 'completed' } : null 
              }));
              
              let finalMessage = result.result.result_message || result.result.text || result.result.message || result.result;
              
              // If DOCX was generated, append download link
              const docxPath = result.result.output_docx_path;
              const docxUrlField = (result.result as any).output_docx_url as string | undefined;
              if (docxPath || docxUrlField) {
                const docxUrl = docxUrlField
                  ? (docxUrlField.startsWith('http') ? docxUrlField : `${API_BASE_URL}${docxUrlField}`)
                  : `${API_BASE_URL}/jobs/${jobId}/docx`;
                finalMessage += `\n\n📄 [Download Technical Specification Document (${agentName})](${docxUrl})`;
              }
              
              const { chats, updateLastMessage, addMessage } = get();
              const chat = chats.find(c => c.id === chatId);
              const lastMsg = chat?.messages[chat.messages.length - 1];
              if (lastMsg?.role === 'assistant') {
                updateLastMessage(chatId, finalMessage);
              } else {
                addMessage(chatId, { role: 'assistant', content: finalMessage, timestamp: new Date().toISOString() });
              }
              
              // Clear job after 3 seconds
              setTimeout(() => {
                set({ currentJob: null });
              }, 3000);
            } else if (result.status === 'failed') {
              set((state) => ({ 
                currentJob: state.currentJob ? { ...state.currentJob, status: 'failed', error: result.error } : null 
              }));
              const errorMsg = `❌ Error: ${result.error || 'Job failed'}`;
              const { chats, updateLastMessage, addMessage } = get();
              const chat = chats.find(c => c.id === chatId);
              const lastMsg = chat?.messages[chat.messages.length - 1];
              if (lastMsg?.role === 'assistant') {
                updateLastMessage(chatId, errorMsg);
              } else {
                addMessage(chatId, { role: 'assistant', content: errorMsg, timestamp: new Date().toISOString() });
              }
              
              // Clear job after 3 seconds
              setTimeout(() => {
                set({ currentJob: null });
              }, 3000);
            }
            set({ loadingChatId: null, isLoading: false, isStreaming: false });
          },
          (error) => {
            // Clear cleanup function on error
            set({ streamingCleanup: null });
            console.warn('SSE failed when restarting, falling back to polling:', error);
            // Fall back to polling
            const { startJobPolling } = get();
            if (startJobPolling) {
              startJobPolling(chatId, jobId);
            }
          }
        );
        
        // Store the cleanup function
        set({ streamingCleanup: cleanup });
      },

      // Fetch available models from /meta/models
      fetchModels: async () => {
        try {
          const response = await api.getModels();
          const models = response.data;
          set({ models, isConnected: true, connectionError: null });
          
          // Set default provider and model if not set
          const { selectedProvider, selectedModel } = get();
          if (!selectedProvider && Object.keys(models).length > 0) {
            const defaultProvider = Object.keys(models)[0];
            const defaultModel = models[defaultProvider]?.[0] || '';
            set({ 
              selectedProvider: defaultProvider, 
              selectedModel: defaultModel 
            });
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
          set({ 
            isConnected: false, 
            connectionError: 'Failed to connect to backend. Make sure the server is running on port 8000.' 
          });
        }
      },

      // Fetch available agents from /meta/agents
      fetchAgents: async () => {
        try {
          const response = await api.getAgents();
          set({ agents: response.data });
        } catch (error) {
          console.error('Failed to fetch agents:', error);
        }
      },

      // Sync chats from backend /chats
      syncChatsFromBackend: async () => {
        try {
          const backendChats = await api.listChats();
          const formattedChats: Chat[] = backendChats.map(c => ({
            id: c.id,
            title: c.title,
            provider: c.provider,
            model: c.model,
            agent_id: c.agent_id,
            messages: c.messages || [],
          }));
          set({ chats: formattedChats });
        } catch (error) {
          console.error('Failed to sync chats:', error);
        }
      },

      // Create a new chat via POST /chats
      createChat: async (config) => {
        const { selectedProvider, selectedModel, selectedAgentId, chatMode, chats } = get();
        
        const chatConfig: ChatCreateRequest = {
          provider: config?.provider || selectedProvider,
          model: config?.model || selectedModel,
          agent_id: chatMode === 'agent' ? (config?.agent_id || selectedAgentId) : null,
          title: config?.title || 'New Chat',
        };

        try {
          const response = await api.createChat(chatConfig);
          
          const newChat: Chat = {
            id: response.id,
            title: response.title,
            provider: response.provider,
            model: response.model,
            agent_id: response.agent_id,
            messages: response.messages || [],
          };

          set({ 
            chats: [newChat, ...chats], 
            currentChatId: newChat.id 
          });
          
          return newChat;
        } catch (error) {
          console.error('Failed to create chat:', error);
          throw error;
        }
      },

      // Set current chat
      setCurrentChat: (chatId) => {
        set({ currentChatId: chatId });
      },

      // Delete a chat (local only for now)
      deleteChat: (chatId) => {
        const { chats, currentChatId } = get();
        const filteredChats = chats.filter(c => c.id !== chatId);
        
        set({ 
          chats: filteredChats,
          currentChatId: currentChatId === chatId 
            ? (filteredChats[0]?.id || null) 
            : currentChatId,
        });
      },

      // Add message to chat
      addMessage: (chatId, message) => {
        const { chats } = get();
        const updatedChats = chats.map(chat => {
          if (chat.id === chatId) {
            const messages = [...chat.messages, message];
            // Update title if it's the first user message
            const title = chat.messages.length === 0 && message.role === 'user'
              ? generateChatTitle(message.content)
              : chat.title;
            return { ...chat, messages, title };
          }
          return chat;
        });
        set({ chats: updatedChats });
      },

      // Remove messages from a specific index onwards
      removeMessagesFromIndex: (chatId, startIndex) => {
        const { chats } = get();
        const updatedChats = chats.map(chat => {
          if (chat.id === chatId) {
            const messages = chat.messages.slice(0, startIndex);
            return { ...chat, messages };
          }
          return chat;
        });
        set({ chats: updatedChats });
      },

      // Update the last message (for streaming)
      updateLastMessage: (chatId, content) => {
        const { chats } = get();
        const updatedChats = chats.map(chat => {
          if (chat.id === chatId && chat.messages.length > 0) {
            const messages = [...chat.messages];
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              content,
            };
            return { ...chat, messages };
          }
          return chat;
        });
        set({ chats: updatedChats });
      },

      // Send a message - handles both NORMAL and AGENT modes
      sendMessage: async (content) => {
        const { currentChatId, createChat, addMessage, updateLastMessage, chatMode, chats, selectedAgentId, agents } = get();
        
        let chatId = currentChatId;
        let currentChat = chats.find(c => c.id === chatId);
        
        // Ensure we have a chat; if none, create one using current mode/config
        if (!chatId) {
          const chat = await createChat();
          chatId = chat.id;
          currentChat = chat;
        }

        // Re-evaluate agent mode: either chat already has agent_id OR user is in agent mode
        const isAgentModePreferred = chatMode === 'agent' || (currentChat?.agent_id ?? null) !== null;

        // If agent mode is expected but the current chat lacks an agent_id, start a fresh agent chat
        if (isAgentModePreferred && (!currentChat || currentChat.agent_id == null)) {
          const agentChat = await createChat({ agent_id: selectedAgentId || undefined });
          chatId = agentChat.id;
          currentChat = agentChat;
        }

        // Add user message
        const userMessage: Message = {
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        };
        addMessage(chatId, userMessage);

        // Add empty assistant message first to show streaming cursor
        addMessage(chatId, { role: 'assistant', content: '', timestamp: new Date().toISOString() });

        // Set loading to false but keep streaming true for cursor
        set({ loadingChatId: chatId, isLoading: false, isStreaming: true });

        const agentName = (() => {
          const agentId = currentChat?.agent_id || selectedAgentId || undefined;
          const match = agentId ? agents.find(a => a.id === agentId) : undefined;
          if (match?.name) return match.name;
          if (agentId) return agentId; // fallback to id if display name not loaded yet
          return 'agent';
        })();

        try {
          // Check if chat has agent_id (agent mode) or not (normal mode)
          const isAgentMode = currentChat?.agent_id != null;

          if (isAgentMode) {
            // ==========================================
            // AGENT MODE - Use /jobs/{chat_id} endpoint
            // ==========================================
            const job = await api.createJob(chatId, content);
            set({ currentJob: { ...job, status: 'queued' } });

            const jobId = job.job_id;
            if (!jobId) throw new Error('No job ID received');

            // Update to running status
            set({ currentJob: { ...job, status: 'running' } });

            // Stream events via SSE
            let fullResponse = '';
            
            const cleanup = api.streamJobEvents(
              jobId,
              (data) => {
                fullResponse += data + '\n';
                if (fullResponse.trim()) {
                  const { chats } = get();
                  const chat = chats.find(c => c.id === chatId);
                  const lastMsg = chat?.messages[chat.messages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updateLastMessage(chatId!, fullResponse);
                  } else {
                    addMessage(chatId!, { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() });
                  }
                }
                // Keep status as running during streaming
                set((state) => ({ 
                  currentJob: state.currentJob ? { ...state.currentJob, status: 'running' } : null 
                }));
              },
              (result) => {
                // Clear cleanup function when streaming completes
                set({ streamingCleanup: null });
                
                if (result.status === 'completed' && result.result) {
                  // Update to completed status
                  set((state) => ({ 
                    currentJob: state.currentJob ? { ...state.currentJob, status: 'completed' } : null 
                  }));
                  
                  let finalMessage = result.result.result_message || result.result.text || result.result.message || result.result;
                  
                  // If DOCX was generated, append download link
                  const docxPath = result.result.output_docx_path;
                  const docxUrlField = (result.result as any).output_docx_url as string | undefined;
                  if (docxPath || docxUrlField) {
                    const docxUrl = docxUrlField
                      ? (docxUrlField.startsWith('http') ? docxUrlField : `${API_BASE_URL}${docxUrlField}`)
                      : `${API_BASE_URL}/jobs/${jobId}/docx`;
                    finalMessage += `\n\n📄 [Download Technical Specification Document (${agentName})](${docxUrl})`;
                  }
                  
                  const { chats } = get();
                  const chat = chats.find(c => c.id === chatId);
                  const lastMsg = chat?.messages[chat.messages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updateLastMessage(chatId!, finalMessage);
                  } else {
                    addMessage(chatId!, { role: 'assistant', content: finalMessage, timestamp: new Date().toISOString() });
                  }
                  
                  // Clear job after 3 seconds
                  setTimeout(() => {
                    set({ currentJob: null });
                  }, 3000);
                } else if (result.status === 'failed') {
                  set((state) => ({ 
                    currentJob: state.currentJob ? { ...state.currentJob, status: 'failed', error: result.error } : null 
                  }));
                  const errorMsg = `❌ Error: ${result.error || 'Job failed'}`;
                  const { chats } = get();
                  const chat = chats.find(c => c.id === chatId);
                  const lastMsg = chat?.messages[chat.messages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updateLastMessage(chatId!, errorMsg);
                  } else {
                    addMessage(chatId!, { role: 'assistant', content: errorMsg, timestamp: new Date().toISOString() });
                  }
                  
                  // Clear job after 3 seconds
                  setTimeout(() => {
                    set({ currentJob: null });
                  }, 3000);
                }
                set({ loadingChatId: null, isLoading: false, isStreaming: false });
              },
              (error) => {
                // Clear cleanup function on error
                set({ streamingCleanup: null });
                console.warn('SSE failed, falling back to polling:', error);
                pollJobStatus(jobId, chatId!);
              }
            );
            
            // Store the cleanup function
            set({ streamingCleanup: cleanup });
          } else {
            // ==========================================
            // NORMAL MODE - Use /chats/{chat_id}/message with simulated streaming
            // ==========================================
            const response = await api.sendMessage(chatId, content);
            const fullMessage = response.message;

            // Add empty assistant message first to show streaming cursor
            addMessage(chatId, { role: 'assistant', content: '', timestamp: new Date().toISOString() });

            // Set loading to false but keep streaming true for cursor
            set({ isLoading: false });

            // Simulate streaming by revealing text in blazing fast chunks
            // Stream at maximum speed regardless of tab visibility using requestAnimationFrame
            let currentContent = '';
            let charIndex = 0;
            const chars = fullMessage.split('');
            let animationFrameId: number | null = null;
            const CHARS_PER_FRAME = 10; // Stream 10 characters per animation frame for blazing speed

            const streamNextChunk = () => {
              if (charIndex < chars.length) {
                // Stream multiple characters per frame for maximum speed
                const endIndex = Math.min(charIndex + CHARS_PER_FRAME, chars.length);
                currentContent += chars.slice(charIndex, endIndex).join('');
                updateLastMessage(chatId, currentContent);
                charIndex = endIndex;

                // Use requestAnimationFrame for smooth, high-performance streaming
                animationFrameId = requestAnimationFrame(streamNextChunk);
              } else {
                set({ loadingChatId: null, isStreaming: false });
              }
            };

            // Start streaming
            streamNextChunk();

            // Store cleanup function for normal mode streaming
            const cleanup = () => {
              if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
              }
              set({ loadingChatId: null, isStreaming: false });
            };
            set({ streamingCleanup: cleanup });
          }
          
        } catch (error) {
          console.error('Failed to send message:', error);
          const errorMsg = `❌ Error: ${error instanceof Error ? error.message : 'Failed to send message'}`;
          addMessage(chatId!, { role: 'assistant', content: errorMsg, timestamp: new Date().toISOString() });
          set({ 
            loadingChatId: null, 
            isLoading: false, 
            isStreaming: false, 
            currentJob: null,
            streamingCleanup: null 
          });
        }

        // Polling fallback for agent mode
        async function pollJobStatus(jobId: string, chatId: string) {
          const maxAttempts = 86400; // 24 hours (86400 seconds)
          let attempts = 0;

          const poll = async () => {
            try {
              const status = await api.getJobStatus(jobId);
              
              if (status.status === 'completed') {
                let finalMessage = status.result_message || 'Completed';
                if (status.output_docx_url) {
                  // Ensure full URL to backend
                  const docxUrl = status.output_docx_url.startsWith('http') 
                    ? status.output_docx_url 
                    : `${API_BASE_URL}${status.output_docx_url}`;
                  finalMessage += `\n\n📄 [Download Technical Specification Document (${agentName})](${docxUrl})`;
                }
                const { chats } = get();
                const chat = chats.find(c => c.id === chatId);
                const lastMsg = chat?.messages[chat.messages.length - 1];
                if (lastMsg?.role === 'assistant') {
                  updateLastMessage(chatId, finalMessage);
                } else {
                  addMessage(chatId, { role: 'assistant', content: finalMessage, timestamp: new Date().toISOString() });
                }
                set({ loadingChatId: null, isLoading: false, isStreaming: false, currentJob: null });
                return;
              } else if (status.status === 'failed') {
                const errorMsg = `❌ Error: ${status.error || 'Job failed'}`;
                const { chats } = get();
                const chat = chats.find(c => c.id === chatId);
                const lastMsg = chat?.messages[chat.messages.length - 1];
                if (lastMsg?.role === 'assistant') {
                  updateLastMessage(chatId, errorMsg);
                } else {
                  addMessage(chatId, { role: 'assistant', content: errorMsg, timestamp: new Date().toISOString() });
                }
                set({ loadingChatId: null, isLoading: false, isStreaming: false, currentJob: null });
                return;
              }

              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(poll, 1000);
              } else {
                const errorMsg = '❌ Error: Request timed out';
                const { chats } = get();
                const chat = chats.find(c => c.id === chatId);
                const lastMsg = chat?.messages[chat.messages.length - 1];
                if (lastMsg?.role === 'assistant') {
                  updateLastMessage(chatId, errorMsg);
                } else {
                  addMessage(chatId, { role: 'assistant', content: errorMsg, timestamp: new Date().toISOString() });
                }
                set({ loadingChatId: null, isLoading: false, isStreaming: false, currentJob: null });
              }
            } catch (error) {
              console.error('Polling error:', error);
              set({ loadingChatId: null, isLoading: false, isStreaming: false, currentJob: null });
            }
          };

          poll();
        }
      },

      // Set provider and auto-select first model - starts new session if active chat has messages
      setSelectedProvider: (provider) => {
        const { models, currentChatId, chats, selectedProvider } = get();
        const defaultModel = models[provider]?.[0] || '';
        
        // Check if provider actually changed
        if (provider !== selectedProvider) {
          const currentChat = currentChatId ? chats.find(c => c.id === currentChatId) : null;
          const hasActiveChat = currentChat && currentChat.messages.length > 0;
          
          // Clear current chat to start new session if there's an active chat with messages
          if (hasActiveChat) {
            set({ selectedProvider: provider, selectedModel: defaultModel, currentChatId: null });
          } else {
            set({ selectedProvider: provider, selectedModel: defaultModel });
          }
        }
      },

      // Set model - starts new session if active chat has messages
      setSelectedModel: (model) => {
        const { currentChatId, chats, selectedModel } = get();
        
        // Check if model actually changed
        if (model !== selectedModel) {
          const currentChat = currentChatId ? chats.find(c => c.id === currentChatId) : null;
          const hasActiveChat = currentChat && currentChat.messages.length > 0;
          
          // Clear current chat to start new session if there's an active chat with messages
          if (hasActiveChat) {
            set({ selectedModel: model, currentChatId: null });
          } else {
            set({ selectedModel: model });
          }
        }
      },

      // Set agent (null for normal chat) - starts new session if active chat has messages
      setSelectedAgentId: (agentId) => {
        const { currentChatId, chats, selectedAgentId } = get();
        
        // Check if agent actually changed
        if (agentId !== selectedAgentId) {
          const currentChat = currentChatId ? chats.find(c => c.id === currentChatId) : null;
          const hasActiveChat = currentChat && currentChat.messages.length > 0;
          
          // Clear current chat to start new session if there's an active chat with messages
          if (hasActiveChat) {
            set({ selectedAgentId: agentId, currentChatId: null });
          } else {
            set({ selectedAgentId: agentId });
          }
        }
      },

      // Set chat mode - auto-creates new chat if switching modes with active chat
      setChatMode: (mode) => {
        const { currentChatId, chats, chatMode } = get();
        const currentChat = currentChatId ? chats.find(c => c.id === currentChatId) : null;
        
        // Check if we're switching modes AND have an active chat with messages
        const isSwitchingModes = mode !== chatMode;
        const hasActiveChat = currentChat && currentChat.messages.length > 0;
        
        // Update the mode first
        set({ chatMode: mode });
        
        // If switching modes with an active chat, clear current chat to force new one
        if (isSwitchingModes && hasActiveChat) {
          set({ currentChatId: null });
        }
      },

      // Clear all chats
      clearChats: () => {
        set({ chats: [], currentChatId: null });
      },
    }),
    {
      name: 'chatai-storage',
      partialize: (state) => ({
        chats: state.chats,
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
        selectedAgentId: state.selectedAgentId,
        chatMode: state.chatMode,
      }),
    }
  )
);
