'use client';

import { useState } from 'react';
import { useChatHistory } from '@/hooks/useChatHistory';
import {
    History,
    MessageSquare,
    Trash2,
    Download,
    Search,
    X,
    Clock
} from 'lucide-react';

interface ChatHistorySidebarProps {
    onLoadSession: (sessionId: string) => void;
}

export default function ChatHistorySidebar({ onLoadSession }: ChatHistorySidebarProps) {
    const {
        sessions,
        currentSessionId,
        isHistoryOpen,
        setIsHistoryOpen,
        deleteSession,
        clearAllHistory,
        exportSession,
        searchSessions,
        hasHistory
    } = useChatHistory();

    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const filteredSessions = searchQuery
        ? searchSessions(searchQuery)
        : sessions;

    const handleDeleteSession = (sessionId: string) => {
        deleteSession(sessionId);
        setShowDeleteConfirm(null);
    };

    const handleExportSession = (sessionId: string) => {
        const exportData = exportSession(sessionId);
        if (exportData) {
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-session-${sessionId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    if (!isHistoryOpen) {
        return (
            <button
                onClick={() => setIsHistoryOpen(true)}
                className="fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-gray-800/90 hover:bg-gray-700/90 text-white p-3 rounded-full shadow-lg backdrop-blur-sm transition-all duration-200 border border-gray-600/50"
                title="Chat History"
            >
                <History className="w-5 h-5" />
            </button>
        );
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={() => setIsHistoryOpen(false)}
            />

            {/* Sidebar */}
            <div className="fixed left-0 top-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700/50 z-50 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <History className="w-5 h-5 text-blue-400" />
                            <h2 className="text-lg font-semibold text-white">Chat History</h2>
                        </div>
                        <button
                            onClick={() => setIsHistoryOpen(false)}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {!hasHistory ? (
                        <div className="text-center text-gray-400 py-8">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No chat history yet</p>
                            <p className="text-xs">Start a conversation to see it here</p>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No chats found</p>
                            <p className="text-xs">Try a different search term</p>
                        </div>
                    ) : (
                        filteredSessions.map((session) => (
                            <div
                                key={session.id}
                                className={`group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer ${session.id === currentSessionId
                                    ? 'bg-blue-600/20 border-blue-500/50 text-white'
                                    : 'bg-gray-800/30 border-gray-600/30 hover:bg-gray-700/50 text-gray-300'
                                    }`}
                                onClick={() => {
                                    onLoadSession(session.id);
                                    setIsHistoryOpen(false);
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-sm truncate mb-1">
                                            {session.title}
                                        </h3>
                                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatDate(session.lastUpdated)}</span>
                                            <span>•</span>
                                            <span>{session.messages.length} messages</span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleExportSession(session.id);
                                            }}
                                            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                                            title="Export chat"
                                        >
                                            <Download className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDeleteConfirm(session.id);
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                            title="Delete chat"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                {/* Delete confirmation */}
                                {showDeleteConfirm === session.id && (
                                    <div className="absolute inset-0 bg-red-900/90 rounded-lg flex items-center justify-center space-x-2">
                                        <span className="text-white text-xs">Delete?</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSession(session.id);
                                            }}
                                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                                        >
                                            Yes
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDeleteConfirm(null);
                                            }}
                                            className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                        >
                                            No
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {hasHistory && (
                    <div className="p-4 border-t border-gray-700/50">
                        <button
                            onClick={() => {
                                if (confirm('Clear all chat history? This cannot be undone.')) {
                                    clearAllHistory();
                                }
                            }}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Clear All History</span>
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
