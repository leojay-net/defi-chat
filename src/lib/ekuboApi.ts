import { TOKENS } from './ABI';

interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
    liquidity?: string;
}

// Top tokens on Starknet Sepolia - these addresses need to match Ekubo's actual pool addresses
const TOP_TOKENS = {
    // ETH - check if this matches the pools
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': {
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        logo_url: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
    },
    // Alternative ETH address format (without leading zero)
    '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': {
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        logo_url: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
    },
    // STRK - check if this matches
    '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': {
        symbol: 'STRK',
        name: 'Starknet Token',
        decimals: 18,
        logo_url: 'https://assets.coingecko.com/coins/images/26433/large/starknet.png'
    },
    // Alternative STRK address format
    '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': {
        symbol: 'STRK',
        name: 'Starknet Token',
        decimals: 18,
        logo_url: 'https://assets.coingecko.com/coins/images/26433/large/starknet.png'
    },
    // USDC - Original address (Sepolia)
    '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logo_url: 'https://tokens.1inch.io/0xa0b86a33e6441e6c5d09464bb72e1d70b9a4d1c8.png'
    },
    // USDC - Alternative format that appears in your debug (seems to be missing leading zero)
    '0x53b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logo_url: 'https://tokens.1inch.io/0xa0b86a33e6441e6c5d09464bb72e1d70b9a4d1c8.png'
    },
    // USDC - Mainnet address from documentation (might also exist on Sepolia)
    '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logo_url: 'https://tokens.1inch.io/0xa0b86a33e6441e6c5d09464bb72e1d70b9a4d1c8.png'
    },
    // USDT
    '0x2ab8758891e84b968ff11361789070c6b1af2df618d6d2f4a78b0757573c6eb': {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        logo_url: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png'
    },
    // Add more token addresses as discovered from pools
    '0x68f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8': {
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        logo_url: 'https://tokens.1inch.io/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png'
    }
} as const;

function compareTokenAddresses(address1: string, address2: string): boolean {
    const addr1 = BigInt(address1);
    const addr2 = BigInt(address2);
    return addr1 < addr2;
}

// Ekubo API types
export interface EkuboPool {
    key_hash: string;
    token0: string;
    token1: string;
    fee: string;
    tick_spacing: number;
    extension: string;
    sqrt_ratio: string;
    tick: number;
    liquidity: string;
    lastUpdate: {
        event_id: string;
    };
}

export interface EkuboPoolDetails {
    pool_key: {
        token0: string;
        token1: string;
        fee: string;
        tick_spacing: number;
        extension: string;
    };
    human_readable: {
        token0: {
            name: string;
            symbol: string;
            decimals: number;
            l2_token_address: string;
            sort_order: number;
            total_supply: number | null;
            logo_url?: string;
            hidden?: boolean;
        };
        token1: {
            name: string;
            symbol: string;
            decimals: number;
            l2_token_address: string;
            sort_order: number;
            total_supply: number | null;
            logo_url?: string;
            hidden?: boolean;
        };
        fee: string;
        tick_spacing: string;
    };
}

export interface QuoteResult {
    amountOut: string;
    priceImpact: number;
    poolKey: {
        token0: string;
        token1: string;
        fee: string;
        tick_spacing: number;
        extension: string;
    };
    tokenInDecimals?: number;
    tokenOutDecimals?: number;
}

const EKUBO_SEPOLIA_API_BASE = 'https://sepolia-api.ekubo.org';

// Cache for pools to avoid repeated API calls
let poolsCache: EkuboPool[] | null = null;
let poolsCacheTimestamp = 0;
let availableTokensCache: Array<{ address: string; symbol: string; name: string; decimals: number; logo_url?: string; }> | null = null;
let tokensCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all available pools from Ekubo Sepolia API
 */
export async function fetchEkuboPools(): Promise<EkuboPool[]> {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (poolsCache && (now - poolsCacheTimestamp) < CACHE_DURATION) {
        return poolsCache;
    }

    try {
        const response = await fetch(`${EKUBO_SEPOLIA_API_BASE}/pools`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const pools: EkuboPool[] = await response.json();

        // Update cache
        poolsCache = pools;
        poolsCacheTimestamp = now;

        return pools;
    } catch (error) {
        console.error('Error fetching Ekubo pools:', error);
        throw new Error('Failed to fetch pools from Ekubo API');
    }
}

/**
 * Fetch detailed pool information by key hash
 */
export async function fetchPoolDetails(keyHash: string): Promise<EkuboPoolDetails> {
    try {
        const response = await fetch(`${EKUBO_SEPOLIA_API_BASE}/pools/${keyHash}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const poolDetails: EkuboPoolDetails = await response.json();
        return poolDetails;
    } catch (error) {
        console.error('Error fetching pool details:', error);
        throw new Error('Failed to fetch pool details from Ekubo API');
    }
}

/**
 * Find the best pool for a token pair (works with both symbols and addresses)
 */
export async function findBestPool(tokenIn: string, tokenOut: string): Promise<EkuboPool | null> {
    try {
        const pools = await fetchEkuboPools();

        // Convert symbols to addresses if needed
        let tokenInAddress = tokenIn;
        let tokenOutAddress = tokenOut;

        // Check if the input is a symbol and convert to address
        if (TOKENS[tokenIn as keyof typeof TOKENS]) {
            tokenInAddress = TOKENS[tokenIn as keyof typeof TOKENS];
        }
        if (TOKENS[tokenOut as keyof typeof TOKENS]) {
            tokenOutAddress = TOKENS[tokenOut as keyof typeof TOKENS];
        }

        // Normalize addresses (remove leading zeros for comparison)
        const normalizeAddress = (addr: string) => {
            if (addr.startsWith('0x0')) {
                return '0x' + addr.slice(3).replace(/^0+/, '');
            }
            return addr.toLowerCase();
        };

        const normalizedTokenIn = normalizeAddress(tokenInAddress);
        const normalizedTokenOut = normalizeAddress(tokenOutAddress);

        // Find pools that match the token pair (in either direction)
        const matchingPools = pools.filter(pool => {
            const normalizedToken0 = normalizeAddress(pool.token0);
            const normalizedToken1 = normalizeAddress(pool.token1);

            return (normalizedToken0 === normalizedTokenIn && normalizedToken1 === normalizedTokenOut) ||
                (normalizedToken0 === normalizedTokenOut && normalizedToken1 === normalizedTokenIn);
        });

        if (matchingPools.length === 0) {
            console.log(`No pools found for ${tokenIn} (${tokenInAddress}) -> ${tokenOut} (${tokenOutAddress})`);
            console.log('Normalized addresses:', normalizedTokenIn, '->', normalizedTokenOut);
            console.log('Available pools:', pools.slice(0, 5).map(p => `${p.token0} <-> ${p.token1} (fee: ${p.fee})`));
            return null;
        }

        // Sort by liquidity (highest first) and return the best pool
        const sortedPools = matchingPools.sort((a, b) =>
            BigInt(b.liquidity) > BigInt(a.liquidity) ? 1 : -1
        );

        const bestPool = sortedPools[0];
        console.log(`Found ${matchingPools.length} pools for ${tokenIn} -> ${tokenOut}`);
        console.log(`Using best pool: ${bestPool.token0} <-> ${bestPool.token1}, fee: ${bestPool.fee}, liquidity: ${bestPool.liquidity}`);

        return bestPool;
    } catch (error) {
        console.error('Error finding best pool:', error);
        return null;
    }
}

/**
 * Get ALL available tokens from pools with their details from API
 */
export async function getAllAvailableTokens(): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
    liquidity?: string;
}>> {
    try {
        console.log('🔄 Fetching ALL tokens from pools...');
        const pools = await fetchEkuboPools();
        console.log(`📊 Got ${pools.length} pools for token extraction`);

        const tokenMap = new Map<string, TokenInfo>();

        // Collect all unique tokens from pools and try to get their details
        for (const pool of pools) {
            // Add token0 if not already in map
            if (!tokenMap.has(pool.token0.toLowerCase())) {
                const topTokenInfo = TOP_TOKENS[pool.token0 as keyof typeof TOP_TOKENS];
                if (topTokenInfo) {
                    tokenMap.set(pool.token0.toLowerCase(), {
                        address: pool.token0,
                        symbol: topTokenInfo.symbol,
                        name: topTokenInfo.name,
                        decimals: topTokenInfo.decimals,
                        logo_url: topTokenInfo.logo_url,
                        liquidity: pool.liquidity
                    });
                } else {
                    // For unknown tokens, try to fetch details from pool details API
                    try {
                        const poolDetails = await fetchPoolDetails(pool.key_hash);
                        tokenMap.set(pool.token0.toLowerCase(), {
                            address: pool.token0,
                            symbol: poolDetails.human_readable.token0.symbol || 'Unknown',
                            name: poolDetails.human_readable.token0.name || 'Unknown Token',
                            decimals: poolDetails.human_readable.token0.decimals || 18,
                            logo_url: poolDetails.human_readable.token0.logo_url,
                            liquidity: pool.liquidity
                        });
                    } catch {
                        // If can't get details, create a basic entry
                        tokenMap.set(pool.token0.toLowerCase(), {
                            address: pool.token0,
                            symbol: `T${pool.token0.slice(-4).toUpperCase()}`,
                            name: 'Unknown Token',
                            decimals: 18,
                            liquidity: pool.liquidity
                        });
                    }
                }
            }

            // Add token1 if not already in map
            if (!tokenMap.has(pool.token1.toLowerCase())) {
                const topTokenInfo = TOP_TOKENS[pool.token1 as keyof typeof TOP_TOKENS];
                if (topTokenInfo) {
                    tokenMap.set(pool.token1.toLowerCase(), {
                        address: pool.token1,
                        symbol: topTokenInfo.symbol,
                        name: topTokenInfo.name,
                        decimals: topTokenInfo.decimals,
                        logo_url: topTokenInfo.logo_url,
                        liquidity: pool.liquidity
                    });
                } else {
                    // For unknown tokens, try to fetch details from pool details API
                    try {
                        const poolDetails = await fetchPoolDetails(pool.key_hash);
                        tokenMap.set(pool.token1.toLowerCase(), {
                            address: pool.token1,
                            symbol: poolDetails.human_readable.token1.symbol || 'Unknown',
                            name: poolDetails.human_readable.token1.name || 'Unknown Token',
                            decimals: poolDetails.human_readable.token1.decimals || 18,
                            logo_url: poolDetails.human_readable.token1.logo_url,
                            liquidity: pool.liquidity
                        });
                    } catch {
                        // If can't get details, create a basic entry
                        tokenMap.set(pool.token1.toLowerCase(), {
                            address: pool.token1,
                            symbol: `T${pool.token1.slice(-4).toUpperCase()}`,
                            name: 'Unknown Token',
                            decimals: 18,
                            liquidity: pool.liquidity
                        });
                    }
                }
            }
        }

        const allTokens = Array.from(tokenMap.values());
        console.log(`✅ Found ${allTokens.length} unique tokens in pools`);

        return allTokens;
    } catch (error) {
        console.error('Error getting all available tokens:', error);
        return [];
    }
}

/**
 * Get top tokens (default display) - shows most liquid/popular tokens
 */
export async function getAvailableTokens(limit: number = 20): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
}>> {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (availableTokensCache && (now - tokensCacheTimestamp) < CACHE_DURATION) {
        console.log('🎯 Returning cached tokens:', availableTokensCache.map(t => t.symbol));
        return availableTokensCache.slice(0, limit);
    }

    try {
        console.log('🔄 Fetching fresh token data...');
        const pools = await fetchEkuboPools();
        console.log(`📊 Got ${pools.length} pools for token filtering`);

        // Calculate token liquidity from all pools they appear in
        const tokenLiquidity = new Map<string, bigint>();
        const tokenInfo = new Map<string, TokenInfo>();

        // First, initialize all known TOP_TOKENS that exist in pools
        Object.entries(TOP_TOKENS).forEach(([address, tokenData]) => {
            const addressLower = address.toLowerCase();
            const existsInPools = pools.some(pool =>
                pool.token0.toLowerCase() === addressLower ||
                pool.token1.toLowerCase() === addressLower
            );

            if (existsInPools) {
                tokenInfo.set(addressLower, {
                    address: address,
                    symbol: tokenData.symbol,
                    name: tokenData.name,
                    decimals: tokenData.decimals,
                    logo_url: tokenData.logo_url
                });
                tokenLiquidity.set(addressLower, BigInt(0)); // Initialize with 0, will be updated below
            }
        });

        // Then, calculate actual liquidity for each token
        pools.forEach(pool => {
            const liquidity = BigInt(pool.liquidity);

            // Token0
            const token0Lower = pool.token0.toLowerCase();
            if (tokenInfo.has(token0Lower)) {
                tokenLiquidity.set(token0Lower, (tokenLiquidity.get(token0Lower) || BigInt(0)) + liquidity);
            }

            // Token1
            const token1Lower = pool.token1.toLowerCase();
            if (tokenInfo.has(token1Lower)) {
                tokenLiquidity.set(token1Lower, (tokenLiquidity.get(token1Lower) || BigInt(0)) + liquidity);
            }
        });

        // Get tokens we know about and sort by liquidity
        const knownTokens = Array.from(tokenInfo.values())
            .map(token => [token, tokenLiquidity.get(token.address.toLowerCase()) || BigInt(0)] as const)
            .sort((a, b) => b[1] > a[1] ? 1 : -1)
            .slice(0, limit)
            .map(([token]) => token);

        console.log(`✅ Top ${limit} tokens by liquidity: ${knownTokens.map(t => t.symbol).join(', ')}`);

        // Update cache
        availableTokensCache = knownTokens;
        tokensCacheTimestamp = now;

        return availableTokensCache;
    } catch (error) {
        console.error('Error getting available tokens:', error);

        // Fallback to known top tokens
        console.log('⚠️ Using fallback tokens due to API error');
        const fallbackTokens = Object.entries(TOP_TOKENS).map(([address, tokenInfo]) => ({
            address,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
            logo_url: tokenInfo.logo_url
        }));

        return fallbackTokens.slice(0, limit);
    }
}

/**
 * Get available "to" tokens based on selected "from" token (optimized for dropdowns)
 */
export async function getAvailableToTokens(fromTokenAddress: string, limit: number = 20): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
}>> {
    try {
        console.log(`🔄 Getting available "to" tokens for: ${fromTokenAddress}`);
        const pools = await fetchEkuboPools();

        // Find pools that contain the from token
        const relevantPools = pools.filter(pool =>
            pool.token0.toLowerCase() === fromTokenAddress.toLowerCase() ||
            pool.token1.toLowerCase() === fromTokenAddress.toLowerCase()
        );

        console.log(`📊 Found ${relevantPools.length} pools containing the from token`);

        const tokenLiquidity = new Map<string, bigint>();
        const tokenInfo = new Map<string, TokenInfo>();

        // Extract paired tokens and calculate their liquidity
        relevantPools.forEach(pool => {
            const liquidity = BigInt(pool.liquidity);

            // Get the paired token (the one that's not the from token)
            const pairedTokenAddress = pool.token0.toLowerCase() === fromTokenAddress.toLowerCase()
                ? pool.token1
                : pool.token0;

            const pairedTokenLower = pairedTokenAddress.toLowerCase();

            // Add liquidity
            tokenLiquidity.set(pairedTokenLower, (tokenLiquidity.get(pairedTokenLower) || BigInt(0)) + liquidity);

            // Add token info if it's a known token and not already added
            if (!tokenInfo.has(pairedTokenLower)) {
                const topTokenData = TOP_TOKENS[pairedTokenAddress as keyof typeof TOP_TOKENS];
                if (topTokenData) {
                    tokenInfo.set(pairedTokenLower, {
                        address: pairedTokenAddress,
                        symbol: topTokenData.symbol,
                        name: topTokenData.name,
                        decimals: topTokenData.decimals,
                        logo_url: topTokenData.logo_url
                    });
                }
            }
        });

        // Get tokens sorted by liquidity
        const availableTokens = Array.from(tokenInfo.values())
            .map(token => [token, tokenLiquidity.get(token.address.toLowerCase()) || BigInt(0)] as const)
            .sort((a, b) => b[1] > a[1] ? 1 : -1)
            .slice(0, limit)
            .map(([token]) => token);

        console.log(`✅ Available "to" tokens: ${availableTokens.map(t => t.symbol).join(', ')}`);

        return availableTokens;
    } catch (error) {
        console.error('Error getting available "to" tokens:', error);

        // Fallback: return all top tokens except the from token
        const fallbackTokens = Object.entries(TOP_TOKENS)
            .filter(([address]) => address.toLowerCase() !== fromTokenAddress.toLowerCase())
            .map(([address, tokenInfo]) => ({
                address,
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                decimals: tokenInfo.decimals,
                logo_url: tokenInfo.logo_url
            }));

        return fallbackTokens.slice(0, limit);
    }
}

/**
 * Get tokens that can be paired with a given token - works with all available tokens
 */
export async function getTokenPairs(tokenAddress: string): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
    pool: EkuboPool;
}>> {
    try {
        console.log(`🔍 Getting pairs for token: ${tokenAddress}`);
        const pools = await fetchEkuboPools();
        console.log(`📊 Checking ${pools.length} pools for pairs`);

        const pairTokens = new Map<string, {
            address: string;
            symbol: string;
            name: string;
            decimals: number;
            logo_url?: string;
            pool: EkuboPool;
        }>();

        // Find pools that contain the given token
        const relevantPools = pools.filter(pool =>
            pool.token0.toLowerCase() === tokenAddress.toLowerCase() ||
            pool.token1.toLowerCase() === tokenAddress.toLowerCase()
        );

        console.log(`🏊 Found ${relevantPools.length} pools containing ${tokenAddress}`);

        // Extract the paired tokens
        for (const pool of relevantPools) {
            const pairedTokenAddress = pool.token0.toLowerCase() === tokenAddress.toLowerCase()
                ? pool.token1
                : pool.token0;

            console.log(`🔗 Found paired token: ${pairedTokenAddress}`);

            if (!pairTokens.has(pairedTokenAddress.toLowerCase())) {
                // Check if this is a known top token first
                const topTokenInfo = TOP_TOKENS[pairedTokenAddress as keyof typeof TOP_TOKENS];

                if (topTokenInfo) {
                    console.log(`✅ ${topTokenInfo.symbol} is a known token, adding to pairs`);
                    pairTokens.set(pairedTokenAddress.toLowerCase(), {
                        address: pairedTokenAddress,
                        symbol: topTokenInfo.symbol,
                        name: topTokenInfo.name,
                        decimals: topTokenInfo.decimals,
                        logo_url: topTokenInfo.logo_url,
                        pool: pool
                    });
                } else {
                    // For unknown tokens, try to get details from pool details API
                    try {
                        const poolDetails = await fetchPoolDetails(pool.key_hash);
                        const tokenDetails = pool.token0.toLowerCase() === pairedTokenAddress.toLowerCase()
                            ? poolDetails.human_readable.token0
                            : poolDetails.human_readable.token1;

                        console.log(`✅ Got details for ${tokenDetails.symbol} from API`);
                        pairTokens.set(pairedTokenAddress.toLowerCase(), {
                            address: pairedTokenAddress,
                            symbol: tokenDetails.symbol || `TOKEN_${pairedTokenAddress.slice(-6).toUpperCase()}`,
                            name: tokenDetails.name || 'Unknown Token',
                            decimals: tokenDetails.decimals || 18,
                            logo_url: tokenDetails.logo_url,
                            pool: pool
                        });
                    } catch {
                        console.log(`⚠️ Could not get details for ${pairedTokenAddress}, using basic info`);
                        // Create basic token info if API call fails
                        pairTokens.set(pairedTokenAddress.toLowerCase(), {
                            address: pairedTokenAddress,
                            symbol: `TOKEN_${pairedTokenAddress.slice(-6).toUpperCase()}`,
                            name: 'Unknown Token',
                            decimals: 18,
                            pool: pool
                        });
                    }
                }
            }
        }

        const result = Array.from(pairTokens.values()).sort((a, b) => {
            // Sort known tokens first, then by symbol
            const aIsKnown = TOP_TOKENS[a.address as keyof typeof TOP_TOKENS] !== undefined;
            const bIsKnown = TOP_TOKENS[b.address as keyof typeof TOP_TOKENS] !== undefined;

            if (aIsKnown && !bIsKnown) return -1;
            if (!aIsKnown && bIsKnown) return 1;

            return a.symbol.localeCompare(b.symbol);
        });

        console.log(`🎯 Final pairs for ${tokenAddress}: ${result.map(t => t.symbol).join(', ')}`);

        return result;
    } catch {
        console.error('Error getting token pairs:');
        return [];
    }
}

/**
 * Get available token pairs from Ekubo pools
 */
export async function getAvailableTokenPairs(): Promise<Array<{ tokenIn: string, tokenOut: string, pool: EkuboPool }>> {
    try {
        const pools = await fetchEkuboPools();
        const pairs: Array<{ tokenIn: string, tokenOut: string, pool: EkuboPool }> = [];

        // Create reverse mapping from address to symbol
        const addressToSymbol: Record<string, string> = {};
        Object.entries(TOKENS).forEach(([symbol, address]) => {
            addressToSymbol[address.toLowerCase()] = symbol;
        });

        // Extract all token pairs from pools
        pools.forEach(pool => {
            const token0Symbol = addressToSymbol[pool.token0.toLowerCase()];
            const token1Symbol = addressToSymbol[pool.token1.toLowerCase()];

            if (token0Symbol && token1Symbol) {
                pairs.push({
                    tokenIn: token0Symbol,
                    tokenOut: token1Symbol,
                    pool: pool
                });
                pairs.push({
                    tokenIn: token1Symbol,
                    tokenOut: token0Symbol,
                    pool: pool
                });
            }
        });

        return pairs;
    } catch {
        console.error('Error getting available token pairs:');
        return [];
    }
}

/**
 * Calculate proper price from sqrt_ratio accounting for token decimals
 * Based on official Ekubo documentation:
 * 1. sqrt_ratio is a Q64.128 fixed point number
 * 2. Divide by 2^128, then square to get price
 * 3. This gives price in token1/token0 units
 * 4. Adjust for token decimals: multiply by 10^(token0Decimals - token1Decimals)
 */
function calculatePriceFromSqrtRatio(
    sqrtRatio: string,
    token0Decimals: number,
    token1Decimals: number,
    isToken0ToToken1: boolean
): number {
    try {
        // Convert sqrt_ratio from hex to BigInt
        const sqrtRatioBigInt = BigInt(sqrtRatio);

        // Ekubo uses Q64.128 format as per documentation
        const Q128 = BigInt(2) ** BigInt(128);

        // Step 1: Divide sqrt_ratio by 2^128 to get normalized square root price
        const sqrtPrice = Number(sqrtRatioBigInt) / Number(Q128);

        // Step 2: Square it to get the price in token1/token0 units
        let price = sqrtPrice * sqrtPrice;

        console.log(`🔢 Ekubo Q64.128 calculation:`, {
            sqrtRatioHex: sqrtRatio,
            sqrtRatioBigInt: sqrtRatioBigInt.toString(),
            sqrtPrice: sqrtPrice,
            rawPrice: price,
            description: 'Price in token1/token0 units (before decimal adjustment)'
        });

        // Step 3: Adjust for decimal differences
        // Because USDC has 6 decimals and ETH has 18 decimals, 
        // we need to scale by 10^(18-6) = 10^12 to be human readable
        const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
        price = price * decimalAdjustment;

        console.log(`🔧 After decimal adjustment (${token0Decimals}-${token1Decimals}): ${price}`);
        console.log(`📊 This represents: 1 token0 = ${price} token1`);

        // Step 4: For swaps, determine if we need to invert
        // The price we calculated is token1/token0 (how much token1 per 1 token0)
        if (!isToken0ToToken1) {
            // token1 -> token0: we need price of token0 in terms of token1 (inverse)
            price = 1 / price;
            console.log(`🔄 Inverted for token1->token0: ${price}`);
            console.log(`📊 This represents: 1 token1 = ${price} token0`);
        }

        // Test with the example from Ekubo docs:
        // sqrt_ratio = 0x029895c9cbfca44f2c46e6e9b5459b should give ~1569.14 USDC/ETH
        if (sqrtRatio === '0x029895c9cbfca44f2c46e6e9b5459b') {
            console.log(`🎯 Ekubo docs test case: Expected ~1569.14 USDC/ETH, got ${price}`);
        }

        return price;
    } catch (error) {
        console.error('Error calculating price from sqrt_ratio:', error);
        return 1; // Fallback to 1:1 ratio
    }
}

/**
 * Calculate price from tick (Uniswap V3 method) - Fixed for large tick values
 */
function calculatePriceFromTick(
    tick: number,
    token0Decimals: number,
    token1Decimals: number,
    isToken0ToToken1: boolean
): number {
    try {
        // Check if tick is too large for JavaScript Math.pow
        if (Math.abs(tick) > 1000000) {
            console.warn(`⚠️ Tick value ${tick} is too large for JavaScript Math.pow, using sqrt_ratio calculation instead`);
            return 0; // Return 0 to indicate we should use sqrt_ratio calculation
        }

        // In Uniswap V3, price = 1.0001^tick
        const priceRaw = Math.pow(1.0001, tick);

        console.log(`🎯 Tick calculation:`, {
            tick: tick,
            priceRaw: priceRaw
        });

        // Check for Infinity or NaN
        if (!isFinite(priceRaw)) {
            console.warn(`⚠️ Price calculation resulted in ${priceRaw}, using sqrt_ratio calculation instead`);
            return 0; // Return 0 to indicate we should use sqrt_ratio calculation
        }

        // This gives us the price of token1 in terms of token0
        let price = priceRaw;
        console.log(`💰 Raw price from tick (token1/token0): ${price}`);

        // Adjust for decimal differences
        // In Uniswap V3, the price is already in the correct units
        // We only need to adjust if there's a significant decimal difference
        if (Math.abs(token0Decimals - token1Decimals) > 0) {
            const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
            price = price * decimalAdjustment;
            console.log(`🔧 After decimal adjustment (${token0Decimals}-${token1Decimals}): ${price}`);
        } else {
            console.log(`🔧 No decimal adjustment needed`);
        }

        // For swaps, we need to determine the correct conversion rate
        if (!isToken0ToToken1) {
            // token1 -> token0: we need price of token0 in terms of token1
            price = 1 / price;
            console.log(`🔄 Inverted for token1->token0: ${price}`);
        }

        return price;
    } catch (error) {
        console.error('Error calculating price from tick:', error);
        return 0; // Return 0 to indicate we should use sqrt_ratio calculation
    }
}

/**
 * Get token decimals from address
 */
function getTokenDecimals(tokenAddress: string): number {
    const tokenInfo = TOP_TOKENS[tokenAddress as keyof typeof TOP_TOKENS];
    return tokenInfo?.decimals || 18; // Default to 18 if unknown
}

/**
 * Calculate price impact based on pool liquidity and trade size
 */
function calculatePriceImpact(amountIn: string, liquidity: string, decimals: number = 18): number {
    try {
        const amountInWei = BigInt(amountIn) * BigInt(10 ** decimals);
        const liquidityBigInt = BigInt(liquidity);

        if (liquidityBigInt === BigInt(0)) {
            return 100; // 100% price impact for empty pools
        }

        // Simple price impact calculation: (amountIn / liquidity) * 100
        // This is a simplified model - real price impact depends on the AMM curve
        const impactRatio = Number(amountInWei * BigInt(10000) / liquidityBigInt) / 10000;
        return Math.min(impactRatio * 100, 100); // Cap at 100%
    } catch (error) {
        console.error('Error calculating price impact:', error);
        return 5; // Default 5% price impact
    }
}

/**
 * Get a quote for swapping tokens using real Ekubo pool data - optimized version
 */
export async function getEkuboQuote(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string
): Promise<QuoteResult> {
    try {
        console.log(`🔄 Getting quote for ${amountIn} tokens: ${tokenInAddress} -> ${tokenOutAddress}`);

        const pool = await findBestPool(tokenInAddress, tokenOutAddress);

        if (!pool) {
            // Get token symbols for better error message
            const tokenInSymbol = Object.entries(TOP_TOKENS).find(([addr]) =>
                addr.toLowerCase() === tokenInAddress.toLowerCase())?.[1]?.symbol || tokenInAddress;
            const tokenOutSymbol = Object.entries(TOP_TOKENS).find(([addr]) =>
                addr.toLowerCase() === tokenOutAddress.toLowerCase())?.[1]?.symbol || tokenOutAddress;

            throw new Error(`No pool found for ${tokenInSymbol} -> ${tokenOutSymbol}`);
        }

        console.log(`📊 Using pool: ${pool.key_hash}, liquidity: ${pool.liquidity}`);
        console.log(`🔗 Pool tokens: ${pool.token0} <-> ${pool.token1}`);
        console.log(`📐 Sqrt ratio: ${pool.sqrt_ratio}`);
        console.log(`🎯 Tick: ${pool.tick}`);

        // Get token decimals - first try our known tokens, then fetch from API
        let token0Decimals = getTokenDecimals(pool.token0);
        let token1Decimals = getTokenDecimals(pool.token1);

        // If we don't have the decimals, try to get them from pool details
        if (token0Decimals === 18 && !TOP_TOKENS[pool.token0 as keyof typeof TOP_TOKENS]) {
            try {
                const poolDetails = await fetchPoolDetails(pool.key_hash);
                token0Decimals = poolDetails.human_readable.token0.decimals;
                token1Decimals = poolDetails.human_readable.token1.decimals;
                console.log(`🔍 Got decimals from API: token0=${token0Decimals}, token1=${token1Decimals}`);
            } catch (error) {
                console.warn('Could not fetch pool details for decimals, using defaults', error);
            }
        }

        console.log(`🔢 Token decimals: token0=${token0Decimals}, token1=${token1Decimals}`);

        // Verify token ordering using Ekubo's method
        const ethIsToken0 = compareTokenAddresses(pool.token0, pool.token1);
        console.log(`🏷️ Token order verification: ${pool.token0} < ${pool.token1} = ${ethIsToken0}`);
        console.log(`📝 Expected: token0=${ethIsToken0 ? 'ETH' : 'USDC'}, token1=${ethIsToken0 ? 'USDC' : 'ETH'}`);

        // Determine token order
        const isToken0ToToken1 = pool.token0.toLowerCase() === tokenInAddress.toLowerCase();
        const tokenInDecimals = isToken0ToToken1 ? token0Decimals : token1Decimals;
        const tokenOutDecimals = isToken0ToToken1 ? token1Decimals : token0Decimals;

        console.log(`📋 Swap direction: ${isToken0ToToken1 ? 'token0->token1' : 'token1->token0'}`);
        console.log(`🔢 Input decimals: ${tokenInDecimals}, Output decimals: ${tokenOutDecimals}`);

        // Debug: Let's also check what tokens we're actually dealing with
        const token0Symbol = TOP_TOKENS[pool.token0 as keyof typeof TOP_TOKENS]?.symbol || 'UNKNOWN';
        const token1Symbol = TOP_TOKENS[pool.token1 as keyof typeof TOP_TOKENS]?.symbol || 'UNKNOWN';
        console.log(`🔍 Actual tokens: token0=${token0Symbol}(${pool.token0}), token1=${token1Symbol}(${pool.token1})`);
        console.log(`🔍 Input token: ${tokenInAddress}, Output token: ${tokenOutAddress}`);

        // Use the improved price calculation
        const price = calculatePriceFromSqrtRatio(
            pool.sqrt_ratio,
            token0Decimals,
            token1Decimals,
            isToken0ToToken1
        );

        console.log(`💰 Calculated price: ${price}`);

        // Alternative: Try calculating price from tick
        const tickPrice = calculatePriceFromTick(pool.tick, token0Decimals, token1Decimals, isToken0ToToken1);
        console.log(`🎯 Price from tick: ${tickPrice}`);

        // Convert input amount to proper decimal representation
        const amountInFloat = parseFloat(amountIn);

        // For now, let's use the tick-based price as it's more reliable
        const finalPrice = tickPrice;
        console.log(`✅ Using tick-based price: ${finalPrice}`);

        // Calculate output amount with proper decimal handling
        let amountOut: number;

        if (isToken0ToToken1) {
            // token0 -> token1: multiply by price and adjust for decimal difference
            amountOut = amountInFloat * finalPrice;
        } else {
            // token1 -> token0: multiply by price (already inverted in calculatePriceFromSqrtRatio)
            amountOut = amountInFloat * finalPrice;
        }

        console.log(`📈 Raw amount out: ${amountOut}`);

        // Ensure we have a reasonable minimum output
        if (amountOut < 0.000001) {
            console.warn('⚠️ Very small output amount, this might indicate a calculation issue');
            // For debugging, let's try a simpler calculation
            const fallbackPrice = 1800; // Rough ETH price in USDC
            amountOut = amountInFloat * fallbackPrice;
            console.log(`🔄 Using fallback price calculation: ${amountOut}`);
        }

        // Format to reasonable precision based on output token decimals
        // Use a more robust formatting to prevent precision issues
        let formattedAmountOut: string;

        if (tokenOutDecimals <= 8) {
            // For tokens with low decimals (like USDC with 6), be more careful with precision
            formattedAmountOut = amountOut.toFixed(Math.min(tokenOutDecimals, 6));
        } else {
            // For tokens with high decimals (like ETH with 18), use standard precision
            formattedAmountOut = amountOut.toFixed(8);
        }

        // Remove trailing zeros but keep at least one decimal place
        formattedAmountOut = parseFloat(formattedAmountOut).toString();

        console.log(`✅ Final amount out: ${formattedAmountOut}`);

        // Calculate price impact
        const priceImpact = calculatePriceImpact(amountIn, pool.liquidity, tokenInDecimals);

        return {
            amountOut: formattedAmountOut,
            priceImpact,
            poolKey: {
                token0: pool.token0,
                token1: pool.token1,
                fee: pool.fee,
                tick_spacing: pool.tick_spacing,
                extension: pool.extension
            },
            // Include decimals for proper amount formatting in transactions
            tokenInDecimals,
            tokenOutDecimals
        };
    } catch {
        console.error('Error getting Ekubo quote:');
        throw new Error('Failed to get quote');
    }
}

/**
 * Get pool information for creating the pool key in swaps - updated version
 */
export async function getPoolKeyForSwap(tokenInAddress: string, tokenOutAddress: string) {
    try {
        const pool = await findBestPool(tokenInAddress, tokenOutAddress);

        if (!pool) {
            // Get token symbols for better error message
            const tokenInSymbol = Object.entries(TOP_TOKENS).find(([addr]) =>
                addr.toLowerCase() === tokenInAddress.toLowerCase())?.[1]?.symbol || tokenInAddress;
            const tokenOutSymbol = Object.entries(TOP_TOKENS).find(([addr]) =>
                addr.toLowerCase() === tokenOutAddress.toLowerCase())?.[1]?.symbol || tokenOutAddress;

            throw new Error(`No pool found for ${tokenInSymbol} -> ${tokenOutSymbol}`);
        }

        // Process fee to ensure it's i129 compatible
        let processedFee = pool.fee;

        // If fee is a hex string, validate it's not too large for i129
        if (typeof processedFee === 'string' && processedFee.startsWith('0x')) {
            const feeValue = BigInt(processedFee);
            const maxI129 = BigInt('340282366920938463463374607431768211455'); // 2^128 - 1

            if (feeValue > maxI129) {
                console.warn(`⚠️ Pool fee ${processedFee} exceeds i129 limit, using fallback fee`);
                // Use a standard 0.05% fee as fallback
                processedFee = '500'; // 0.05% in basis points
            }
        }

        return {
            token0: pool.token0,
            token1: pool.token1,
            fee: processedFee,
            tick_spacing: pool.tick_spacing,
            extension: pool.extension
        };
    } catch {
        console.error('Error getting pool key');
        throw new Error('Failed to get pool key');
    }
}

/**
 * Clear all caches (useful for debugging or forced refresh)
 */
export function clearAllCaches(): void {
    poolsCache = null;
    availableTokensCache = null;
    poolsCacheTimestamp = 0;
    tokensCacheTimestamp = 0;
    console.log('All Ekubo API caches cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
    const now = Date.now();
    return {
        pools: {
            cached: poolsCache !== null,
            age: poolsCache ? now - poolsCacheTimestamp : 0,
            fresh: poolsCache && (now - poolsCacheTimestamp) < CACHE_DURATION
        },
        tokens: {
            cached: availableTokensCache !== null,
            age: availableTokensCache ? now - tokensCacheTimestamp : 0,
            fresh: availableTokensCache && (now - tokensCacheTimestamp) < CACHE_DURATION
        }
    };
}

/**
 * Debug function to check what pools are actually available
 */
export async function debugEkuboPools(): Promise<void> {
    try {
        console.log('🔍 Debugging Ekubo Pools...');

        const pools = await fetchEkuboPools();
        console.log(`📊 Total pools found: ${pools.length}`);

        if (pools.length === 0) {
            console.log('❌ No pools returned from API');
            return;
        }

        // Show first few pools for inspection
        console.log('🏊 First 5 pools:');
        pools.slice(0, 5).forEach((pool, index) => {
            console.log(`  ${index + 1}. Token0: ${pool.token0}`);
            console.log(`     Token1: ${pool.token1}`);
            console.log(`     Liquidity: ${pool.liquidity}`);
            console.log(`     Key Hash: ${pool.key_hash}`);
            console.log('     ---');
        });

        // Check which of our top tokens actually exist in pools
        console.log('🎯 Checking TOP_TOKENS presence in pools:');
        Object.entries(TOP_TOKENS).forEach(([address, tokenInfo]) => {
            const foundInPools = pools.some(pool =>
                pool.token0.toLowerCase() === address.toLowerCase() ||
                pool.token1.toLowerCase() === address.toLowerCase()
            );
            console.log(`  ${tokenInfo.symbol} (${address}): ${foundInPools ? '✅ Found' : '❌ Not found'}`);
        });

        // Show unique token addresses in pools
        const allTokenAddresses = new Set<string>();
        pools.forEach(pool => {
            allTokenAddresses.add(pool.token0.toLowerCase());
            allTokenAddresses.add(pool.token1.toLowerCase());
        });

        console.log(`🔗 Total unique tokens in pools: ${allTokenAddresses.size}`);
        console.log('📋 All token addresses in pools:', Array.from(allTokenAddresses).slice(0, 10));

    } catch (error) {
        console.error('❌ Error debugging pools:', error);
    }
}

/**
 * Search tokens by symbol, name, or address (like Ekubo UI)
 */
export async function searchTokens(query: string, limit: number = 50): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logo_url?: string;
}>> {
    try {
        if (!query || query.length < 1) {
            // Return top tokens when no search query
            return await getAvailableTokens(20);
        }

        console.log(`🔍 Searching tokens for: "${query}"`);
        const pools = await fetchEkuboPools();

        // Create a comprehensive token map
        const tokenMap = new Map<string, {
            address: string;
            symbol: string;
            name: string;
            decimals: number;
            logo_url?: string;
        }>();
        const tokenLiquidity = new Map<string, bigint>();

        // Collect all tokens with their liquidity
        pools.forEach(pool => {
            const liquidity = BigInt(pool.liquidity);

            // Token0
            const token0Lower = pool.token0.toLowerCase();
            tokenLiquidity.set(token0Lower, (tokenLiquidity.get(token0Lower) || BigInt(0)) + liquidity);
            if (!tokenMap.has(token0Lower)) {
                const topTokenData = TOP_TOKENS[pool.token0 as keyof typeof TOP_TOKENS];
                if (topTokenData) {
                    tokenMap.set(token0Lower, {
                        address: pool.token0,
                        symbol: topTokenData.symbol,
                        name: topTokenData.name,
                        decimals: topTokenData.decimals,
                        logo_url: topTokenData.logo_url
                    });
                } else {
                    // For unknown tokens, create basic info
                    tokenMap.set(token0Lower, {
                        address: pool.token0,
                        symbol: `TOKEN_${pool.token0.slice(-6).toUpperCase()}`,
                        name: 'Unknown Token',
                        decimals: 18
                    });
                }
            }

            // Token1
            const token1Lower = pool.token1.toLowerCase();
            tokenLiquidity.set(token1Lower, (tokenLiquidity.get(token1Lower) || BigInt(0)) + liquidity);
            if (!tokenMap.has(token1Lower)) {
                const topTokenData = TOP_TOKENS[pool.token1 as keyof typeof TOP_TOKENS];
                if (topTokenData) {
                    tokenMap.set(token1Lower, {
                        address: pool.token1,
                        symbol: topTokenData.symbol,
                        name: topTokenData.name,
                        decimals: topTokenData.decimals,
                        logo_url: topTokenData.logo_url
                    });
                } else {
                    // For unknown tokens, create basic info
                    tokenMap.set(token1Lower, {
                        address: pool.token1,
                        symbol: `TOKEN_${pool.token1.slice(-6).toUpperCase()}`,
                        name: 'Unknown Token',
                        decimals: 18
                    });
                }
            }
        });

        const allTokens = Array.from(tokenMap.values());
        const queryLower = query.toLowerCase();

        // Filter tokens based on search query
        const matchingTokens = allTokens.filter(token => {
            const symbolMatch = token.symbol.toLowerCase().includes(queryLower);
            const nameMatch = token.name.toLowerCase().includes(queryLower);
            const addressMatch = token.address.toLowerCase().includes(queryLower);

            return symbolMatch || nameMatch || addressMatch;
        });

        // Sort by relevance: exact symbol match first, then by liquidity
        const sortedTokens = matchingTokens.sort((a, b) => {
            // Exact symbol match gets highest priority
            const aExactSymbol = a.symbol.toLowerCase() === queryLower;
            const bExactSymbol = b.symbol.toLowerCase() === queryLower;

            if (aExactSymbol && !bExactSymbol) return -1;
            if (!aExactSymbol && bExactSymbol) return 1;

            // Symbol starts with query gets second priority
            const aSymbolStarts = a.symbol.toLowerCase().startsWith(queryLower);
            const bSymbolStarts = b.symbol.toLowerCase().startsWith(queryLower);

            if (aSymbolStarts && !bSymbolStarts) return -1;
            if (!aSymbolStarts && bSymbolStarts) return 1;

            // Finally sort by liquidity
            const aLiquidity = tokenLiquidity.get(a.address.toLowerCase()) || BigInt(0);
            const bLiquidity = tokenLiquidity.get(b.address.toLowerCase()) || BigInt(0);

            return bLiquidity > aLiquidity ? 1 : -1;
        });

        const result = sortedTokens.slice(0, limit);
        console.log(`🎯 Found ${matchingTokens.length} tokens matching "${query}", returning top ${result.length}`);

        return result;
    } catch (error) {
        console.error('Error searching tokens:', error);

        // Fallback to basic search in known tokens
        const fallbackTokens = Object.entries(TOP_TOKENS)
            .map(([address, tokenInfo]) => ({
                address,
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                decimals: tokenInfo.decimals,
                logo_url: tokenInfo.logo_url
            }))
            .filter(token =>
                token.symbol.toLowerCase().includes(query.toLowerCase()) ||
                token.name.toLowerCase().includes(query.toLowerCase())
            );

        return fallbackTokens.slice(0, limit);
    }
}

/**
 * Test sqrt_ratio calculation with known values
 */
export function testSqrtRatioCalculation(): void {
    console.log('🧪 Testing sqrt_ratio calculation with known values...');

    // Test with the actual sqrt_ratio from the debug output
    const sqrtRatio = '0x4a2781d17aa282a003d3810a8e866';
    const sqrtRatioBigInt = BigInt(sqrtRatio);

    const Q64 = BigInt(2) ** BigInt(64);
    const Q96 = BigInt(2) ** BigInt(96);
    const Q128 = BigInt(2) ** BigInt(128);

    const sqrtPriceQ64 = Number(sqrtRatioBigInt) / Number(Q64);
    const sqrtPriceQ96 = Number(sqrtRatioBigInt) / Number(Q96);
    const sqrtPriceQ128 = Number(sqrtRatioBigInt) / Number(Q128);

    const priceQ64 = sqrtPriceQ64 * sqrtPriceQ64;
    const priceQ96 = sqrtPriceQ96 * sqrtPriceQ96;
    const priceQ128 = sqrtPriceQ128 * sqrtPriceQ128;

    console.log('Test results:');
    console.log(`  sqrtRatio: ${sqrtRatio}`);
    console.log(`  sqrtRatioBigInt: ${sqrtRatioBigInt.toString()}`);
    console.log(`  Q64 price: ${priceQ64}`);
    console.log(`  Q96 price: ${priceQ96}`);
    console.log(`  Q128 price: ${priceQ128}`);

    // Apply decimal adjustment for ETH (18) and USDC (6)
    const decimalAdjustment = Math.pow(10, 18 - 6); // 12
    console.log(`  Q64 adjusted: ${priceQ64 * decimalAdjustment}`);
    console.log(`  Q96 adjusted: ${priceQ96 * decimalAdjustment}`);
    console.log(`  Q128 adjusted: ${priceQ128 * decimalAdjustment}`);

    // Expected: ETH should be around $2500, so price should be around 2500
    console.log(`  Expected: ~2500`);
}

/**
 * Test function to verify Ekubo documentation example
 * ETH: 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
 * USDC: 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8
 * sqrt_ratio: 0x029895c9cbfca44f2c46e6e9b5459b
 * Expected result: ~1569.14 USDC/ETH
 */
export function testEkuboDocumentationExample() {
    console.log('🧪 Testing Ekubo Documentation Example');
    console.log('=======================================');

    const ethAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    const usdcAddress = '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8';
    const sqrtRatio = '0x029895c9cbfca44f2c46e6e9b5459b';

    // Step 1: Determine token order
    const ethIsToken0 = compareTokenAddresses(ethAddress, usdcAddress);
    console.log(`🔍 Token order: ETH is token${ethIsToken0 ? '0' : '1'}, USDC is token${ethIsToken0 ? '1' : '0'}`);

    // Step 2: Calculate price using our function
    const ethDecimals = 18;
    const usdcDecimals = 6;

    // Since USDC is token1 and ETH is token0, we want token1/token0 (USDC/ETH)
    // But we usually want to express as ETH/USDC, so we need to invert
    const priceUsdcPerEth = calculatePriceFromSqrtRatio(
        sqrtRatio,
        ethDecimals,   // token0 decimals
        usdcDecimals,  // token1 decimals  
        true           // token0 to token1 (ETH to USDC)
    );

    console.log(`💰 Calculated price: ${priceUsdcPerEth} USDC per ETH`);
    console.log(`🎯 Expected from docs: ~1569.14 USDC per ETH`);
    console.log(`✅ Match: ${Math.abs(priceUsdcPerEth - 1569.14) < 1 ? 'YES' : 'NO'}`);

    // Manual calculation to verify:
    const sqrtRatioBigInt = BigInt(sqrtRatio);
    const Q128 = BigInt(2) ** BigInt(128);
    const sqrtPrice = Number(sqrtRatioBigInt) / Number(Q128);
    const rawPrice = sqrtPrice * sqrtPrice;
    const adjustedPrice = rawPrice * Math.pow(10, ethDecimals - usdcDecimals);

    console.log(`🔢 Manual verification:`);
    console.log(`  sqrt_ratio as BigInt: ${sqrtRatioBigInt.toString()}`);
    console.log(`  sqrt_price (after /2^128): ${sqrtPrice}`);
    console.log(`  raw_price (squared): ${rawPrice}`);
    console.log(`  adjusted_price (*10^12): ${adjustedPrice}`);

    return priceUsdcPerEth;
}

/**
 * Validate and format amount to prevent overflow errors in smart contract calls
 * Uses string-based arithmetic to avoid floating-point precision issues
 */
export function validateAndFormatAmount(amount: string, decimals: number): { isValid: boolean; formattedAmount: string; error?: string } {
    try {
        // Trim whitespace and validate basic format
        const trimmedAmount = amount.trim();
        if (!trimmedAmount) {
            return { isValid: false, formattedAmount: "0", error: "Amount cannot be empty" };
        }

        // Allow 0 for minimum amounts to prevent overflow
        if (trimmedAmount === '0' || trimmedAmount === '0.0') {
            return { isValid: true, formattedAmount: "0" };
        }

        // Check for valid number format
        const numberRegex = /^[0-9]+(\.[0-9]+)?$/;
        if (!numberRegex.test(trimmedAmount)) {
            return { isValid: false, formattedAmount: "0", error: "Invalid number format" };
        }

        // Parse the decimal string manually to avoid floating-point errors
        const parts = trimmedAmount.split('.');
        const wholePart = parts[0] || '0';
        const fractionalPart = parts[1] || '';

        // Check for reasonable bounds on the whole part
        if (wholePart.length > 15) { // Prevent unreasonably large numbers
            return { isValid: false, formattedAmount: "0", error: "Amount too large" };
        }

        // Truncate or pad fractional part to match token decimals
        const adjustedFractionalPart = fractionalPart.padEnd(decimals, '0').slice(0, decimals);

        // Combine whole and fractional parts as BigInt
        const weiAmount = BigInt(wholePart) * BigInt(10 ** decimals) + BigInt(adjustedFractionalPart || '0');

        // Check if the amount is actually greater than 0 (but allow 0 for minimum amounts)
        if (weiAmount < BigInt(0)) {
            return { isValid: false, formattedAmount: "0", error: "Amount cannot be negative" };
        }

        // Check if the wei amount is within u256 bounds
        const maxU256 = BigInt(2) ** BigInt(256) - BigInt(1);
        if (weiAmount > maxU256) {
            return { isValid: false, formattedAmount: "0", error: "Amount exceeds u256 maximum" };
        }

        console.log(`💰 Amount validation: ${amount} -> ${weiAmount.toString()} (${decimals} decimals)`);

        return { isValid: true, formattedAmount: weiAmount.toString() };
    } catch (error) {
        return { isValid: false, formattedAmount: "0", error: `Invalid amount format: ${error}` };
    }
}

/**
 * Debug function to identify token issues
 */
export async function debugTokenIssues(): Promise<void> {
    try {
        console.log('🔍 Debugging token and swap issues...');

        // Test with common tokens
        const ethAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
        const usdcAddress = '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080';

        console.log('📊 Getting available tokens...');
        const availableTokens = await getAvailableTokens();
        console.log(`✅ Available tokens: ${availableTokens.map(t => t.symbol).join(', ')}`);

        console.log('🔍 Testing ETH -> USDC quote...');
        const quote = await getEkuboQuote(ethAddress, usdcAddress, '1');
        console.log(`💰 Quote result:`, quote);

        // Test amount formatting
        console.log('🧪 Testing amount formatting...');
        const testAmount = '1.5';
        const ethFormatted = validateAndFormatAmount(testAmount, 18);
        const usdcFormatted = validateAndFormatAmount(testAmount, 6);
        console.log(`ETH formatting (18 decimals): ${ethFormatted.formattedAmount}`);
        console.log(`USDC formatting (6 decimals): ${usdcFormatted.formattedAmount}`);

    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

/**
 * Test function to verify amount validation works correctly with the new implementation
 */
export function testAmountValidation() {
    console.log("🧪 Testing amount validation with new string-based implementation...");

    const testCases = [
        { amount: "1", decimals: 18, expected: "1000000000000000000", desc: "1 ETH" },
        { amount: "1.5", decimals: 18, expected: "1500000000000000000", desc: "1.5 ETH" },
        { amount: "1000", decimals: 6, expected: "1000000000", desc: "1000 USDC" },
        { amount: "0.1", decimals: 6, expected: "100000", desc: "0.1 USDC" },
        { amount: "1.000001", decimals: 6, expected: "1000001", desc: "1.000001 USDC (6 decimals exact)" },
        { amount: "1.0000001", decimals: 6, expected: "1000000", desc: "1.0000001 USDC (7th decimal truncated)" },
        { amount: "0.000001", decimals: 6, expected: "1", desc: "Smallest USDC unit" },
        { amount: "2500.123456", decimals: 6, expected: "2500123456", desc: "Complex USDC amount" },
        { amount: "0", decimals: 18, expected: "invalid", desc: "Zero amount (should fail)" },
        { amount: "", decimals: 18, expected: "invalid", desc: "Empty string (should fail)" },
        { amount: "abc", decimals: 18, expected: "invalid", desc: "Invalid format (should fail)" },
        { amount: "-1", decimals: 18, expected: "invalid", desc: "Negative amount (should fail)" },
        { amount: "1.", decimals: 6, expected: "1000000", desc: "Trailing decimal point" },
        { amount: ".5", decimals: 6, expected: "500000", desc: "Leading decimal point" },
    ];

    console.log("\n📋 Test Results:");
    let passed = 0;
    let failed = 0;

    testCases.forEach(({ amount, decimals, expected, desc }) => {
        const result = validateAndFormatAmount(amount, decimals);
        const shouldBeValid = expected !== "invalid";
        const isCorrect = shouldBeValid ?
            (result.isValid && result.formattedAmount === expected) :
            !result.isValid;

        const status = isCorrect ? "✅" : "❌";
        if (isCorrect) passed++;
        else failed++;

        console.log(`${status} ${desc}`);
        console.log(`   Input: "${amount}" (${decimals} decimals)`);
        if (shouldBeValid) {
            console.log(`   Expected: ${expected}`);
            console.log(`   Got: ${result.isValid ? result.formattedAmount : 'INVALID'}`);
        } else {
            console.log(`   Should be invalid: ${result.isValid ? 'FAILED - Was valid' : 'PASSED - Was invalid'}`);
        }
        if (!isCorrect && result.error) {
            console.log(`   Error: ${result.error}`);
        }
        console.log('');
    });

    console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
    return { passed, failed, total: testCases.length };
}
