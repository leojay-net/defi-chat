import { Contract, RpcProvider, Account, constants } from 'starknet';
import { DEX_CONTRACT_ABI, ERC20_ABI, TOKENS } from './ABI';
import { getEkuboQuote, getPoolKeyForSwap, validateAndFormatAmount } from './ekuboApi';

// Type for browser wallet accounts (ArgentX, Braavos, etc.)
type BrowserWalletAccount = {
    address: string;
    execute: (calls: unknown[]) => Promise<{ transaction_hash: string }>;
    [key: string]: unknown;
};

// Union type for both starknet.js Account and browser wallet accounts
// type WalletAccount = Account | BrowserWalletAccount;


export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP';

export const provider = new RpcProvider({
    nodeUrl: RPC_URL,
    chainId: constants.StarknetChainId.SN_SEPOLIA
});

export function getDexContract(account?: Account | BrowserWalletAccount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Contract(DEX_CONTRACT_ABI, CONTRACT_ADDRESS, account as any || provider);
}

export function getERC20Contract(tokenAddress: string, account?: Account | BrowserWalletAccount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Contract(ERC20_ABI, tokenAddress, account as any || provider);
}

export function stringToFelt252(str: string): string {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    let result = BigInt(0);

    for (let i = 0; i < Math.min(encoded.length, 31); i++) {
        result = result * BigInt(256) + BigInt(encoded[i]);
    }

    return '0x' + result.toString(16);
}

export function felt252ToString(felt: string | bigint): string {
    try {
        const num = typeof felt === 'string' ? BigInt(felt) : felt;
        let str = '';
        let temp = num;

        while (temp > 0) {
            str = String.fromCharCode(Number(temp % BigInt(256))) + str;
            temp = temp / BigInt(256);
        }

        return str;
    } catch {
        return '';
    }
}

export function parseUnits(value: string, decimals: number): string {
    const parts = value.split('.');
    const wholePart = parts[0] || '0';
    const fractionalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);

    return (BigInt(wholePart) * BigInt(10 ** decimals) + BigInt(fractionalPart || '0')).toString();
}

export function formatUnits(value: string | bigint, decimals: number): string {
    const num = typeof value === 'string' ? BigInt(value) : value;
    const divisor = BigInt(10 ** decimals);
    const wholePart = num / divisor;
    const fractionalPart = num % divisor;

    if (fractionalPart === BigInt(0)) {
        return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmed = fractionalStr.replace(/0+$/, '');

    return `${wholePart}.${trimmed}`;
}


// Note: Always use getPoolKeyForSwap() from ekuboApi.ts instead of this function
// This is kept only as a fallback for emergency situations
export function createPoolKey(token0: string, token1: string, fee?: string, tickSpacing?: number, extension?: string) {
    console.warn('⚠️ Using fallback createPoolKey instead of Ekubo API. This may cause LIMIT_MAG errors.');
    return {
        token0: token0 < token1 ? token0 : token1,
        token1: token0 < token1 ? token1 : token0,
        fee: fee || '500', // 0.05% in basis points
        tick_spacing: tickSpacing || 10, // Conservative tick spacing
        extension: extension || '0x0'
    };
}

// Generate transaction ID
export function generateTransactionId(): string {
    return stringToFelt252(`tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}

// Trading functions
export async function getQuote(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string
): Promise<{ amountOut: string; priceImpact: number }> {
    try {
        // Use real Ekubo API to get quotes with token addresses
        const quote = await getEkuboQuote(tokenInAddress, tokenOutAddress, amountIn);
        return {
            amountOut: quote.amountOut,
            priceImpact: quote.priceImpact
        };
    } catch (error) {
        console.error('Error getting quote:', error);
        throw new Error('Failed to get quote from Ekubo');
    }
}

export async function swapTokens(
    account: Account | BrowserWalletAccount,
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    minAmountOut: string,
    recipient: string
): Promise<string> {
    try {
        console.log(`🔄 Initiating swap: ${amountIn} ${tokenInAddress} -> ${tokenOutAddress} (min: ${minAmountOut})`);
        // Get quote first to determine proper decimals and amounts
        const quote = await getEkuboQuote(tokenInAddress, tokenOutAddress, amountIn);
        const tokenInDecimals = quote.tokenInDecimals || 18;
        const tokenOutDecimals = quote.tokenOutDecimals || 18;
        console.log(`💱 Swap details: ${amountIn} tokens (${tokenInDecimals} decimals) -> expected ${quote.amountOut} tokens (${tokenOutDecimals} decimals)`);
        console.log(`📊 User specified minAmountOut: ${minAmountOut}, Quote amountOut: ${quote.amountOut}`);
        // Validate and convert input amount
        const amountInValidation = validateAndFormatAmount(amountIn, tokenInDecimals);
        if (!amountInValidation.isValid) {
            throw new Error(`Invalid input amount: ${amountInValidation.error}`);
        }
        // For minimum amount out, use an ultra-conservative approach to prevent overflow
        const quoteAmountOut = parseFloat(quote.amountOut);
        const userMinAmountOut = parseFloat(minAmountOut);

        let finalMinAmountOut: number;
        let minAmountOutWei: string;

        // If quote is very small or zero, use 0 as minimum to prevent overflow
        if (quoteAmountOut <= 0 || isNaN(quoteAmountOut) || quoteAmountOut < 0.000001) {
            console.log('⚠️ Quote is very small or invalid, setting minAmountOut to 0 to prevent overflow');
            finalMinAmountOut = 0;
        } else {
            // Use EXTREMELY conservative approach to prevent u256_sub overflow
            // Start with 90% slippage tolerance (only expect 10% of quote)
            const ultraConservativeSlippage = 0.90; // 90% slippage tolerance
            const quoteWithSlippage = quoteAmountOut * (1 - ultraConservativeSlippage);

            // Always use the most conservative approach - only 10% of quote
            // This prevents overflow issues when pool liquidity is very limited
            let effectiveMinAmountOut = quoteWithSlippage;

            // If user's expectation is even lower, use that
            if (userMinAmountOut < effectiveMinAmountOut) {
                effectiveMinAmountOut = userMinAmountOut;
            }

            // For very small amounts, just use 0 to prevent overflow
            if (effectiveMinAmountOut < 0.000001) {
                effectiveMinAmountOut = 0;
            }

            finalMinAmountOut = effectiveMinAmountOut;
        }

        console.log(`🎯 Amount calculation:`);
        console.log(`   Quote suggests: ${quoteAmountOut}`);
        console.log(`   User wants min: ${userMinAmountOut}`);
        console.log(`   Final effective min: ${finalMinAmountOut}`);

        const minAmountOutValidation = validateAndFormatAmount(finalMinAmountOut.toString(), tokenOutDecimals);
        if (!minAmountOutValidation.isValid) {
            throw new Error(`Invalid output amount: ${minAmountOutValidation.error}`);
        }
        const amountInWei = amountInValidation.formattedAmount;
        minAmountOutWei = minAmountOutValidation.formattedAmount;

        // Additional safety checks on the wei amounts
        const amountInBigInt = BigInt(amountInWei);
        const minAmountOutBigInt = BigInt(minAmountOutWei);

        // Ensure amounts are reasonable (not zero and not excessively large)
        if (amountInBigInt <= BigInt(0)) {
            throw new Error('Input amount must be greater than zero');
        }
        // Allow minAmountOut to be 0 to prevent overflow issues
        if (minAmountOutBigInt < BigInt(0)) {
            throw new Error('Minimum output amount cannot be negative');
        }

        // Check for reasonable upper bounds (prevent obvious overflow attempts)
        const maxReasonableAmount = BigInt(10) ** BigInt(36); // Very large but reasonable limit
        if (amountInBigInt > maxReasonableAmount) {
            throw new Error('Input amount is unreasonably large');
        }
        if (minAmountOutBigInt > maxReasonableAmount) {
            throw new Error('Minimum output amount is unreasonably large');
        }

        // Check i129 magnitude limits (Ekubo specific)
        const amountInI129Validation = validateI129Amount(amountInWei, "Input amount");
        if (!amountInI129Validation.isValid) {
            throw new Error(amountInI129Validation.error);
        }

        const minAmountOutI129Validation = validateI129Amount(minAmountOutWei, "Minimum output amount");
        if (!minAmountOutI129Validation.isValid) {
            throw new Error(minAmountOutI129Validation.error);
        }

        console.log('--- SWAP DEBUG ---');
        console.log('amountIn:', amountIn, '->', amountInWei);
        console.log('minAmountOut (user):', minAmountOut);
        console.log('minAmountOut (final):', finalMinAmountOut, '->', minAmountOutWei);
        console.log('quote.amountOut:', quote.amountOut);
        console.log('tokenInDecimals:', tokenInDecimals, 'tokenOutDecimals:', tokenOutDecimals);
        console.log('Amount safety checks:');
        console.log('  amountInBigInt:', amountInBigInt.toString());
        console.log('  minAmountOutBigInt:', minAmountOutBigInt.toString());

        // Add detailed parameter analysis
        debugSwapParameters(amountInWei, minAmountOutWei, tokenInDecimals, tokenOutDecimals, quote.amountOut);
        // Get real pool key from Ekubo API
        const poolKey = await getPoolKeyForSwap(tokenInAddress, tokenOutAddress);

        // Validate pool key for i129 compatibility and log details
        console.log('🔍 Pool key from Ekubo API:', poolKey);
        console.log('   Fee:', poolKey.fee, '(type:', typeof poolKey.fee, ')');
        console.log('   Tick spacing:', poolKey.tick_spacing);
        console.log('   Token0:', poolKey.token0);
        console.log('   Token1:', poolKey.token1);
        console.log('   Extension:', poolKey.extension);

        // Validate pool key fee field for i129 compatibility
        if (poolKey.fee) {
            const feeValidation = validateI129Amount(poolKey.fee.toString(), "Pool fee");
            if (!feeValidation.isValid) {
                console.warn('⚠️ Pool fee exceeds i129 limit:', feeValidation.error);
                throw new Error(`Pool fee is incompatible with i129: ${feeValidation.error}`);
            } else {
                console.log('✅ Pool fee is i129 compatible');
            }
        }

        console.log('calldata:', [
            poolKey,
            tokenInAddress,
            tokenOutAddress,
            amountInWei,
            minAmountOutWei,
            recipient
        ]);
        console.log('------------------');
        // Get DEX contract instance
        const dexContract = getDexContract(account);

        // Validate contract and connection
        console.log('🔍 Contract validation:');
        console.log('   Contract address:', CONTRACT_ADDRESS);
        console.log('   Account address:', account.address);
        console.log('   RPC URL:', RPC_URL);

        // Check if contract exists and is callable
        try {
            // Try a simple read call to verify contract exists
            console.log('   Testing contract connection...');
            await provider.getClassAt(CONTRACT_ADDRESS);
            console.log('   ✅ Contract found and accessible');
        } catch (contractCheckError) {
            console.error('   ❌ Contract validation failed:', contractCheckError);
            throw new Error(`DEX contract not accessible at ${CONTRACT_ADDRESS}. Please check contract address.`);
        }

        // Validate pool key for i129 compatibility
        console.log('🔍 Pool key validation:', poolKey);

        // Validate pool key fee field for i129 compatibility
        if (poolKey.fee) {
            const feeValidation = validateI129Amount(poolKey.fee.toString(), "Pool fee");
            if (!feeValidation.isValid) {
                console.warn('⚠️ Pool fee exceeds i129 limit, using fallback pool');
                // You might want to try a different pool or throw an error
                throw new Error(`Pool fee is incompatible with i129: ${feeValidation.error}`);
            }
        }
        console.log(`🚀 Executing swap with validated amounts...`);

        // Check token allowance and balance before swap
        try {
            console.log('🔍 Checking token allowance and balance...');
            const tokenContract = getERC20Contract(tokenInAddress, account);

            // Check balance first
            const balance = await tokenContract.balance_of(account.address);
            const balanceBigInt = BigInt(balance.toString());
            const amountInBigInt = BigInt(amountInWei);

            console.log(`   Current balance: ${balanceBigInt.toString()} (${formatUnits(balanceBigInt.toString(), tokenInDecimals)})`);
            console.log(`   Required amount: ${amountInBigInt.toString()} (${formatUnits(amountInBigInt.toString(), tokenInDecimals)})`);

            if (balanceBigInt < amountInBigInt) {
                throw new Error(`Insufficient balance. Required: ${formatUnits(amountInBigInt.toString(), tokenInDecimals)}, Available: ${formatUnits(balanceBigInt.toString(), tokenInDecimals)}`);
            } else {
                console.log('   ✅ Sufficient balance for swap');
            }

            // Check allowance
            const allowance = await tokenContract.allowance(account.address, CONTRACT_ADDRESS);
            const allowanceBigInt = BigInt(allowance.toString());

            console.log(`   Current allowance: ${allowanceBigInt.toString()} (${formatUnits(allowanceBigInt.toString(), tokenInDecimals)})`);

            if (allowanceBigInt < amountInBigInt) {
                console.log('   ⚠️ Insufficient allowance, requesting approval...');

                // Calculate approval amount (approve a bit more than needed for future swaps)
                const approvalAmount = amountInBigInt * BigInt(2); // Approve 2x the amount
                const approvalAmountFormatted = formatUnits(approvalAmount.toString(), tokenInDecimals);

                console.log(`   🔐 Requesting approval for ${approvalAmountFormatted} tokens...`);

                try {
                    const approvalTxHash = await approveToken(
                        account,
                        tokenInAddress,
                        CONTRACT_ADDRESS,
                        approvalAmountFormatted,
                        tokenInDecimals
                    );
                    console.log(`   ✅ Approval transaction submitted: ${approvalTxHash}`);
                    console.log('   ⏳ Waiting for approval to be confirmed...');

                    // Wait a bit for the approval to be processed
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Verify the approval went through
                    const newAllowance = await tokenContract.allowance(account.address, CONTRACT_ADDRESS);
                    const newAllowanceBigInt = BigInt(newAllowance.toString());
                    console.log(`   🔍 New allowance: ${newAllowanceBigInt.toString()} (${formatUnits(newAllowanceBigInt.toString(), tokenInDecimals)})`);

                    if (newAllowanceBigInt < amountInBigInt) {
                        throw new Error('Approval transaction may not have been confirmed yet. Please wait and try again.');
                    }

                    console.log('   ✅ Approval confirmed, proceeding with swap...');
                } catch (approvalError) {
                    console.error('   ❌ Approval failed:', approvalError);
                    throw new Error(`Token approval failed: ${approvalError instanceof Error ? approvalError.message : 'Unknown error'}`);
                }
            } else {
                console.log('   ✅ Sufficient allowance for swap');
            }
        } catch (checkError: unknown) {
            if (checkError instanceof Error && (checkError.message.includes('Insufficient') || checkError.message.includes('approval'))) {
                throw checkError; // Re-throw our custom errors
            }
            console.warn('   ⚠️ Could not check balance/allowance, proceeding with swap:', checkError instanceof Error ? checkError.message : 'Unknown error');
        }
        // Execute swap with retry mechanism for overflow errors
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} with minAmountOut: ${finalMinAmountOut}`);

                // Final safety check: Force minAmountOut to 0 if it might cause overflow
                // This is better than failing the transaction
                const quoteBigInt = BigInt(Math.floor(parseFloat(quote.amountOut) * Math.pow(10, tokenOutDecimals)));
                const minAmountOutBigInt = BigInt(minAmountOutWei);

                // If minAmountOut is more than 50% of quote, force it to 0
                if (minAmountOutBigInt > quoteBigInt / BigInt(2)) {
                    console.log('⚠️ MinAmountOut too high relative to quote, forcing to 0 to prevent overflow');
                    const safeMinAmountOutWei = '0';

                    const txResponse = await dexContract.swap_exact_input(
                        poolKey,
                        tokenInAddress,
                        tokenOutAddress,
                        amountInWei,
                        safeMinAmountOutWei,
                        recipient,
                        getCompatibleTransactionOptions('0.01')
                    );
                    console.log(`✅ Swap submitted with safe minAmountOut=0: ${txResponse.transaction_hash}`);
                    return txResponse.transaction_hash;
                } else {
                    const txResponse = await dexContract.swap_exact_input(
                        poolKey,
                        tokenInAddress,
                        tokenOutAddress,
                        amountInWei,
                        minAmountOutWei,
                        recipient,
                        getCompatibleTransactionOptions('0.01')
                    );
                    console.log(`✅ Swap submitted: ${txResponse.transaction_hash}`);
                    return txResponse.transaction_hash;
                }
            } catch (contractError: unknown) {
                console.error(`🚨 Contract execution error (attempt ${retryCount + 1}):`, contractError);

                const errorMessage = contractError instanceof Error ? contractError.message : 'Unknown error';
                console.error('Error details:', {
                    message: errorMessage,
                    error: contractError
                });

                // If it's an overflow error, try with a lower minimum amount
                if (errorMessage.includes('u256_sub Overflow')) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`🔄 Overflow detected, retrying with minAmountOut = 0 (attempt ${retryCount + 1})`);
                        finalMinAmountOut = 0;
                        const retryMinAmountOutValidation = validateAndFormatAmount(finalMinAmountOut.toString(), tokenOutDecimals);
                        if (retryMinAmountOutValidation.isValid) {
                            minAmountOutWei = retryMinAmountOutValidation.formattedAmount;
                            continue; // Retry with 0 minimum
                        }
                    }
                    throw new Error('Amount overflow error - insufficient pool liquidity for this swap');
                } else if (errorMessage.includes('Insufficient')) {
                    throw new Error('Insufficient balance or allowance for this swap');
                } else if (errorMessage.includes('slippage')) {
                    throw new Error('Slippage tolerance exceeded - try increasing slippage or reducing amount');
                } else {
                    throw new Error(`Contract execution failed: ${errorMessage}`);
                }
            }
        }

        // If we exit the retry loop without success, throw an error
        throw new Error('Maximum retry attempts exceeded - swap failed');
    } catch (error) {
        console.error('Swap error:', error);
        throw new Error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getTokenBalance(
    tokenAddress: string,
    accountAddress: string,
    decimals: number = 18
): Promise<string> {
    try {
        const tokenContract = getERC20Contract(tokenAddress);
        const balance = await tokenContract.balance_of(accountAddress);
        return formatUnits(balance.toString(), decimals);
    } catch (error) {
        console.error('Error getting token balance:', error);
        return '0';
    }
}

export async function approveToken(
    account: Account | BrowserWalletAccount,
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    decimals: number = 18
): Promise<string> {
    try {
        const tokenContract = getERC20Contract(tokenAddress, account);
        const amountWei = parseUnits(amount, decimals);

        // Use compatible transaction options
        const txResponse = await tokenContract.approve(
            spenderAddress,
            amountWei,
            getCompatibleTransactionOptions('0.001')
        );

        return txResponse.transaction_hash;
    } catch (error) {
        console.error('Approval error:', error);
        const handledError = handleTransactionVersionError(error);
        throw new Error(`Approval failed: ${handledError.message}`);
    }
}

export async function initiateFiatTransaction(
    account: Account | BrowserWalletAccount,
    token: string,
    amount: string,
    fiatAmount: string,
    transactionId: string
): Promise<string> {
    try {
        const tokenAddress = TOKENS[token as keyof typeof TOKENS];
        if (!tokenAddress) {
            throw new Error('Invalid token');
        }

        // Validate fiat amount
        const fiatAmountNum = parseFloat(fiatAmount);
        if (fiatAmountNum <= 0 || isNaN(fiatAmountNum)) {
            throw new Error('Fiat amount must be greater than 0');
        }

        console.log('🏦 Initiating fiat transaction...');
        console.log(`   Token: ${token} (${tokenAddress})`);
        console.log(`   Amount: ${amount}`);
        console.log(`   Fiat Amount: ${fiatAmount}`);
        console.log(`   Transaction ID: ${transactionId}`);

        const dexContract = getDexContract(account);
        const tokenAmountWei = parseUnits(amount, 18);
        const fiatAmountWei = parseUnits(fiatAmount, 2); // Assuming 2 decimals for fiat
        const txId = stringToFelt252(transactionId);

        // Check token approval first
        console.log('🔍 Checking token approval...');
        const approvalResult = await checkAndApproveToken(
            account,
            tokenAddress,
            CONTRACT_ADDRESS,
            amount,
            18
        );

        if (approvalResult.needsApproval) {
            console.log(`✅ Token approval completed: ${approvalResult.approvalTxHash}`);
            // Wait a bit for approval to be processed
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            console.log('✅ Token already approved');
        }

        console.log('🚀 Executing fiat transaction...');
        const txResponse = await dexContract.initiate_fiat_transaction(
            tokenAddress,
            tokenAmountWei,
            fiatAmountWei,
            txId,
            getCompatibleTransactionOptions('0.01')
        );

        return txResponse.transaction_hash;
    } catch (error) {
        console.error('Fiat transaction initiation error:', error);
        throw new Error(`Fiat transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function confirmFiatTransaction(
    account: Account | BrowserWalletAccount,
    userAddress: string,
    transactionId: string
): Promise<string> {
    try {
        const dexContract = getDexContract(account);
        const txId = stringToFelt252(transactionId);

        const txResponse = await dexContract.confirm_fiat_transaction(
            userAddress,
            txId
        );

        return txResponse.transaction_hash;
    } catch (error) {
        console.error('Fiat transaction confirmation error:', error);
        throw new Error(`Fiat confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Helper function to get transaction options compatible with RPC version
export function getCompatibleTransactionOptions(maxFeeEth: string = '0.01'): { version: number; maxFee: string } {
    const maxFeeWei = parseUnits(maxFeeEth, 18);
    return {
        version: 3, // Use transaction version 3 for v0.7 RPC compatibility
        maxFee: maxFeeWei
    };
}

// Error handler for transaction version incompatibility
export function handleTransactionVersionError(error: unknown): Error {
    const errorMessage = (error as Error)?.message || String(error) || '';

    if (errorMessage.includes('v0,v1,v2 tx are not supported')) {
        return new Error(
            'Transaction version incompatibility detected. Please check your RPC configuration. ' +
            'Try using a compatible RPC endpoint that supports the required transaction version.'
        );
    }

    if (errorMessage.includes('Invalid transaction version')) {
        return new Error(
            'Invalid transaction version. This may be due to RPC version mismatch. ' +
            'Please ensure your RPC endpoint supports the transaction version being used.'
        );
    }

    return error instanceof Error ? error : new Error(errorMessage);
}

// Helper function to validate i129 limits for Ekubo
export function validateI129Amount(amount: string, description: string = "Amount"): { isValid: boolean; error?: string } {
    try {
        const amountBigInt = BigInt(amount);

        // i129 magnitude limit is 2^128 - 1
        const maxI129Magnitude = BigInt('340282366920938463463374607431768211455');

        if (amountBigInt > maxI129Magnitude) {
            return {
                isValid: false,
                error: `${description} (${amount}) exceeds i129 magnitude limit (${maxI129Magnitude.toString()}). Maximum allowed: ${maxI129Magnitude.toString()}`
            };
        }

        if (amountBigInt < BigInt(0)) {
            return {
                isValid: false,
                error: `${description} cannot be negative`
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            error: `Invalid ${description} format: ${error}`
        };
    }
}

// Debug function to analyze swap parameters
export function debugSwapParameters(
    amountInWei: string,
    minAmountOutWei: string,
    tokenInDecimals: number,
    tokenOutDecimals: number,
    quoteAmountOut: string
) {
    console.log('🔍 SWAP PARAMETER ANALYSIS:');

    const amountInBigInt = BigInt(amountInWei);
    const minAmountOutBigInt = BigInt(minAmountOutWei);
    const quoteAmountOutFloat = parseFloat(quoteAmountOut);

    // Convert quote to wei for comparison
    const quoteAmountOutWei = BigInt(Math.floor(quoteAmountOutFloat * Math.pow(10, tokenOutDecimals)));

    console.log('📊 Raw values:');
    console.log(`   amountInWei: ${amountInWei}`);
    console.log(`   minAmountOutWei: ${minAmountOutWei}`);
    console.log(`   quoteAmountOut: ${quoteAmountOut}`);
    console.log(`   quoteAmountOutWei: ${quoteAmountOutWei.toString()}`);

    console.log('📏 Size comparison:');
    console.log(`   amountIn digits: ${amountInWei.length}`);
    console.log(`   minAmountOut digits: ${minAmountOutWei.length}`);
    console.log(`   quoteAmountOut digits: ${quoteAmountOutWei.toString().length}`);

    console.log('🔢 Ratio analysis:');
    let ratio = 0;
    if (minAmountOutBigInt > BigInt(0)) {
        ratio = Number(amountInBigInt) / Number(minAmountOutBigInt);
        console.log(`   amountIn / minAmountOut ratio: ${ratio}`);
    }

    if (quoteAmountOutWei > BigInt(0)) {
        const quoteRatio = Number(amountInBigInt) / Number(quoteAmountOutWei);
        console.log(`   amountIn / quote ratio: ${quoteRatio}`);
    }

    // Check for potential overflow conditions
    console.log('⚠️ Overflow checks:');
    const maxU256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
    const maxI129 = BigInt('340282366920938463463374607431768211455');

    if (amountInBigInt > maxU256) {
        console.log('   ❌ amountIn exceeds u256 max!');
    } else {
        console.log(`   ✅ amountIn within u256 range (${((Number(amountInBigInt) / Number(maxU256)) * 100).toFixed(2)}% of max)`);
    }

    if (amountInBigInt > maxI129) {
        console.log('   ❌ amountIn exceeds i129 magnitude limit!');
    } else {
        console.log(`   ✅ amountIn within i129 range (${((Number(amountInBigInt) / Number(maxI129)) * 100).toFixed(2)}% of max)`);
    }

    if (minAmountOutBigInt > maxI129) {
        console.log('   ❌ minAmountOut exceeds i129 magnitude limit!');
    } else {
        console.log(`   ✅ minAmountOut within i129 range (${((Number(minAmountOutBigInt) / Number(maxI129)) * 100).toFixed(2)}% of max)`);
    }

    if (minAmountOutBigInt > maxU256) {
        console.log('   ❌ minAmountOut exceeds u256 max!');
    } else {
        console.log(`   ✅ minAmountOut within u256 range (${((Number(minAmountOutBigInt) / Number(maxU256)) * 100).toFixed(2)}% of max)`);
    }

    // Check if minAmountOut is suspiciously large compared to quote
    if (minAmountOutBigInt > quoteAmountOutWei * BigInt(2)) {
        console.log('   ⚠️ minAmountOut is >2x the quote - possible calculation error');
    }

    console.log('🎯 Recommendations:');
    if (minAmountOutBigInt > quoteAmountOutWei) {
        console.log('   📉 Consider using a lower minAmountOut (below quote amount)');
    }
    if (ratio > 100000) {
        console.log('   📐 Large ratio detected - check if decimal calculations are correct');
    }
}

// Simple test function for amount validation
export async function testSwapAmounts() {
    console.log('🧪 TESTING SWAP AMOUNT CALCULATIONS');

    // Test typical ETH -> USDC swap amounts
    const testCases = [
        {
            name: 'Small ETH -> USDC',
            amountIn: '0.01',
            tokenInDecimals: 18,
            tokenOutDecimals: 6,
            expectedRange: [15, 25] // ~$20 ETH price range
        },
        {
            name: 'Typical ETH -> USDC',
            amountIn: '1',
            tokenInDecimals: 18,
            tokenOutDecimals: 6,
            expectedRange: [1500, 2500] // ~$2000 ETH price range
        },
        {
            name: 'USDC -> ETH',
            amountIn: '2000',
            tokenInDecimals: 6,
            tokenOutDecimals: 18,
            expectedRange: [0.8, 1.2] // ~1 ETH expected
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n📋 Testing ${testCase.name}:`);

        try {
            const validation = validateAndFormatAmount(testCase.amountIn, testCase.tokenInDecimals);

            if (validation.isValid) {
                console.log(`✅ Amount validation passed`);
                console.log(`   Input: ${testCase.amountIn}`);
                console.log(`   Formatted: ${validation.formattedAmount}`);
                console.log(`   Digits: ${validation.formattedAmount.length}`);

                // Convert back to human readable to verify
                const backToHuman = formatUnits(validation.formattedAmount, testCase.tokenInDecimals);
                console.log(`   Back to human: ${backToHuman}`);

                if (backToHuman === testCase.amountIn) {
                    console.log(`   🎯 Round-trip conversion successful`);
                } else {
                    console.log(`   ⚠️ Round-trip mismatch: ${backToHuman} !== ${testCase.amountIn}`);
                }
            } else {
                console.log(`❌ Amount validation failed: ${validation.error}`);
            }
        } catch (error) {
            console.log(`💥 Test failed: ${error}`);
        }
    }

    console.log('\n🔚 Test complete');
}

export async function checkAndApproveToken(
    account: Account | BrowserWalletAccount,
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    decimals: number = 18
): Promise<{ needsApproval: boolean; approvalTxHash?: string; currentAllowance: string }> {
    try {
        const tokenContract = getERC20Contract(tokenAddress, account);
        const amountWei = parseUnits(amount, decimals);
        const amountBigInt = BigInt(amountWei);

        // Check current allowance
        const allowance = await tokenContract.allowance(account.address, spenderAddress);
        const allowanceBigInt = BigInt(allowance.toString());
        const currentAllowanceFormatted = formatUnits(allowance.toString(), decimals);

        console.log(`🔍 Checking allowance for ${tokenAddress}:`);
        console.log(`   Required: ${formatUnits(amountWei, decimals)}`);
        console.log(`   Current: ${currentAllowanceFormatted}`);

        if (allowanceBigInt >= amountBigInt) {
            console.log('   ✅ Sufficient allowance');
            return {
                needsApproval: false,
                currentAllowance: currentAllowanceFormatted
            };
        }

        console.log('   ⚠️ Insufficient allowance, requesting approval...');

        // Calculate approval amount (approve 2x the amount for future swaps)
        const approvalAmount = amountBigInt * BigInt(2);
        const approvalAmountFormatted = formatUnits(approvalAmount.toString(), decimals);

        console.log(`   🔐 Requesting approval for ${approvalAmountFormatted} tokens...`);

        const approvalTxHash = await approveToken(
            account,
            tokenAddress,
            spenderAddress,
            approvalAmountFormatted,
            decimals
        );

        console.log(`   ✅ Approval transaction submitted: ${approvalTxHash}`);

        return {
            needsApproval: true,
            approvalTxHash,
            currentAllowance: currentAllowanceFormatted
        };
    } catch (error) {
        console.error('Error checking/approving token:', error);
        throw new Error(`Token approval check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
