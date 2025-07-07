import { NextResponse } from 'next/server';
import { getAvailableTokenPairs, fetchEkuboPools } from '@/lib/ekuboApi';

/**
 * GET /api/pools - Returns available pools and trading pairs from Ekubo
 */
export async function GET() {
    try {
        // Get all available pools
        const pools = await fetchEkuboPools();

        // Get available trading pairs
        const tradingPairs = await getAvailableTokenPairs();

        // Extract unique tokens from pairs
        const availableTokens = Array.from(
            new Set([
                ...tradingPairs.map(pair => pair.tokenIn),
                ...tradingPairs.map(pair => pair.tokenOut)
            ])
        ).sort();

        return NextResponse.json({
            success: true,
            data: {
                pools: pools.map(pool => ({
                    keyHash: pool.key_hash,
                    token0: pool.token0,
                    token1: pool.token1,
                    fee: pool.fee,
                    tickSpacing: pool.tick_spacing,
                    liquidity: pool.liquidity,
                    tick: pool.tick,
                    sqrtRatio: pool.sqrt_ratio
                })),
                tradingPairs: tradingPairs.map(pair => ({
                    tokenIn: pair.tokenIn,
                    tokenOut: pair.tokenOut,
                    poolKeyHash: pair.pool.key_hash,
                    liquidity: pair.pool.liquidity
                })),
                availableTokens,
                totalPools: pools.length,
                totalPairs: tradingPairs.length
            }
        });
    } catch (error) {
        console.error('Error fetching pools:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to fetch pool data',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
