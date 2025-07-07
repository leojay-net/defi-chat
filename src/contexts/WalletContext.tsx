'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { WalletConnection, StarknetProvider, StarknetAccount } from '@/types';

// Extend Window interface to include starknet
declare global {
    interface Window {
        starknet?: {
            enable: () => Promise<string[]>;
            account: StarknetAccount;
            provider: StarknetProvider;
            isConnected: boolean;
            selectedAddress?: string;
        };
    }
}

interface WalletState {
    connection: WalletConnection;
    isConnecting: boolean;
    error: string | null;
}

interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => void;
    clearError: () => void;
}

const initialState: WalletState = {
    connection: {
        address: '',
        isConnected: false,
        provider: undefined,
        account: undefined
    },
    isConnecting: false,
    error: null
};

type WalletAction =
    | { type: 'CONNECT_START' }
    | { type: 'CONNECT_SUCCESS'; payload: WalletConnection }
    | { type: 'CONNECT_ERROR'; payload: string }
    | { type: 'DISCONNECT' }
    | { type: 'CLEAR_ERROR' };

function walletReducer(state: WalletState, action: WalletAction): WalletState {
    switch (action.type) {
        case 'CONNECT_START':
            return { ...state, isConnecting: true, error: null };
        case 'CONNECT_SUCCESS':
            return {
                ...state,
                connection: action.payload,
                isConnecting: false,
                error: null
            };
        case 'CONNECT_ERROR':
            return {
                ...state,
                isConnecting: false,
                error: action.payload
            };
        case 'DISCONNECT':
            return {
                ...state,
                connection: initialState.connection
            };
        case 'CLEAR_ERROR':
            return { ...state, error: null };
        default:
            return state;
    }
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    const [state, dispatch] = useReducer(walletReducer, initialState);

    const connect = async () => {
        dispatch({ type: 'CONNECT_START' });

        try {
            // Check if wallet is available
            if (typeof window === 'undefined') {
                throw new Error('Window not available');
            }

            console.log('Checking for Starknet wallet...');

            if (!window.starknet) {
                throw new Error('Starknet wallet not found. Please install ArgentX or Braavos.');
            }

            const starknet = window.starknet;
            console.log('Starknet object found:', starknet);

            // Simple connection approach
            console.log('Attempting to enable wallet...');
            const result = await starknet.enable();
            console.log('Enable result:', result);

            if (!result || result.length === 0) {
                throw new Error('Wallet connection rejected by user or no accounts available');
            }

            // Get the first available address
            let address: string | null = null;
            let account: StarknetAccount | undefined = undefined;

            // Try to get address from the result
            if (Array.isArray(result) && result.length > 0) {
                address = result[0]; // Result is usually an array of addresses
                account = starknet.account;
            }

            // If still no address, try getting it from starknet object
            if (!address) {
                address = starknet.selectedAddress || starknet.account?.address;
                account = starknet.account;
            }

            if (!address) {
                console.error('Debug - starknet object:', starknet);
                console.error('Debug - result:', result);
                throw new Error('Could not retrieve wallet address. Please try connecting again.');
            }

            console.log('Wallet address:', address);
            console.log('Wallet account:', account);

            const connection: WalletConnection = {
                address: address,
                isConnected: true,
                provider: starknet.provider,
                account: account
            };

            console.log('Final connection object:', connection);

            dispatch({ type: 'CONNECT_SUCCESS', payload: connection });

            // Store connection in localStorage
            localStorage.setItem('wallet_connected', 'true');
            localStorage.setItem('wallet_address', connection.address);

            console.log('Wallet connected successfully!');

        } catch (error: unknown) {
            console.error('Wallet connection error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
            dispatch({ type: 'CONNECT_ERROR', payload: errorMessage });
        }
    };

    const disconnect = () => {
        dispatch({ type: 'DISCONNECT' });
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('wallet_address');
    };

    const clearError = () => {
        dispatch({ type: 'CLEAR_ERROR' });
    };

    // Auto-connect on mount if previously connected
    useEffect(() => {
        const wasConnected = localStorage.getItem('wallet_connected');
        if (wasConnected === 'true') {
            connect();
        }
    }, []);

    const value: WalletContextType = {
        ...state,
        connect,
        disconnect,
        clearError
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
