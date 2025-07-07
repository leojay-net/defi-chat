'use client';

import { ChatMessage } from '@/types';
import { useWallet } from '@/contexts/WalletContext';
import { Bot, User, AlertTriangle, Link, Clock, ArrowRight, Coins } from 'lucide-react';

interface MessageProps {
    message: ChatMessage;
    onActionClick: (actionId: string, actionType: string, data?: Record<string, unknown>) => void;
}

export default function Message({ message, onActionClick }: MessageProps) {
    const { connection } = useWallet();
    const isUser = message.role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
            <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                {/* Avatar */}
                <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${isUser
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                        : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-200 border border-gray-600'
                        }`}>
                        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>

                    <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
                        {/* Message bubble */}
                        <div className={`inline-block px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm ${isUser
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                            : 'bg-gray-800/80 text-gray-100 border border-gray-700/50'
                            }`}>
                            <div className="whitespace-pre-wrap break-words">
                                {message.content}
                            </div>
                        </div>

                        {/* Timestamp */}
                        <div className={`flex items-center mt-2 text-xs text-gray-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <Clock className="w-3 h-3 mr-1" />
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>

                        {/* Suggested Actions */}
                        {message.metadata?.suggestedActions && message.metadata.suggestedActions.length > 0 && (
                            <div className={`mt-4 flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                {message.metadata.suggestedActions.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => onActionClick(action.id, action.type, action.data)}
                                        className="flex items-center space-x-1 px-3 py-2 text-sm bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-600/50 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                                    >
                                        {action.type === 'execute_swap' && <ArrowRight className="w-3 h-3" />}
                                        {action.type === 'confirm_fiat' && <Coins className="w-3 h-3" />}
                                        {action.type === 'connect_wallet' && <Link className="w-3 h-3" />}
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Transaction Data Preview */}
                        {message.metadata?.transactionData && (
                            <div className={`mt-4 p-4 bg-gray-900/80 border border-gray-700/50 rounded-xl text-sm backdrop-blur-sm ${isUser ? 'text-right' : 'text-left'}`}>
                                <div className="flex items-center space-x-2 text-gray-300 font-medium mb-3">
                                    <Coins className="w-4 h-4" />
                                    <span>Transaction Details</span>
                                </div>
                                <div className="space-y-2 text-gray-400">
                                    {message.metadata.transactionData.type && (
                                        <div className="flex justify-between">
                                            <span>Type:</span>
                                            <span className="text-gray-200 font-medium capitalize">{message.metadata.transactionData.type}</span>
                                        </div>
                                    )}
                                    {message.metadata.transactionData.tokenIn && (
                                        <div className="flex justify-between">
                                            <span>From:</span>
                                            <span className="text-gray-200 font-medium">{message.metadata.transactionData.tokenIn}</span>
                                        </div>
                                    )}
                                    {message.metadata.transactionData.tokenOut && (
                                        <div className="flex justify-between">
                                            <span>To:</span>
                                            <span className="text-gray-200 font-medium">{message.metadata.transactionData.tokenOut}</span>
                                        </div>
                                    )}
                                    {message.metadata.transactionData.amountIn && (
                                        <div className="flex justify-between">
                                            <span>Amount:</span>
                                            <span className="text-gray-200 font-medium">{message.metadata.transactionData.amountIn}</span>
                                        </div>
                                    )}
                                    {message.metadata.transactionData.fiatAmount && (
                                        <div className="flex justify-between">
                                            <span>Fiat:</span>
                                            <span className="text-gray-200 font-medium">{message.metadata.transactionData.fiatAmount} {message.metadata.transactionData.fiatCurrency || 'NGN'}</span>
                                        </div>
                                    )}
                                </div>

                                {message.metadata.confirmationRequired && (
                                    <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg text-yellow-200 text-xs backdrop-blur-sm">
                                        <div className="flex items-center space-x-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span>This transaction requires your confirmation</span>
                                        </div>
                                    </div>
                                )}

                                {!connection.isConnected && (
                                    <div className="mt-3 p-3 bg-red-900/20 border border-red-600/30 rounded-lg text-red-200 text-xs backdrop-blur-sm">
                                        <div className="flex items-center space-x-2">
                                            <Link className="w-4 h-4" />
                                            <span>Connect your wallet to proceed</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
