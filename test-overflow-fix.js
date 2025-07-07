// Test script to verify the overflow fix
const { validateAndFormatAmount } = require('./src/lib/ekuboApi.ts');

console.log('🧪 Testing overflow fix...');

// Test cases that should work with the new fix
const testCases = [
    {
        name: 'Zero minimum amount (should be valid now)',
        amount: '0',
        decimals: 18,
        expectedValid: true
    },
    {
        name: 'Very small quote amount',
        amount: '0.000001',
        decimals: 18,
        expectedValid: true
    },
    {
        name: 'Normal amount',
        amount: '1.5',
        decimals: 18,
        expectedValid: true
    },
    {
        name: 'Large amount',
        amount: '1000',
        decimals: 6,
        expectedValid: true
    }
];

testCases.forEach(testCase => {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Input: "${testCase.amount}" (${testCase.decimals} decimals)`);

    try {
        const result = validateAndFormatAmount(testCase.amount, testCase.decimals);
        const isValid = result.isValid === testCase.expectedValid;

        console.log(`   Result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Valid: ${result.isValid}`);
        console.log(`   Formatted: ${result.formattedAmount}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
    }
});

console.log('\n🎯 Overflow fix test completed!'); 