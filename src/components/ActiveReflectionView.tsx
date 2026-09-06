import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Send,
  User,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Clock,
  Tag,
  ArrowLeft,
  FileCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Edit2,
} from 'lucide-react';
import type { JournalSession, SessionMessage, SessionSummary } from '../types';

interface ActiveReflectionViewProps {
  session: JournalSession;
  messages: SessionMessage[];
  isSending: boolean;
  isSummarizing: boolean;
  error: string | null;
  onClearError: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onSummarize: () => Promise<void>;
  onUpdateSession: (updates: { title?: string; tags?: string[] }) => Promise<void>;
  onSaveAndExit: () => void;
}

export const ActiveReflectionView: React.FC<ActiveReflectionViewProps> = ({
  session,
  messages,
  isSending,
  isSummarizing,
  error,
  onClearError,
  onSendMessage,
  onSummarize,
  onUpdateSession,
  onSaveAndExit,
}) => {
  const [inputText, setInputText] = useState('');
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(session.title);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [showSummaryCard, setShowSummaryCard] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  // Keep title input in sync if session changes
  useEffect(() => {
    setTitleInput(session.title);
  }, [session.title]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTitleSubmit = async () => {
    if (!titleInput.trim() || titleInput === session.title) {
      setIsEditingTitle(false);
      return;
    }
    await onUpdateSession({ title: titleInput.trim() });
    setIsEditingTitle(false);
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim()) {
      setIsAddingTag(false);
      return;
    }
    const cleanTag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (cleanTag && !session.tags?.includes(cleanTag)) {
      const updatedTags = [...(session.tags || []), cleanTag];
      await onUpdateSession({ tags: updatedTags });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = (session.tags || []).filter((t) => t !== tagToRemove);
    await onUpdateSession({ tags: updatedTags });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending) return;
    const textToSend = inputText.trim();
    onClearError();
    setLastFailedInput(textToSend);

    try {
      await onSendMessage(textToSend);
      setInputText('');
      setLastFailedInput(null);
    } catch {
      // Error handled by parent; message is kept in lastFailedInput
    }
  };

  const handleRetry = () => {
    if (lastFailedInput) {
      setInputText(lastFailedInput);
      onClearError();
    }
  };

  // Parse structured summary if available
  let parsedSummary: SessionSummary | null = null;
  if (session.summary) {
    try {
      if (typeof session.summary === 'string' && session.summary.startsWith('{')) {
        parsedSummary = JSON.parse(session.summary);
      } else {
        parsedSummary = {
          headline: session.summary,
          coreThemes: ['Reflection'],
          keyTakeaways: ['Insightful session'],
          actionableHorizon: 'Continue your mindful habits.',
        };
      }
    } catch {
      parsedSummary = null;
    }
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-60px)] bg-[#FAFAFA] overflow-hidden">
      {/* Top Header Controls Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-200/90 bg-white flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <button
            id="session-save-exit-btn"
            onClick={onSaveAndExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Save &amp; Exit</span>
          </button>

          {/* Editable Title */}
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  id="session-title-edit-input"
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSubmit();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="px-2 py-1 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <button
                  onClick={handleTitleSubmit}
                  className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-1.5 group cursor-pointer"
                title="Click to edit session title"
              >
                <h2 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-1 tracking-tight">
                  {session.title || 'Untitled Reflection'}
                </h2>
                <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        {/* Tags & Summary Actions */}
        <div className="flex items-center gap-2">
          {/* Tags list */}
          <div className="hidden sm:flex items-center gap-1.5">
            {session.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-600 cursor-pointer text-slate-400"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <input
                id="new-tag-input"
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onBlur={handleAddTag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                  if (e.key === 'Escape') setIsAddingTag(false);
                }}
                placeholder="tag..."
                autoFocus
                className="w-16 px-1.5 py-0.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none"
              />
            ) : (
              <button
                id="add-tag-btn"
                onClick={() => setIsAddingTag(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Tag</span>
              </button>
            )}
          </div>

          {/* Generate Summary Button */}
          <button
            id="session-generate-summary-btn"
            onClick={onSummarize}
            disabled={isSummarizing || messages.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSummarizing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                <span>Summarizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{session.summary ? 'Regenerate Summary' : 'Generate Summary'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Structured Summary Card (if generated) */}
          {parsedSummary && (
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-amber-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>Structured Session Summary</span>
                </div>
                <button
                  onClick={() => setShowSummaryCard(!showSummaryCard)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showSummaryCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showSummaryCard && (
                <div className="space-y-3.5">
                  <h3 className="text-base font-bold text-slate-900">
                    "{parsedSummary.headline}"
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="font-bold text-slate-800 block mb-1.5">Core Themes:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                        {parsedSummary.coreThemes.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="font-bold text-slate-800 block mb-1.5">Key Takeaways:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                        {parsedSummary.keyTakeaways.map((k, idx) => (
                          <li key={idx}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-950">
                    <strong>Actionable Horizon:</strong> {parsedSummary.actionableHorizon}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Conversation Messages */}
          {messages.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs my-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Your reflection canvas is ready</h3>
              <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                What is currently on your mind? Share thoughts on a challenge, a recent win, an unresolved decision, or a general feeling. Gemini will listen and provide supportive reflections.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-xs">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 text-sm ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-xs shadow-xs'
                        : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2 text-xs">
                      <span className={`font-semibold ${isUser ? 'text-slate-300' : 'text-slate-800'}`}>
                        {isUser ? 'You' : 'Gemini AI'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                        {!isUser && (
                          <button
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    ) : (
                      <div className="markdown-body prose prose-slate max-w-none text-sm leading-relaxed prose-headings:font-bold prose-headings:text-slate-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 mt-1 font-semibold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Real-time Typing / Loading indicator */}
          {isSending && (
            <div className="flex gap-3 sm:gap-4 justify-start">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-xs">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              </div>
              <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 text-xs text-slate-600 shadow-xs flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                <span>Gemini is contemplating your thoughts and formulating insights...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error Banner with Retry Option */}
      {error && (
        <div className="px-6 py-2.5 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-3">
            {lastFailedInput && (
              <button
                onClick={handleRetry}
                className="font-bold underline hover:text-rose-900 cursor-pointer"
              >
                Restore Input &amp; Retry
              </button>
            )}
            <button
              onClick={onClearError}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Multi-turn Chat Input Bar */}
      <div className="p-3.5 sm:p-4 border-t border-slate-200/90 bg-white flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              id="chat-message-textarea"
              rows={2}
              maxLength={8000}
              placeholder="Type your reflection or response... (Gemini keeps full multi-turn context)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isSending}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none leading-relaxed transition-all"
            />
            <div className="absolute right-3 bottom-2 text-[10px] text-slate-400">
              {inputText.length} / 8000
            </div>
          </div>

          <button
            id="send-message-btn"
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`p-3 rounded-xl transition-all shadow-xs cursor-pointer ${
              !inputText.trim() || isSending
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-sm'
            }`}
            title="Send Reflection"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-2 max-w-3xl mx-auto">
          Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Shift + Enter</kbd> for a new line. Content is encrypted and isolated to your UID.
        </p>
      </div>
    </div>
  );
};
