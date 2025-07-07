import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIAnalysisResult, TransactionData } from '@/types';



const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export class AIAssistant {
    private model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    async analyzeUserMessage(message: string, context?: Record<string, unknown>): Promise<AIAnalysisResult> {
        try {
            const prompt = this.buildAnalysisPrompt(message, context);
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            return this.parseAIResponse(response);
        } catch (error) {
            console.error('AI Analysis Error:', error);
            return {
                intent: 'unknown',
                confidence: 0,
                extractedData: {},
                requiredQuestions: [],
                suggestedResponse: "I'm having trouble understanding your request. Could you please rephrase it?"
            };
        }
    }

    private buildAnalysisPrompt(message: string, context?: Record<string, unknown>): string {
        return `
You are a DeFi assistant helping users with cryptocurrency swaps and fiat conversions. 
Analyze the user's message and extract trading intent and parameters.

User Message: "${message}"

Context: ${context ? JSON.stringify(context) : 'None'}

Available Actions:
1. Token Swaps (ETH ↔ USDC, STRK ↔ USDC, etc.)
2. Crypto to Fiat conversions (via bank transfer)
3. Portfolio queries
4. Transaction status checks

Instructions:
- Only extract transaction data if the user is clearly requesting a swap or fiat conversion
- For general questions, greetings, or non-transaction queries, set intent to "query" and leave extractedData empty
- Set intent to "unknown" only if you cannot understand the message at all

Respond with a JSON object in this exact format:
{
  "intent": "swap|fiat_conversion|query|unknown",
  "confidence": 0.8,
  "extractedData": {
    "type": "swap|fiat_conversion",
    "tokenIn": "ETH",
    "tokenOut": "USDC", 
    "amountIn": "1.5",
    "fiatAmount": "2000",
    "fiatCurrency": "NGN"
  },
  "requiredQuestions": ["What amount would you like to swap?"],
  "suggestedResponse": "I see you want to swap ETH for USDC. How much ETH would you like to swap?"
}

For general queries or greetings, use empty extractedData like this:
{
  "intent": "query",
  "confidence": 0.9,
  "extractedData": {},
  "requiredQuestions": [],
  "suggestedResponse": "Hello! How can I help you with your DeFi needs today?"
}

Be conversational and helpful. Ask clarifying questions when information is missing.
`;
    }

    private parseAIResponse(response: string): AIAnalysisResult {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    intent: parsed.intent || 'unknown',
                    confidence: parsed.confidence || 0.5,
                    extractedData: parsed.extractedData || {},
                    requiredQuestions: parsed.requiredQuestions || [],
                    suggestedResponse: parsed.suggestedResponse || "How can I help you today?"
                };
            }
        } catch (error) {
            console.error('Failed to parse AI response:', error);
        }

        return {
            intent: 'unknown',
            confidence: 0,
            extractedData: {},
            requiredQuestions: [],
            suggestedResponse: response || "How can I help you with your DeFi needs today?"
        };
    }

    async generateFollowUpQuestion(intent: string, missingData: string[]): Promise<string> {
        const prompt = `
Generate a natural follow-up question for a DeFi trading assistant.

Intent: ${intent}
Missing Data: ${missingData.join(', ')}

Generate a single, conversational question to collect the missing information.
Be helpful and specific about what you need.
`;

        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error('Failed to generate follow-up question:', error);
            return "Could you provide more details about your request?";
        }
    }

    async validateTransactionData(data: TransactionData): Promise<{
        isValid: boolean;
        errors: string[];
        suggestions: string[];
    }> {
        const errors: string[] = [];
        const suggestions: string[] = [];

        if (data.type === 'swap') {
            if (!data.tokenIn) errors.push('Source token is required');
            if (!data.tokenOut) errors.push('Destination token is required');
            if (!data.amountIn) errors.push('Amount to swap is required');

            if (data.tokenIn === data.tokenOut) {
                errors.push('Source and destination tokens cannot be the same');
            }
        }

        if (data.type === 'fiat_conversion') {
            if (!data.tokenIn) errors.push('Token to convert is required');
            if (!data.amountIn && !data.fiatAmount) {
                errors.push('Either token amount or fiat amount is required');
            }
            if (!data.fiatCurrency) {
                suggestions.push('Consider specifying the fiat currency (NGN, USD, etc.)');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            suggestions
        };
    }
}
