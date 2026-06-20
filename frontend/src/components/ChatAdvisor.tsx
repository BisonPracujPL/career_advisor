import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  MessageSeparator,
} from '@chatscope/chat-ui-kit-react';
import { useState, useCallback } from 'react';
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
  };

  return (
    <div className="chat-page-outer">
      <div className="chat-page-header">
        <h2>Doradca Kariery AI</h2>
        <p>Zadaj pytanie, a AI przeanalizuje Twój profil i doradzi następny krok w karierze.</p>
      </div>

      <div className="chat-page-body">
        <MainContainer>
          <ChatContainer>
            <MessageList
              typingIndicator={isLoading ? <TypingIndicator content="AI pisze..." /> : null}
            >
              {messages.length === 0 && !isLoading && (
                <MessageSeparator content="Zadaj pierwsze pytanie do doradcy AI 👋" />
              )}

              {error && (
                <MessageSeparator content={`Błąd: ${error}`} />
              )}

              {messages.map((m) => (
                <Message
                  key={m.id}
                  model={{
                    message: m.content || ' ',
                    direction: m.role === 'user' ? 'outgoing' : 'incoming',
                    sender: m.role === 'user' ? 'Ty' : 'AI Doradca',
                    position: 'single',
                  }}
                >
                  {m.role === 'assistant' && (
                    <Message.CustomContent>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content || '…'}
                      </ReactMarkdown>
                    </Message.CustomContent>
                  )}
                </Message>
              ))}
            </MessageList>

            <MessageInput
              value={inputValue}
              onChange={(_html: string, _text: string, innerText: string) =>
                setInputValue(innerText)
              }
              onSend={handleSend}
              placeholder="Napisz do doradcy..."
              disabled={isLoading}
              attachButton={false}
              sendButton
            />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}
