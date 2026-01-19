#!/bin/bash
# 🧪 Verification Script - AI Parser v2.0
# Esegui questo script per verificare che le modifiche sono state applicate correttamente

echo "🔍 Verifying AI Parser v2.0 Implementation..."
echo ""

# 1. Check JSON Mode in backend
echo "📋 Check 1: JSON Mode in api-proxy-server.js"
if grep -q "responseMimeType: 'application/json'" api-proxy-server.js; then
    echo "✅ JSON Mode found in callGemini()"
else
    echo "❌ JSON Mode NOT found in api-proxy-server.js"
    echo "   Please add: responseMimeType: 'application/json' at line ~75"
fi
echo ""

# 2. Check parseRelativeDate function
echo "📋 Check 2: parseRelativeDate() function"
if grep -q "function parseRelativeDate" src/services/aiParser.js; then
    echo "✅ parseRelativeDate() found"
    # Count supported patterns
    local patterns=$(grep -c "ieri\|oggi\|domani\|giorni fa\|fra" src/services/aiParser.js)
    echo "   Patterns supported: ~$patterns"
else
    echo "❌ parseRelativeDate() NOT found"
    echo "   Please add function at line ~155"
fi
echo ""

# 3. Check empty sessions filter
echo "📋 Check 3: Empty sessions filter in findDayChunks()"
if grep -q "const isEmpty.*niente.*riposo.*nulla" src/services/aiParser.js; then
    echo "✅ Empty sessions filter found"
else
    echo "❌ Empty sessions filter NOT found"
    echo "   Please add filter at line ~210"
fi
echo ""

# 4. Check Intent vs Reality in prompt
echo "📋 Check 4: Intent vs Reality in AI_SYSTEM_PROMPT"
if grep -q "INTENT vs REALITY" src/services/aiParser.js; then
    echo "✅ Intent vs Reality section found"
    if grep -q "Volevo fare 35.*36.2" src/services/aiParser.js; then
        echo "   ✅ Example included"
    else
        echo "   ⚠️  Example might be missing"
    fi
else
    echo "❌ Intent vs Reality section NOT found"
    echo "   Please add to AI_SYSTEM_PROMPT at line ~6"
fi
echo ""

# 5. Check relative date preprocessing
echo "📋 Check 5: Relative date preprocessing in parseTrainingWithAI()"
if grep -q "relativeDateMatch.*trimmed.match" src/services/aiParser.js; then
    echo "✅ Relative date preprocessing found"
else
    echo "❌ Relative date preprocessing NOT found"
    echo "   Please add at line ~550 in parseTrainingWithAI()"
fi
echo ""

# 6. Check JSON parsing simplification
echo "📋 Check 6: Simplified JSON parsing (no .replace chains)"
local replace_count=$(grep -c "jsonStr.replace" src/services/aiParser.js)
if [ "$replace_count" -lt 5 ]; then
    echo "✅ JSON parsing simplified (old chain removed)"
    echo "   Replace count: $replace_count (was 8+)"
else
    echo "⚠️  JSON parsing might still have old replace chains"
    echo "   Replace count: $replace_count"
fi
echo ""

echo "════════════════════════════════════════"
echo "✅ Verification Complete!"
echo ""
echo "Next Steps:"
echo "1. Run the 3 stress tests in the UI"
echo "2. Check browser console for logs"
echo "3. Monitor error rate for 7 days"
echo ""
echo "Documentation:"
echo "- AI_PARSER_IMPROVEMENTS.md - Detailed changes"
echo "- STRESS_TEST_INSTRUCTIONS.md - How to test"
echo "- QUICK_REFERENCE.md - Cheat sheet"
