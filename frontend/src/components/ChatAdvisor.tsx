import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
  icon?: string;
  isQuickAction?: boolean;
}

interface Suggestion {
  id: string;
  short_desc: string;
  prompt: string;
  icon: string;
}

const SESSION_KEY = 'chat_advisor_messages';

const SuggestionIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'bar-chart':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>;
    case 'pie-chart':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>;
    case 'target':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
    case 'message-circle':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>;
    case 'file-text':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
    case 'git-commit':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><line x1="3" y1="12" x2="9" y2="12"></line><line x1="15" y1="12" x2="21" y2="12"></line></svg>;
    case 'trending-up':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
    case 'columns':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path></svg>;
    default:
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>;
  }
};

/** Load messages persisted in sessionStorage (survives page refresh, not new tab). */
function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

/** Save messages to sessionStorage. */
function persistMessages(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage full or unavailable — silently ignore.
  }
}

export function ChatAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedMessages());
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Persist messages to sessionStorage whenever they change.
  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  const fetchSuggestions = useCallback(async (currentMessages: ChatMessage[]) => {
    try {
      const res = await fetch('/api/v1/chat/suggestions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ messages: currentMessages }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error("Failed to fetch suggestions", e);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      fetchSuggestions(messages);
    }
  }, [isLoading, messages, fetchSuggestions]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  /** Clear conversation — both state and sessionStorage. */
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setSuggestions([]);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const sendMessage = useCallback(async (text: string, displayContent?: string, icon?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: trimmed, 
      displayContent,
      icon,
      isQuickAction: !!displayContent
    };
    const assistantId = `a-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/v1/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2));
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + text }
                    : m
                )
              );
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Nieznany błąd';
      setError(msg);
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    sendMessage(inputValue);
    setInputValue('');
    if (textareaRef.current) {
       textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    sendMessage(suggestion.prompt, suggestion.short_desc, suggestion.icon);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-layout">
      {messages.length === 0 ? (
        <div className="chat-welcome">
          <div className="chat-welcome-header">
             <h1>Co mogę dla Ciebie zrobić?</h1>
             <p>Zadaj pytanie, a AI przeanalizuje Twój profil i doradzi następny krok w karierze.</p>
          </div>
          <div className="chat-welcome-suggestions">
            <button className="chat-suggestion-btn" onClick={() => sendMessage("Jakie są trendy na rynku pracownika w 2026?", "Jakie są trendy na rynku pracownika w 2026?", "trending-up")}>
              <span>Jakie są trendy na rynku pracownika w 2026?</span>
            </button>
            <button className="chat-suggestion-btn" onClick={() => sendMessage("Pomóż mi przygotować się do rozmowy o pracę", "Pomóż mi przygotować się do rozmowy o pracę", "message-circle")}>
              <span>Pomóż mi przygotować się do rozmowy o pracę</span>
            </button>
            <button className="chat-suggestion-btn" onClick={() => sendMessage("Przeanalizuj moje CV i doradź mi", "Przeanalizuj moje CV i doradź mi", "file-text")}>
              <span>Przeanalizuj moje CV i doradź mi</span>
            </button>
            <button className="chat-suggestion-btn" onClick={() => sendMessage("Jakie umiejętności warto rozwijać?", "Jakie umiejętności warto rozwijać?", "target")}>
              <span>Jakie umiejętności warto rozwijać?</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {/* ── "Nowa rozmowa" header bar ── */}
          <div className="chat-thread-header">
            <span className="chat-thread-title">Rozmowa z doradcą</span>
            <button
              id="new-conversation-btn"
              className="chat-new-conversation-btn"
              onClick={handleNewConversation}
              disabled={isLoading}
              title="Wyczyść rozmowę i zacznij od nowa"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 .49-3.51"></path>
              </svg>
              <span>Nowa rozmowa</span>
            </button>
          </div>

          <div className="chat-messages-inner">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message-row ${m.role}`}>
                <div className="chat-message-avatar">
                  {m.role === 'user' ? (
                    <div className="avatar user-avatar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  ) : (
                    <div className="avatar ai-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2z"></path>
                        <path d="M12 6c-3.3 0-6 2.7-6 6v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-4c0-3.3-2.7-6-6-6z"></path>
                        <path d="M12 18v4"></path>
                        <path d="M9 22h6"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <div className={`chat-message-content ${m.isQuickAction ? 'quick-action-bubble' : ''}`}>
                  {m.role === 'assistant' ? (
                    !m.content && isLoading ? (
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )
                  ) : (
                    m.isQuickAction ? (
                      <div className="user-quick-action">
                        {m.icon && <SuggestionIcon name={m.icon} />}
                        <span>{m.displayContent}</span>
                      </div>
                    ) : (
                      <div className="user-text">{m.content}</div>
                    )
                  )}
                </div>
              </div>
            ))}
            {error && (
              <div className="chat-message-row error">
                 <div className="chat-message-content alert-error">
                    Błąd: {error}
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} className="messages-end" />
          </div>
        </div>
      )}

      <div className="chat-input-area">
        {suggestions.length > 0 && !isLoading && (
          <div className="chat-suggestions-container">
            {suggestions.map((s) => (
              <button
                key={s.id}
                className="chat-suggestion-chip"
                onClick={() => handleSuggestionClick(s)}
                title={s.prompt}
              >
                <SuggestionIcon name={s.icon} />
                <span>{s.short_desc}</span>
              </button>
            ))}
          </div>
        )}
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napisz do doradcy..."
            disabled={isLoading}
            rows={1}
          />
          <button 
            className="chat-send-btn" 
            onClick={handleSend} 
            disabled={!inputValue.trim() || isLoading}
            aria-label="Wyślij"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
        <div className="chat-input-footer">
           AI może popełniać błędy. Sprawdzaj ważne informacje.
        </div>
      </div>
    </div>
  );
}
