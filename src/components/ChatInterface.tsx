'use client';

import { useState } from 'react';
import { TransactionData, BankAccount } from '@/types';
import { useWallet } from '@/contexts/WalletContext';
import useChat from '@/hooks/useChat';
import { useChatHistory } from '@/hooks/useChatHistory';
import WalletConnection from './WalletConnection';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import SwapModal from './SwapModal';
import FiatModal from './FiatModal';
import ChatHistorySidebar from './ChatHistorySidebar';
import { RotateCcw, Activity, Zap, TrendingUp } from 'lucide-react';

export default function ChatInterface() {
    const { connection } = useWallet();
    const { messages, isLoading, sendMessage, clearChat, loadChatSession } = useChat();
    const { } = useChatHistory(); // Initialize chat history hook
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [showFiatModal, setShowFiatModal] = useState(false);
    const [modalInitialData, setModalInitialData] = useState<Partial<TransactionData> | undefined>();

    const handleActionClick = async (actionId: string, actionType: string, data?: Partial<TransactionData>) => {
        switch (actionType) {
            case 'connect_wallet':
                // Wallet connection is handled by WalletConnection component
                if (!connection.isConnected) {
                    sendMessage("I'd like to connect my wallet");
                }
                break;

            case 'execute_swap':
                setModalInitialData(data);
                setShowSwapModal(true);
                break;

            case 'confirm_fiat':
                setModalInitialData(data);
                setShowFiatModal(true);
                break;

            case 'approve_token':
                await sendMessage(`Please help me approve ${data?.tokenIn || 'the token'} for trading`);
                break;

            default:
                console.log('Unknown action:', actionType, data);
        }
    };

    const handleSwapExecute = async (swapData: TransactionData) => {
        try {
            console.log('Executing real swap:', swapData);

            // Show single receipt message
            const receipt = `
📋 **SWAP RECEIPT**
━━━━━━━━━━━━━━━━━━━━
✅ **Status:** Completed
🔗 **Transaction:** ${swapData.txHash}
🔄 **Swap:** ${swapData.amountIn} ${swapData.tokenIn} → ${swapData.tokenOut}
⚡ **Slippage:** ${swapData.slippage}%
👤 **Recipient:** ${swapData.recipient}
━━━━━━━━━━━━━━━━━━━━
            `.trim();

            await sendMessage(receipt);

        } catch (error) {
            console.error('Swap execution failed:', error);
            await sendMessage(`❌ Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
        }
    };

    const handleFiatExecute = async (fiatData: TransactionData & { bankAccount: BankAccount }) => {
        try {
            console.log('Executing real fiat conversion:', fiatData);

            // Show single receipt message
            const receipt = `
📋 **FIAT CONVERSION RECEIPT**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ **Status:** Initiated
🔗 **Blockchain TX:** ${fiatData.txHash}
💰 **Transfer Code:** ${fiatData.bankAccount.transferCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 **Conversion:** ${fiatData.amountIn} ${fiatData.tokenIn} → ${fiatData.fiatCurrency} ${fiatData.fiatAmount}
🏦 **Bank:** ${fiatData.bankAccount.bankName}
👤 **Account:** ${fiatData.bankAccount.accountNumber} (${fiatData.bankAccount.accountName})
⏰ **ETA:** Within 24 hours
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `.trim();

            await sendMessage(receipt);

        } catch (error) {
            console.error('Fiat conversion failed:', error);
            await sendMessage(`❌ Fiat conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
            {/* Chat History Sidebar */}
            <ChatHistorySidebar onLoadSession={loadChatSession} />

            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: '20px 20px'
                }} />
            </div>

            {/* Header with wallet connection */}
            <div className="relative z-10 border-b border-gray-800 bg-black/80 backdrop-blur-sm">
                <WalletConnection
                    onOpenSwapModal={() => setShowSwapModal(true)}
                    onOpenFiatModal={() => setShowFiatModal(true)}
                    onNewChat={clearChat}
                />
            </div>

            {/* Chat messages area */}
            <div className="flex-1 relative z-10 min-h-0">
                <ChatMessages
                    messages={messages}
                    onActionClick={handleActionClick}
                />
            </div>

            {/* Chat input */}
            <div className="relative z-10">
                <ChatInput
                    onSendMessage={sendMessage}
                    isLoading={isLoading}
                    placeholder="Ask me to swap tokens, convert to fiat, or check your portfolio..."
                />
            </div>

            {/* Modals */}
            <SwapModal
                isOpen={showSwapModal}
                onClose={() => {
                    setShowSwapModal(false);
                    setModalInitialData(undefined);
                }}
                initialData={modalInitialData}
                onExecute={handleSwapExecute}
            />

            <FiatModal
                isOpen={showFiatModal}
                onClose={() => {
                    setShowFiatModal(false);
                    setModalInitialData(undefined);
                }}
                initialData={modalInitialData}
                onExecute={handleFiatExecute}
            />

            {/* Footer */}
            <div className="relative z-10 p-4 border-t border-gray-800 bg-black/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                            <Activity className="w-3 h-3" />
                            <span>Powered by AI</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Zap className="w-3 h-3" />
                            <span>Starknet</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Ekubo DEX</span>
                        </div>
                    </div>
                    <button
                        onClick={clearChat}
                        className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-200 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-gray-800"
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>Clear</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
