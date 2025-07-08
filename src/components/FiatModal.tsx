'use client';

import { useState, useEffect, useCallback } from 'react';
import { TransactionData, BankAccount, StarknetAccount } from '@/types';
import { useWallet } from '@/contexts/WalletContext';
import { initiateFiatTransaction } from '@/lib/starknet';
import { createRecipient, initiateTransfer, listBanks, convertCryptoToFiat, verifyAccount } from '@/lib/paystack';
import { useEkuboTokens } from '@/hooks/useEkuboTokens';
import './ui/modal.css';
// Removed unused imports since we're using the wallet account directly

interface Bank {
    id: number;
    name: string;
    code: string;
}

interface FiatModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<TransactionData>;
    onExecute: (fiatData: TransactionData & { bankAccount: BankAccount }) => void;
}

const CURRENCIES = [
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' }
];

export default function FiatModal({ isOpen, onClose, initialData, onExecute }: FiatModalProps) {
    const { connection } = useWallet();
    const { availableTokens, loading: tokensLoading } = useEkuboTokens();
    const [formData, setFormData] = useState({
        tokenIn: initialData?.tokenIn || '',
        amountIn: initialData?.amountIn || '',
        fiatCurrency: initialData?.fiatCurrency || 'NGN'
    });
    const [bankAccount, setBankAccount] = useState<BankAccount>({
        bankCode: '',
        bankName: '',
        accountNumber: '',
        accountName: ''
    });
    const [banks, setBanks] = useState<Bank[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [estimatedFiat, setEstimatedFiat] = useState<number>(0);

    useEffect(() => {
        if (isOpen) {
            loadBanks();
        }
    }, [isOpen]);

    const loadBanks = async () => {
        try {
            const banksList = await listBanks();
            setBanks(banksList.map(bank => ({
                id: bank.id,
                name: bank.name,
                code: bank.code
            })));
        } catch (error) {
            console.error('Failed to load banks:', error);
            // Use a minimal fallback set of banks if the API is unavailable
            setBanks([
                { id: 1, name: 'Access Bank', code: '044' },
                { id: 2, name: 'GTBank', code: '058' },
                { id: 3, name: 'First Bank', code: '011' },
                { id: 4, name: 'Zenith Bank', code: '057' },
                { id: 5, name: 'UBA', code: '033' },
                { id: 6, name: 'Fidelity Bank', code: '070' }
            ]);
        }
    };

    const calculateFiatAmount = useCallback(async () => {
        try {
            if (formData.tokenIn && formData.amountIn) {
                const fiatAmount = await convertCryptoToFiat(
                    formData.tokenIn,
                    parseFloat(formData.amountIn),
                    formData.fiatCurrency
                );
                setEstimatedFiat(fiatAmount);
            }
        } catch (error) {
            console.error('Failed to calculate fiat amount:', error);
            // The paystack service now has its own fallback handling
            // so we'll just set a default value here
            setEstimatedFiat(0);
        }
    }, [formData.tokenIn, formData.amountIn, formData.fiatCurrency]);

    useEffect(() => {
        if (formData.tokenIn && formData.amountIn) {
            calculateFiatAmount();
        }
    }, [formData.tokenIn, formData.amountIn, formData.fiatCurrency, calculateFiatAmount]);

    const handleVerifyAccount = async () => {
        if (!bankAccount.accountNumber || !bankAccount.bankCode) return;

        setIsVerifying(true);
        try {
            const accountData = await verifyAccount(bankAccount.accountNumber, bankAccount.bankCode);
            setBankAccount(prev => ({
                ...prev,
                accountName: accountData.account_name
            }));
        } catch (error) {
            console.error('Account verification failed:', error);
            alert('Account verification failed. Please check your details.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!connection.isConnected || !connection.account) {
            alert('Please connect your wallet first');
            return;
        }

        if (!bankAccount.accountName) {
            alert('Please verify your bank account first');
            return;
        }

        if (estimatedFiat <= 0) {
            alert('Please wait for the fiat amount to be calculated or try a different amount');
            return;
        }

        setIsLoading(true);
        try {
            // Generate transaction ID
            const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create Paystack recipient
            const recipientCode = await createRecipient(
                bankAccount.bankCode,
                bankAccount.accountNumber,
                bankAccount.accountName
            );

            // Use the wallet account directly - browser wallets handle signing internally
            const walletAccount = connection.account as StarknetAccount;

            if (!walletAccount) {
                throw new Error('Wallet account not found. Please ensure your wallet is properly connected.');
            }

            // Initiate fiat transaction on Starknet using the wallet account directly
            const txHash = await initiateFiatTransaction(
                walletAccount,
                formData.tokenIn,
                formData.amountIn,
                estimatedFiat.toString(),
                transactionId
            );

            // Initiate transfer via Paystack
            const transfer = await initiateTransfer(
                estimatedFiat,
                recipientCode,
                `Crypto withdrawal - ${formData.tokenIn}`
            );

            const fiatData: TransactionData & { bankAccount: BankAccount } = {
                type: 'fiat_conversion',
                tokenIn: formData.tokenIn,
                amountIn: formData.amountIn,
                fiatAmount: estimatedFiat.toString(),
                fiatCurrency: formData.fiatCurrency,
                transactionId,
                txHash,
                bankAccount: {
                    ...bankAccount,
                    transferCode: transfer.transfer_code
                }
            };

            await onExecute(fiatData);
            alert(`Fiat conversion initiated! Transaction hash: ${txHash}, Transfer code: ${transfer.transfer_code}`);
            onClose();
        } catch (error) {
            console.error('Fiat conversion error:', error);
            alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md modal-container max-h-[85vh] flex flex-col shadow-2xl">
                {/* Fixed Header */}
                <div className="modal-header p-6 border-b border-gray-700 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white">Convert to Fiat</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-200 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-800"
                            aria-label="Close modal"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto scrollable-content">
                    <div className="modal-content p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Token Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Token to Convert</label>
                                <div className="space-y-2">
                                    <select
                                        value={formData.tokenIn}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tokenIn: e.target.value }))}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                        placeholder="Amount"
                                        value={formData.amountIn}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amountIn: e.target.value }))}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Currency Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Fiat Currency</label>
                                <select
                                    value={formData.fiatCurrency}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fiatCurrency: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    {CURRENCIES.map((currency) => (
                                        <option key={currency.code} value={currency.code}>
                                            {currency.symbol} {currency.code} - {currency.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Estimated Amount */}
                            {estimatedFiat > 0 && (
                                <div className="p-3 bg-blue-900/30 border border-blue-600/30 rounded-lg">
                                    <div className="text-blue-200 text-sm">Estimated Amount</div>
                                    <div className="text-white font-semibold">
                                        {CURRENCIES.find(c => c.code === formData.fiatCurrency)?.symbol}
                                        {estimatedFiat.toLocaleString()}
                                    </div>
                                </div>
                            )}

                            {/* Bank Details */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-medium text-white">Bank Details</h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Bank</label>
                                    <select
                                        value={bankAccount.bankCode}
                                        onChange={(e) => {
                                            const selectedBank = banks.find(bank => bank.code === e.target.value);
                                            setBankAccount(prev => ({
                                                ...prev,
                                                bankCode: e.target.value,
                                                bankName: selectedBank?.name || '',
                                                accountName: '' // Reset verification
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Select bank</option>
                                        {banks.map((bank) => (
                                            <option key={bank.code} value={bank.code}>
                                                {bank.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Account Number</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            placeholder="1234567890"
                                            value={bankAccount.accountNumber}
                                            onChange={(e) => setBankAccount(prev => ({
                                                ...prev,
                                                accountNumber: e.target.value,
                                                accountName: '' // Reset verification
                                            }))}
                                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={handleVerifyAccount}
                                            disabled={!bankAccount.accountNumber || !bankAccount.bankCode || isVerifying}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                                        >
                                            {isVerifying ? 'Verifying...' : 'Verify'}
                                        </button>
                                    </div>
                                </div>

                                {bankAccount.accountName && (
                                    <div className="p-3 bg-green-900/30 border border-green-600/30 rounded-lg text-green-200 text-sm">
                                        ✅ Account verified: {bankAccount.accountName}
                                    </div>
                                )}
                            </div>

                            {/* Wallet Status */}
                            {!connection.isConnected && (
                                <div className="p-3 bg-red-900/30 border border-red-600/30 rounded-lg text-red-200 text-sm">
                                    🔗 Please connect your wallet to continue
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!connection.isConnected || isLoading || !bankAccount.accountName || !formData.tokenIn || !formData.amountIn || estimatedFiat <= 0}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                            >
                                {isLoading ? 'Processing Conversion...' : 'Convert to Fiat'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
