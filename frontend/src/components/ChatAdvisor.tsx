import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
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
            <button className="chat-suggestion-btn" onClick={() => setInputValue("Jakie są trendy na rynku IT w 2026?")}>
              <span>Jakie są trendy na rynku IT w 2026?</span>
            </button>
            <button className="chat-suggestion-btn" onClick={() => setInputValue("Pomóż mi przygotować się do rozmowy o pracę")}>
              <span>Pomóż mi przygotować się do rozmowy o pracę</span>
            </button>
            <button className="chat-suggestion-btn" onClick={() => setInputValue("Przeanalizuj moje CV i doradź mi")}>
              <span>Przeanalizuj moje CV i doradź mi</span>
            </button>
            <button className="chat-suggestion-btn" onClick={() => setInputValue("Jakie umiejętności powinnam rozwijać?")}>
              <span>Jakie umiejętności powinnam rozwijać?</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-messages">
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
                <div className="chat-message-content">
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
                    <div className="user-text">{m.content}</div>
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
