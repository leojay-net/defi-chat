// Types for the DEX Chat Interface
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: {
        transactionData?: TransactionData;
        suggestedActions?: SuggestedAction[];
        confirmationRequired?: boolean;
    };
}

export interface TransactionData {
    type: 'swap' | 'fiat_conversion' | 'liquidity';
    tokenIn?: string;
    tokenOut?: string;
    amountIn?: string;
    amountOut?: string;
    slippage?: number;
    fiatAmount?: string;
    fiatCurrency?: string;
    recipient?: string;
    transactionId?: string;
    poolKey?: EkuboPoolKey; // Ekubo pool key
    minAmountOut?: string;
    txHash?: string; // Transaction hash for completed transactions
}

export interface EkuboPoolKey {
    token0: string;
    token1: string;
    fee: string;
    tick_spacing: number;
    extension: string;
}

export interface SuggestedAction {
    id: string;
    type: 'execute_swap' | 'confirm_fiat' | 'connect_wallet' | 'approve_token';
    label: string;
    data?: Record<string, unknown>;
}

export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance?: string;
    logoUrl?: string;
}

export interface UserPreferences {
    defaultSlippage: number;
    preferredTokens: string[];
    fiatCurrency: string;
    autoConfirmTransactions: boolean;
}

export interface AIAnalysisResult {
    intent: 'swap' | 'fiat_conversion' | 'query' | 'unknown';
    confidence: number;
    extractedData: Partial<TransactionData>;
    requiredQuestions: string[];
    suggestedResponse: string;
}

// Paystack Types
export interface BankAccount {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferCode?: string; // Paystack transfer code
}

export interface PaystackTransfer {
    amount: number;
    recipientCode: string;
    reason: string;
    reference: string;
}

// Starknet Types
export interface StarknetProvider {
    request: (request: { type: string; params?: unknown }) => Promise<unknown>;
    chainId?: () => Promise<string>;
    [key: string]: unknown;
}

export interface StarknetAccount {
    address: string;
    getStarkName?: () => Promise<string>;
    execute: (calls: unknown[]) => Promise<{ transaction_hash: string }>;
    [key: string]: unknown;
}

export interface WalletConnection {
    address: string;
    isConnected: boolean;
    provider?: StarknetProvider;
    account?: StarknetAccount;
}

export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    slippage: number;
    recipient: string;
}

export interface FiatTransactionParams {
    token: string;
    amount: string;
    fiatAmount: string;
    transactionId: string;
    bankAccount?: BankAccount;
}
