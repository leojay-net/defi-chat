'use client';

import { useState } from 'react';
import { debugEkuboPools, getAvailableTokens, getTokenPairs, clearAllCaches, getCacheStatus } from '@/lib/ekuboApi';

export default function EkuboDebug() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<string>('');

    const runDebug = async () => {
        setLoading(true);
        setResults('');

        try {
            // Clear console
            console.clear();

            // Add to results
            let output = '🔍 EKUBO DEBUG RESULTS\n';
            output += '========================\n\n';

            // Check cache status
            const cacheStatus = getCacheStatus();
            output += '📈 Cache Status:\n';
            output += `Pools Cache: ${cacheStatus.pools.cached ? 'Yes' : 'No'} (Age: ${cacheStatus.pools.age}ms)\n`;
            output += `Tokens Cache: ${cacheStatus.tokens.cached ? 'Yes' : 'No'} (Age: ${cacheStatus.tokens.age}ms)\n\n`;

            // Run pool debug
            output += '🏊 Running pool debug...\n';
            await debugEkuboPools();

            // Get available tokens
            output += '\n🎯 Getting available tokens...\n';
            const tokens = await getAvailableTokens();
            output += `Found ${tokens.length} available tokens:\n`;
            tokens.forEach(token => {
                output += `  - ${token.symbol} (${token.name}): ${token.address}\n`;
            });

            // Test token pairs for each available token
            output += '\n🔗 Testing token pairs:\n';
            for (const token of tokens) {
                const pairs = await getTokenPairs(token.address);
                output += `${token.symbol} pairs: ${pairs.map(p => p.symbol).join(', ') || 'None'}\n`;
            }

            setResults(output);

        } catch (error) {
            const errorMsg = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            setResults(errorMsg);
            console.error('Debug error:', error);
        } finally {
            setLoading(false);
        }
    };

    const clearCaches = () => {
        clearAllCaches();
        setResults('🗑️ Caches cleared successfully');
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Ekubo API Debug Tool</h1>

            <div className="space-y-4 mb-6">
                <button
                    onClick={runDebug}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
                >
                    {loading ? 'Running Debug...' : 'Run Debug'}
                </button>

                <button
                    onClick={clearCaches}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded ml-2"
                >
                    Clear Caches
                </button>
            </div>

            {results && (
                <div className="bg-gray-100 p-4 rounded-lg">
                    <h2 className="text-lg font-semibold mb-2">Results:</h2>
                    <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-96">
                        {results}
                    </pre>
                </div>
            )}

            <div className="mt-6 text-sm text-gray-600">
                <p>This tool helps debug the Ekubo API integration.</p>
                <p>Check the browser console for detailed logs.</p>
            </div>
        </div>
    );
}
