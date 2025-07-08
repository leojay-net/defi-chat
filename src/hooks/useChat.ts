'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChatMessage, AIAnalysisResult, TransactionData } from '@/types';
import { AIAssistant } from '@/lib/aiAssistant';
import { useWallet } from '@/contexts/WalletContext';
import { useChatHistory } from './useChatHistory';

const useChat = () => {
    const { connection } = useWallet();
    const {
        createNewSession,
        updateCurrentSession,
        loadSession,
        currentSessionId,
        currentSession
    } = useChatHistory();

    const getInitialSuggestedActions = useCallback(() => {
        if (connection.isConnected) {
            return [
                { id: 'swap', type: 'execute_swap' as const, label: 'Swap Tokens' },
                { id: 'fiat', type: 'confirm_fiat' as const, label: 'Convert to Fiat' }
            ];
        } else {
            return [
                { id: 'connect', type: 'connect_wallet' as const, label: 'Connect Wallet' },
                { id: 'swap', type: 'execute_swap' as const, label: 'Swap Tokens' },
                { id: 'fiat', type: 'confirm_fiat' as const, label: 'Convert to Fiat' }
            ];
        }
    }, [connection.isConnected]);

    // Create a stable initial message that doesn't change unless wallet connection changes
    const initialMessage = useMemo(() => ({
        id: '1',
        role: 'assistant' as const,
        content: 'Hello! I\'m your DeFi assistant. I can help you with token swaps, crypto-to-fiat conversions, and portfolio management. What would you like to do today?',
        timestamp: new Date(),
        metadata: {
            suggestedActions: getInitialSuggestedActions()
        }
    }), [getInitialSuggestedActions]);

    const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const aiAssistant = useMemo(() => new AIAssistant(), []);

    // Initialize session only once
    useEffect(() => {
        if (!isInitialized) {
            if (currentSession && currentSession.messages.length > 0) {
                // Load existing session
                setMessages(currentSession.messages);
            } else if (!currentSessionId) {
                // Create new session with initial message
                setMessages([initialMessage]);
                createNewSession([initialMessage]);
            }
            setIsInitialized(true);
        }
    }, [currentSession, currentSessionId, createNewSession, initialMessage, isInitialized]);

    // Update session whenever messages change (but only after initialization)
    useEffect(() => {
        if (isInitialized && currentSessionId && messages.length > 0) {
            updateCurrentSession(messages);
        }
    }, [messages, currentSessionId, updateCurrentSession, isInitialized]);

    const sendMessage = useCallback(async (content: string) => {
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // Use real AI analysis
            const analysis = await aiAssistant.analyzeUserMessage(content);

            // Only include transaction data if it's a valid transaction intent
            const shouldShowTransactionData = (analysis.intent === 'swap' || analysis.intent === 'fiat_conversion')
                && analysis.extractedData
                && (analysis.extractedData.tokenIn || analysis.extractedData.amountIn || analysis.extractedData.fiatAmount);

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: analysis.suggestedResponse,
                timestamp: new Date(),
                metadata: {
                    transactionData: shouldShowTransactionData ? analysis.extractedData as TransactionData : undefined,
                    suggestedActions: generateSuggestedActions(analysis),
                    confirmationRequired: analysis.intent === 'swap' || analysis.intent === 'fiat_conversion'
                }
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [aiAssistant]);

    const clearChat = useCallback(() => {
        setMessages([initialMessage]);
        // Create new session
        createNewSession([initialMessage]);
    }, [initialMessage, createNewSession]);

    const loadChatSession = useCallback((sessionId: string) => {
        const sessionMessages = loadSession(sessionId);
        if (sessionMessages) {
            setMessages(sessionMessages.length > 0 ? sessionMessages : [initialMessage]);
        }
    }, [loadSession, initialMessage]);

    // Update suggested actions when wallet connection changes (only for the first message)
    useEffect(() => {
        if (isInitialized) {
            setMessages(prevMessages => {
                if (prevMessages.length > 0 && prevMessages[0]?.id === '1') {
                    const updatedMessages = [...prevMessages];
                    updatedMessages[0] = {
                        ...updatedMessages[0],
                        metadata: {
                            ...updatedMessages[0].metadata,
                            suggestedActions: getInitialSuggestedActions()
                        }
                    };
                    return updatedMessages;
                }
                return prevMessages;
            });
        }
    }, [connection.isConnected, getInitialSuggestedActions, isInitialized]);

    return {
        messages,
        isLoading,
        sendMessage,
        clearChat,
        loadChatSession,
        currentSessionId
    };
};

function generateSuggestedActions(analysis: AIAnalysisResult) {
    const actions = [];

    // Only add transaction actions if there's actual transaction data
    if (analysis.intent === 'swap' && analysis.extractedData &&
        (analysis.extractedData.tokenIn || analysis.extractedData.tokenOut || analysis.extractedData.amountIn)) {
        actions.push({
            id: 'execute_swap',
            type: 'execute_swap' as const,
            label: 'Execute Swap',
            data: analysis.extractedData
        });
    }

    if (analysis.intent === 'fiat_conversion' && analysis.extractedData &&
        (analysis.extractedData.tokenIn || analysis.extractedData.fiatAmount || analysis.extractedData.fiatCurrency)) {
        actions.push({
            id: 'setup_fiat',
            type: 'confirm_fiat' as const,
            label: 'Setup Bank Transfer',
            data: analysis.extractedData
        });
    }

    // For general queries, provide helpful quick actions
    if (analysis.intent === 'query' || analysis.intent === 'unknown') {
        actions.push(
            { id: 'quick_swap', type: 'execute_swap' as const, label: 'Quick Swap' },
            { id: 'convert_fiat', type: 'confirm_fiat' as const, label: 'Convert to Fiat' }
        );
    }

    return actions;
}

export default useChat;
