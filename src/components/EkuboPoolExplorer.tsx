'use client';

import React, { useState, useEffect } from 'react';
import { getAvailableTokenPairs, fetchEkuboPools, getEkuboQuote } from '@/lib/ekuboApi';
import { getMultipleTokenPrices } from '@/lib/cryptoPriceService';

interface PoolInfo {
    keyHash: string;
    token0: string;
    token1: string;
    liquidity: string;
    fee: string;
    tickSpacing: number;
}

interface TradingPair {
    tokenIn: string;
    tokenOut: string;
    poolKeyHash: string;
}

interface TokenPrice {
    usd?: number;
    ngn?: number;
}

interface TokenPrices {
    [token: string]: TokenPrice;
}

interface QuoteTestResult {
    amountOut?: string;
    priceImpact?: number;
    error?: string;
}

export default function EkuboPoolExplorer() {
    const [pools, setPools] = useState<PoolInfo[]>([]);
    const [tradingPairs, setTradingPairs] = useState<TradingPair[]>([]);
    const [tokenPrices, setTokenPrices] = useState<TokenPrices>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Quote testing
    const [quoteTest, setQuoteTest] = useState({
        tokenIn: 'ETH',
        tokenOut: 'STRK',
        amountIn: '1',
        result: null as QuoteTestResult | null
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load pools and trading pairs
            const [poolsData, pairsData, pricesData] = await Promise.all([
                fetchEkuboPools(),
                getAvailableTokenPairs(),
                getMultipleTokenPrices(['ETH', 'STRK', 'USDC', 'USDT'], ['usd', 'ngn'])
            ]);

            setPools(poolsData.map(pool => ({
                keyHash: pool.key_hash,
                token0: pool.token0,
                token1: pool.token1,
                liquidity: pool.liquidity,
                fee: pool.fee,
                tickSpacing: pool.tick_spacing
            })));

            setTradingPairs(pairsData.map(pair => ({
                tokenIn: pair.tokenIn,
                tokenOut: pair.tokenOut,
                poolKeyHash: pair.pool.key_hash
            })));

            setTokenPrices(pricesData);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
            console.error('Error loading Ekubo data:', err);
        } finally {
            setLoading(false);
        }
    };

    const testQuote = async () => {
        try {
            const result = await getEkuboQuote(
                quoteTest.tokenIn,
                quoteTest.tokenOut,
                quoteTest.amountIn
            );
            setQuoteTest(prev => ({
                ...prev,
                result: {
                    amountOut: result.amountOut,
                    priceImpact: result.priceImpact
                }
            }));
        } catch (err) {
            console.error('Quote test failed:', err);
            setQuoteTest(prev => ({
                ...prev,
                result: { error: err instanceof Error ? err.message : 'Quote failed' }
            }));
        }
    };

    const formatLiquidity = (liquidity: string) => {
        const num = BigInt(liquidity);
        if (num > BigInt(1e18)) {
            return `${(Number(num) / 1e18).toFixed(2)}e18`;
        }
        return num.toString();
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading Ekubo pool data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="text-red-500 text-xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={loadData}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                    Ekubo Sepolia Pool Explorer
                </h1>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Pools</h3>
                        <p className="text-3xl font-bold text-blue-600">{pools.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Trading Pairs</h3>
                        <p className="text-3xl font-bold text-green-600">{tradingPairs.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">API Status</h3>
                        <p className="text-3xl font-bold text-emerald-600">✅ Live</p>
                    </div>
                </div>

                {/* Token Prices */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Real-time Token Prices</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(tokenPrices).map(([token, prices]: [string, TokenPrice]) => (
                            <div key={token} className="border rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900">{token}</h3>
                                <p className="text-sm text-gray-600">USD: ${prices.usd?.toFixed(4)}</p>
                                <p className="text-sm text-gray-600">NGN: ₦{prices.ngn?.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quote Testing */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Quote</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <input
                            type="text"
                            placeholder="Token In (e.g., ETH)"
                            value={quoteTest.tokenIn}
                            onChange={(e) => setQuoteTest(prev => ({ ...prev, tokenIn: e.target.value }))}
                            className="border rounded-lg px-3 py-2"
                        />
                        <input
                            type="text"
                            placeholder="Token Out (e.g., STRK)"
                            value={quoteTest.tokenOut}
                            onChange={(e) => setQuoteTest(prev => ({ ...prev, tokenOut: e.target.value }))}
                            className="border rounded-lg px-3 py-2"
                        />
                        <input
                            type="text"
                            placeholder="Amount In"
                            value={quoteTest.amountIn}
                            onChange={(e) => setQuoteTest(prev => ({ ...prev, amountIn: e.target.value }))}
                            className="border rounded-lg px-3 py-2"
                        />
                        <button
                            onClick={testQuote}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Get Quote
                        </button>
                    </div>

                    {quoteTest.result && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">Quote Result:</h3>
                            <pre className="text-sm overflow-x-auto">
                                {JSON.stringify(quoteTest.result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Pools Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-900">Available Pools</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Live data from Ekubo Sepolia API
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Pool Key Hash
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Token Pair
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Liquidity
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fee
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tick Spacing
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {pools.slice(0, 10).map((pool) => (
                                    <tr key={pool.keyHash} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                            {formatAddress(pool.keyHash)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatAddress(pool.token0)} / {formatAddress(pool.token1)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatLiquidity(pool.liquidity)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {pool.fee}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {pool.tickSpacing}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pools.length > 10 && (
                        <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600">
                            Showing 10 of {pools.length} pools
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
