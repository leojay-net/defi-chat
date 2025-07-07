import { NextRequest, NextResponse } from 'next/server';
import { getEkuboQuote } from '@/lib/ekuboApi';

/**
 * POST /api/quote - Get a quote for token swap
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tokenIn, tokenOut, amountIn } = body;

        // Validate input
        if (!tokenIn || !tokenOut || !amountIn) {
            return NextResponse.json({
                success: false,
                error: 'Missing required parameters',
                message: 'tokenIn, tokenOut, and amountIn are required'
            }, { status: 400 });
        }

        if (parseFloat(amountIn) <= 0) {
            return NextResponse.json({
                success: false,
                error: 'Invalid amount',
                message: 'amountIn must be greater than 0'
            }, { status: 400 });
        }

        // Get quote from Ekubo
        const quote = await getEkuboQuote(tokenIn, tokenOut, amountIn);

        return NextResponse.json({
            success: true,
            data: {
                tokenIn,
                tokenOut,
                amountIn,
                amountOut: quote.amountOut,
                priceImpact: quote.priceImpact,
                poolKey: quote.poolKey,
                rate: parseFloat(quote.amountOut) / parseFloat(amountIn)
            }
        });
    } catch (error) {
        console.error('Error getting quote:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to get quote',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * GET /api/quote - Get a quote via query parameters
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tokenIn = searchParams.get('tokenIn');
        const tokenOut = searchParams.get('tokenOut');
        const amountIn = searchParams.get('amountIn');

        // Validate input
        if (!tokenIn || !tokenOut || !amountIn) {
            return NextResponse.json({
                success: false,
                error: 'Missing required parameters',
                message: 'tokenIn, tokenOut, and amountIn query parameters are required'
            }, { status: 400 });
        }

        if (parseFloat(amountIn) <= 0) {
            return NextResponse.json({
                success: false,
                error: 'Invalid amount',
                message: 'amountIn must be greater than 0'
            }, { status: 400 });
        }

        // Get quote from Ekubo
        const quote = await getEkuboQuote(tokenIn, tokenOut, amountIn);

        return NextResponse.json({
            success: true,
            data: {
                tokenIn,
                tokenOut,
                amountIn,
                amountOut: quote.amountOut,
                priceImpact: quote.priceImpact,
                poolKey: quote.poolKey,
                rate: parseFloat(quote.amountOut) / parseFloat(amountIn)
            }
        });
    } catch (error) {
        console.error('Error getting quote:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to get quote',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
