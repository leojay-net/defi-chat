// Simple test script to check the Ekubo API response
// Run this in the browser console to see what the API returns

interface PoolData {
    token0: string;
    token1: string;
    liquidity: string;
    key_hash: string;
}

async function testEkuboAPI() {
    try {
        console.log('🔍 Testing Ekubo Sepolia API...');

        const response = await fetch('https://sepolia-api.ekubo.org/pools');
        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            console.error('❌ API request failed:', response.status, response.statusText);
            return;
        }

        const data: PoolData[] = await response.json();
        console.log('📊 Raw API response:', data);
        console.log('📈 Number of pools:', data.length);

        if (data.length === 0) {
            console.log('⚠️ No pools returned from API');
            return;
        }

        // Show first few pools
        console.log('🏊 First 3 pools:');
        data.slice(0, 3).forEach((pool: PoolData, index: number) => {
            console.log(`Pool ${index + 1}:`, {
                token0: pool.token0,
                token1: pool.token1,
                liquidity: pool.liquidity,
                key_hash: pool.key_hash
            });
        });

        // Check for our specific tokens
        const targetTokens = {
            'ETH': '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            'STRK': '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
            'USDC': '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080',
            'USDT': '0x2ab8758891e84b968ff11361789070c6b1af2df618d6d2f4a78b0757573c6eb'
        };

        console.log('🎯 Checking for target tokens in pools:');
        Object.entries(targetTokens).forEach(([symbol, address]) => {
            const poolsWithToken = data.filter((pool: PoolData) =>
                pool.token0.toLowerCase() === address.toLowerCase() ||
                pool.token1.toLowerCase() === address.toLowerCase()
            );
            console.log(`${symbol} (${address}): ${poolsWithToken.length} pools found`);

            if (poolsWithToken.length > 0) {
                console.log(`  First pool:`, {
                    token0: poolsWithToken[0].token0,
                    token1: poolsWithToken[0].token1,
                    liquidity: poolsWithToken[0].liquidity
                });
            }
        });

        // Get all unique token addresses
        const allTokens = new Set();
        data.forEach((pool: PoolData) => {
            allTokens.add(pool.token0.toLowerCase());
            allTokens.add(pool.token1.toLowerCase());
        });

        console.log(`🔗 Total unique tokens: ${allTokens.size}`);
        console.log('📋 All token addresses:', Array.from(allTokens).slice(0, 10));

    } catch (error) {
        console.error('❌ Error testing API:', error);
    }
}

// Export for use
if (typeof window !== 'undefined') {
    (window as unknown as { testEkuboAPI: typeof testEkuboAPI }).testEkuboAPI = testEkuboAPI;
}

export { testEkuboAPI };
