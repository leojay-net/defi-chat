'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TransactionData } from '@/types';
import { useWallet } from '@/contexts/WalletContext';
import { swapTokens, getQuote, checkAndApproveToken, CONTRACT_ADDRESS, provider as fallbackProvider } from '@/lib/starknet';
import { useEkuboTokens, useTokenPairs } from '@/hooks/useEkuboTokens';
import { X, ArrowUpDown, Settings, Zap, TrendingUp, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import './ui/modal.css';
import { Account, SignerInterface, ProviderInterface } from 'starknet';
import { StarknetAccount } from '@/types';

interface SwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<TransactionData>;
    onExecute: (swapData: TransactionData) => void;
}

export default function SwapModal({ isOpen, onClose, initialData, onExecute }: SwapModalProps) {
    const { connection } = useWallet();
    const { availableTokens, loading: tokensLoading, error: tokensError } = useEkuboTokens();

    const [formData, setFormData] = useState({
        tokenIn: initialData?.tokenIn || '',
        tokenOut: initialData?.tokenOut || '',
        amountIn: initialData?.amountIn || '',
        slippage: 0.5
    });

    const [selectedTokenInAddress, setSelectedTokenInAddress] = useState<string | null>(null);
    const { availablePairs, loading: pairsLoading } = useTokenPairs(selectedTokenInAddress);
    const [isLoading, setIsLoading] = useState(false);
    const [quote, setQuote] = useState<{ amountOut: string; priceImpact: number } | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [allowanceStatus, setAllowanceStatus] = useState<{
        checked: boolean;
        needsApproval: boolean;
        currentAllowance: string;
        approvalTxHash?: string;
        checking: boolean;
    }>({
        checked: false,
        needsApproval: false,
        currentAllowance: '0',
        checking: false
    });

    // Update selected token address when tokenIn changes
    useEffect(() => {
        const selectedToken = availableTokens.find(token =>
            token.symbol === formData.tokenIn || token.address === formData.tokenIn
        );
        setSelectedTokenInAddress(selectedToken?.address || null);

        // Clear tokenOut if it's no longer available in pairs
        if (formData.tokenOut && selectedToken) {
            const isValidPair = availablePairs.some(pair =>
                pair.symbol === formData.tokenOut || pair.address === formData.tokenOut
            );
            if (!isValidPair) {
                setFormData(prev => ({ ...prev, tokenOut: '' }));
            }
        }
    }, [formData.tokenIn, formData.tokenOut, availableTokens, availablePairs]);

    // Check allowance when form data changes
    const checkAllowance = useCallback(async () => {
        if (!connection.isConnected || !connection.account || !formData.tokenIn || !formData.amountIn) {
            setAllowanceStatus(prev => ({ ...prev, checked: false }));
            return;
        }

        setAllowanceStatus(prev => ({ ...prev, checking: true }));
        try {
            const tokenInAddress = availableTokens.find(t => t.symbol === formData.tokenIn)?.address || formData.tokenIn;
            const tokenInDecimals = availableTokens.find(t => t.symbol === formData.tokenIn)?.decimals || 18;

            // Convert StarknetAccount to Account (starknet.js)
            const walletAccount = connection.account as StarknetAccount;
            const signer: SignerInterface | undefined = (walletAccount as unknown as { signer?: SignerInterface; _signer?: SignerInterface }).signer || (walletAccount as unknown as { signer?: SignerInterface; _signer?: SignerInterface })._signer;
            const provider = connection.provider;
            const address = walletAccount.address;
            function isProviderInterface(obj: unknown): obj is ProviderInterface {
                return !!obj && typeof obj === 'object' && typeof (obj as ProviderInterface).callContract === 'function';
            }
            let providerToUse: ProviderInterface;
            if (isProviderInterface(provider)) {
                providerToUse = provider;
            } else {
                providerToUse = fallbackProvider;
            }
            if (!signer) {
                throw new Error('Wallet signer not found. Please ensure your wallet exposes a signer.');
            }
            const accountInstance = new Account(providerToUse, address, signer);

            const allowanceResult = await checkAndApproveToken(
                accountInstance,
                tokenInAddress,
                CONTRACT_ADDRESS,
                formData.amountIn,
                tokenInDecimals
            );

            setAllowanceStatus({
                checked: true,
                needsApproval: allowanceResult.needsApproval,
                currentAllowance: allowanceResult.currentAllowance,
                approvalTxHash: allowanceResult.approvalTxHash,
                checking: false
            });
        } catch (error) {
            console.error('Error checking allowance:', error);
            setAllowanceStatus(prev => ({ ...prev, checking: false }));
        }
    }, [connection.account, connection.isConnected, connection.provider, formData.tokenIn, formData.amountIn, availableTokens]);

    // Check allowance when form data changes
    useEffect(() => {
        if (formData.tokenIn && formData.amountIn && connection.isConnected) {
            const timeoutId = setTimeout(checkAllowance, 1000); // Debounce
            return () => clearTimeout(timeoutId);
        }
    }, [formData.tokenIn, formData.amountIn, connection.isConnected, availableTokens, checkAllowance]);

    // Get quote when form data changes
    useEffect(() => {
        const getQuoteAsync = async () => {
            if (formData.tokenIn && formData.tokenOut && formData.amountIn && parseFloat(formData.amountIn) > 0) {
                setQuoteLoading(true);
                try {
                    const tokenInAddress = availableTokens.find(t => t.symbol === formData.tokenIn)?.address || formData.tokenIn;
                    const tokenOutAddress = availablePairs.find(t => t.symbol === formData.tokenOut)?.address || formData.tokenOut;

                    const quoteResult = await getQuote(tokenInAddress, tokenOutAddress, formData.amountIn);
                    setQuote(quoteResult);
                } catch (error) {
                    console.error('Error getting quote:', error);
                    setQuote(null);
                }
                setQuoteLoading(false);
            } else {
                setQuote(null);
            }
        };

        const timeoutId = setTimeout(getQuoteAsync, 500); // Debounce
        return () => clearTimeout(timeoutId);
    }, [formData.tokenIn, formData.tokenOut, formData.amountIn, availableTokens, availablePairs]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!connection.isConnected) {
            alert('Please connect your wallet first');
            return;
        }

        if (!connection.account) {
            alert('Wallet account not available. Please reconnect your wallet.');
            return;
        }

        if (!quote) {
            alert('No quote available. Please check the token pair.');
            return;
        }

        // Check if approval is needed
        if (allowanceStatus.checked && allowanceStatus.needsApproval) {
            alert('Please approve the token first before swapping.');
            return;
        }

        setIsLoading(true);
        try {
            const tokenInAddress = availableTokens.find(t => t.symbol === formData.tokenIn)?.address || formData.tokenIn;
            const tokenOutAddress = availablePairs.find(t => t.symbol === formData.tokenOut)?.address || formData.tokenOut;
            const minAmountOut = (parseFloat(quote.amountOut) * (1 - formData.slippage / 100)).toString();

            // Convert StarknetAccount to Account (starknet.js)
            const walletAccount = connection.account as StarknetAccount;
            const signer: SignerInterface | undefined = (walletAccount as unknown as { signer?: SignerInterface; _signer?: SignerInterface }).signer || (walletAccount as unknown as { signer?: SignerInterface; _signer?: SignerInterface })._signer;
            const provider = connection.provider;
            const address = walletAccount.address;
            function isProviderInterface(obj: unknown): obj is ProviderInterface {
                return !!obj && typeof obj === 'object' && typeof (obj as ProviderInterface).callContract === 'function';
            }
            let providerToUse: ProviderInterface;
            if (isProviderInterface(provider)) {
                providerToUse = provider;
            } else {
                providerToUse = fallbackProvider;
            }
            if (!signer) {
                throw new Error('Wallet signer not found. Please ensure your wallet exposes a signer.');
            }
            const accountInstance = new Account(providerToUse, address, signer);

            // Execute the swap
            const txHash = await swapTokens(
                accountInstance,
                tokenInAddress,
                tokenOutAddress,
                formData.amountIn,
                minAmountOut,
                connection.address || ''
            );

            const swapData: TransactionData = {
                type: 'swap',
                tokenIn: formData.tokenIn,
                tokenOut: formData.tokenOut,
                amountIn: formData.amountIn,
                slippage: formData.slippage,
                recipient: connection.address,
                txHash
            };

            await onExecute(swapData);
            alert(`Swap submitted! Transaction hash: ${txHash}`);

            onClose();
        } catch (error) {
            console.error('Swap error:', error);
            alert(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900/95 border border-gray-700/50 rounded-2xl w-full max-w-md modal-container max-h-[85vh] backdrop-blur-xl shadow-2xl flex flex-col">
                {/* Fixed Header */}
                <div className="modal-header p-6 border-b border-gray-700/50 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                <ArrowUpDown className="w-4 h-4 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Token Swap</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-200 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto scrollable-content">
                    <div className="modal-content p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* From Token */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-300 mb-3">From</label>
                                <div className="space-y-3">
                                    <select
                                        value={formData.tokenIn}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tokenIn: e.target.value, tokenOut: '' }))}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        required
                                        disabled={tokensLoading}
                                    >
                                        <option value="">
                                            {tokensLoading ? 'Loading tokens...' : 'Select token'}
                                        </option>
                                        {availableTokens.map((token) => (
                                            <option key={token.address} value={token.symbol}>
                                                {token.symbol} - {token.name}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0.0"
                                        value={formData.amountIn}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amountIn: e.target.value }))}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Swap Direction Button */}
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        tokenIn: prev.tokenOut,
                                        tokenOut: prev.tokenIn
                                    }))}
                                    className="p-3 bg-gray-800/80 hover:bg-gray-700 border border-gray-600/50 text-white rounded-xl transition-all duration-200 hover:scale-110 backdrop-blur-sm"
                                >
                                    <ArrowUpDown className="w-5 h-5" />
                                </button>
                            </div>

                            {/* To Token */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-300 mb-3">To</label>
                                <select
                                    value={formData.tokenOut}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tokenOut: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    required
                                    disabled={!formData.tokenIn || pairsLoading}
                                >
                                    <option value="">
                                        {!formData.tokenIn ? 'Select "From" token first' :
                                            pairsLoading ? 'Loading pairs...' :
                                                availablePairs.length === 0 ? 'No pairs available' :
                                                    'Select token'}
                                    </option>
                                    {availablePairs.map((token) => (
                                        <option key={token.address} value={token.symbol}>
                                            {token.symbol} - {token.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Slippage */}
                            <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        <Settings className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-medium text-gray-300">Slippage Tolerance</span>
                                    </div>
                                    <span className="text-sm text-blue-400 font-medium">{formData.slippage}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.1"
                                    value={formData.slippage}
                                    onChange={(e) => setFormData(prev => ({ ...prev, slippage: parseFloat(e.target.value) }))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-2">
                                    <span>0.1%</span>
                                    <span>5%</span>
                                </div>
                            </div>

                            {/* Allowance Status */}
                            {formData.tokenIn && formData.amountIn && connection.isConnected && (
                                <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl backdrop-blur-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-2">
                                            {allowanceStatus.checking ? (
                                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                            ) : allowanceStatus.checked ? (
                                                allowanceStatus.needsApproval ? (
                                                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                )
                                            ) : (
                                                <AlertCircle className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span className="text-sm font-medium text-gray-300">Token Approval</span>
                                        </div>
                                        {allowanceStatus.checked && !allowanceStatus.needsApproval && (
                                            <span className="text-sm text-green-400 font-medium">✓ Approved</span>
                                        )}
                                    </div>

                                    {allowanceStatus.checking ? (
                                        <div className="text-sm text-gray-400">Checking allowance...</div>
                                    ) : allowanceStatus.checked ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Current allowance:</span>
                                                <span className="text-gray-300">{allowanceStatus.currentAllowance} {formData.tokenIn}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Required amount:</span>
                                                <span className="text-gray-300">{formData.amountIn} {formData.tokenIn}</span>
                                            </div>

                                            {allowanceStatus.needsApproval ? (
                                                <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                                                        <span className="text-sm font-medium text-yellow-300">Approval Required</span>
                                                    </div>
                                                    <p className="text-xs text-yellow-200 mb-3">
                                                        You need to approve the DEX contract to spend your {formData.tokenIn} tokens.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={checkAllowance}
                                                        className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                                                    >
                                                        Approve {formData.tokenIn}
                                                    </button>
                                                    {allowanceStatus.approvalTxHash && (
                                                        <div className="mt-2 text-xs text-yellow-200">
                                                            Approval submitted: {allowanceStatus.approvalTxHash.slice(0, 10)}...
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-3 p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
                                                    <div className="flex items-center space-x-2">
                                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                                        <span className="text-sm font-medium text-green-300">Ready to Swap</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-400">Connect wallet to check allowance</div>
                                    )}
                                </div>
                            )}

                            {/* Quote Display */}
                            {formData.tokenIn && formData.tokenOut && formData.amountIn && (
                                <div className="p-4 bg-blue-900/20 border border-blue-600/30 rounded-xl backdrop-blur-sm">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <TrendingUp className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-medium text-blue-300">Quote</span>
                                    </div>
                                    {quoteLoading ? (
                                        <div className="flex items-center space-x-2 text-gray-400">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Getting quote...</span>
                                        </div>
                                    ) : quote ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-300">You will receive:</span>
                                                <span className="text-white font-semibold">
                                                    {parseFloat(quote.amountOut).toFixed(6)} {formData.tokenOut}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-300">Price impact:</span>
                                                <span className={`font-medium ${quote.priceImpact > 5 ? 'text-red-400' : quote.priceImpact > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {quote.priceImpact.toFixed(2)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-300">Min received (after slippage):</span>
                                                <span className="text-gray-300">
                                                    {(parseFloat(quote.amountOut) * (1 - formData.slippage / 100)).toFixed(6)} {formData.tokenOut}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-red-400 text-sm">
                                            Unable to get quote. Please check if this token pair is available.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Loading/Error States */}
                            {tokensError && (
                                <div className="p-4 bg-red-900/20 border border-red-600/30 rounded-xl text-red-200 text-sm backdrop-blur-sm">
                                    <span>Error loading tokens: {tokensError}</span>
                                </div>
                            )}

                            {/* Wallet Status */}
                            {!connection.isConnected && (
                                <div className="p-4 bg-red-900/20 border border-red-600/30 rounded-xl text-red-200 text-sm backdrop-blur-sm">
                                    <div className="flex items-center space-x-2">
                                        <Zap className="w-4 h-4" />
                                        <span>Please connect your wallet to continue</span>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={
                                    !connection.isConnected ||
                                    isLoading ||
                                    !formData.tokenIn ||
                                    !formData.tokenOut ||
                                    !formData.amountIn ||
                                    !quote ||
                                    (allowanceStatus.checked && allowanceStatus.needsApproval)
                                }
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Executing Swap...</span>
                                    </>
                                ) : allowanceStatus.checked && allowanceStatus.needsApproval ? (
                                    <>
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Approve Token First</span>
                                    </>
                                ) : (
                                    <>
                                        <TrendingUp className="w-4 h-4" />
                                        <span>Execute Swap</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
