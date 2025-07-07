import { useState, useEffect, useCallback } from 'react';
import { getAvailableTokens, getTokenPairs, EkuboPool } from '@/lib/ekuboApi';

export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
}

export interface TokenPair extends Token {
    pool: EkuboPool;
}

export function useEkuboTokens() {
    const [availableTokens, setAvailableTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTokens = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const tokens = await getAvailableTokens();
            setAvailableTokens(tokens);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load tokens');
            console.error('Error loading tokens:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTokens();
    }, [loadTokens]);

    return {
        availableTokens,
        loading,
        error,
        reload: loadTokens
    };
}

export function useTokenPairs(selectedTokenAddress: string | null) {
    const [availablePairs, setAvailablePairs] = useState<TokenPair[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPairs = useCallback(async (tokenAddress: string) => {
        try {
            setLoading(true);
            setError(null);
            const pairs = await getTokenPairs(tokenAddress);
            setAvailablePairs(pairs);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load token pairs');
            console.error('Error loading token pairs:', err);
            setAvailablePairs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedTokenAddress) {
            loadPairs(selectedTokenAddress);
        } else {
            setAvailablePairs([]);
            setError(null);
        }
    }, [selectedTokenAddress, loadPairs]);

    return {
        availablePairs,
        loading,
        error
    };
}

export function useTokenSearch() {
    const [searchResults, setSearchResults] = useState<Token[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const search = useCallback(async (query: string) => {
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        try {
            setSearching(true);
            setSearchError(null);

            const { searchTokens } = await import('@/lib/ekuboApi');
            const results = await searchTokens(query.trim(), 50);
            setSearchResults(results);
        } catch (err) {
            console.error('Error searching tokens:', err);
            setSearchError(err instanceof Error ? err.message : 'Search failed');
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    const clearSearch = useCallback(() => {
        setSearchResults([]);
        setSearchError(null);
    }, []);

    return {
        searchResults,
        searching,
        searchError,
        search,
        clearSearch
    };
}
