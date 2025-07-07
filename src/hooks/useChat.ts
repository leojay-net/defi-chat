'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChatMessage, AIAnalysisResult, TransactionData } from '@/types';
import { AIAssistant } from '@/lib/aiAssistant';
import { useWallet } from '@/contexts/WalletContext';

const useChat = () => {
    const { connection } = useWallet();

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

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m your DeFi assistant. I can help you with token swaps, crypto-to-fiat conversions, and portfolio management. What would you like to do today?',
            timestamp: new Date(),
            metadata: {
                suggestedActions: getInitialSuggestedActions()
            }
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const aiAssistant = useMemo(() => new AIAssistant(), []);

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
        setMessages([messages[0]]); // Keep the initial greeting
    }, [messages]);

    // Update initial message suggested actions when wallet connection changes
    useEffect(() => {
        setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            if (updatedMessages[0]?.id === '1') {
                updatedMessages[0] = {
                    ...updatedMessages[0],
                    metadata: {
                        ...updatedMessages[0].metadata,
                        suggestedActions: getInitialSuggestedActions()
                    }
                };
            }
            return updatedMessages;
        });
    }, [connection.isConnected, getInitialSuggestedActions]);

    return {
        messages,
        isLoading,
        sendMessage,
        clearChat
    };
};

// Helper functions for mock AI analysis
// These are kept for potential future use
// function extractToken(text: string, tokens: string[], isSecond = false): string | undefined {
//     const matches = tokens.filter(token =>
//         text.toLowerCase().includes(token.toLowerCase())
//     );

//     if (isSecond && matches.length > 1) {
//         return matches[1];
//     }

//     return matches[0];
// }

// function extractAmount(text: string): string | undefined {
//     const amountMatch = text.match(/(\d+\.?\d*)/);
//     return amountMatch ? amountMatch[1] : undefined;
// }

// function generateMockResponse(input: string): string {
//     if (input.toLowerCase().includes('swap')) {
//         return "I can help you swap tokens! Please specify which tokens you'd like to swap and the amount.";
//     }

//     if (input.toLowerCase().includes('convert') || input.toLowerCase().includes('fiat')) {
//         return "I can help you convert your crypto to fiat currency. Which token would you like to convert and to which currency?";
//     }

//     if (input.toLowerCase().includes('balance') || input.toLowerCase().includes('portfolio')) {
//         return "I can show you your portfolio balance. Please connect your wallet first.";
//     }

//     return "I'm here to help with your DeFi needs! You can ask me to swap tokens, convert to fiat, or check your portfolio.";
// }

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
