'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import Message from './Message';

interface ChatMessagesProps {
    messages: ChatMessage[];
    onActionClick: (actionId: string, actionType: string, data?: Record<string, unknown>) => void;
    isLoading?: boolean;
}

export default function ChatMessages({ messages, onActionClick, isLoading = false }: ChatMessagesProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        // Always scroll to bottom when AI is generating or when new messages are added
        if (isLoading || messages.length > 0) {
            const timer = setTimeout(() => {
                scrollToBottom();
            }, 100); // Slightly longer delay to ensure content is rendered

            return () => clearTimeout(timer);
        }
    }, [messages, isLoading]);

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-black chat-container"
            style={{
                height: '100%',
                minHeight: '0'
            }}
        >
            {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                        <div className="text-lg mb-2">Welcome to DeFi Chat</div>
                        <div className="text-sm">Start a conversation to swap tokens or convert to fiat</div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 pb-4">
                    {messages.map((message) => (
                        <Message
                            key={message.id}
                            message={message}
                            onActionClick={onActionClick}
                        />
                    ))}
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}
