'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import Message from './Message';

interface ChatMessagesProps {
    messages: ChatMessage[];
    onActionClick: (actionId: string, actionType: string, data?: Record<string, unknown>) => void;
}

export default function ChatMessages({ messages, onActionClick }: ChatMessagesProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
            {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                        <div className="text-lg mb-2">Welcome to DeFi Chat</div>
                        <div className="text-sm">Start a conversation to swap tokens or convert to fiat</div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
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
