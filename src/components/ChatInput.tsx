'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
    onSendMessage: (message: string) => void;
    isLoading: boolean;
    placeholder?: string;
}

export default function ChatInput({ onSendMessage, isLoading, placeholder = "Ask me anything about DeFi..." }: ChatInputProps) {
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isLoading) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800/50 bg-black/80 backdrop-blur-sm">
            <div className="flex items-end space-x-3">
                <div className="flex-1 relative">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholder}
                        disabled={isLoading}
                        className="w-full resize-none border border-gray-700/50 rounded-xl px-4 py-2 bg-gray-900/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm transition-all duration-200"
                        rows={1}
                        style={{
                            minHeight: '40px',
                            maxHeight: '100px',
                            height: 'auto'
                        }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!message.trim() || isLoading}
                    className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:scale-105 disabled:hover:scale-100"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Quick suggestion chips */}
            <div className="flex flex-wrap gap-2 mt-2">
                {['Swap ETH to USDC', 'Convert 100 USDC to NGN', 'Check my portfolio'].map((suggestion, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => setMessage(suggestion)}
                        className="px-2 py-1 text-xs bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-lg border border-gray-700/30 transition-all duration-200 hover:scale-105 backdrop-blur-sm"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>

            <div className="mt-1 text-xs text-gray-500">
                Press Enter to send, Shift+Enter for new line
            </div>
        </form>
    );
}
