
// --------------------------------------------------------------------------
// GEMINI 1.5 FLASH BRAIN INTEGRATION
// --------------------------------------------------------------------------
async function callGeminiBrain(candles, rsi, mr) {
    const apiKey = getEl('geminiKey').value;
    if (!apiKey) {
        console.warn("⚠️ GEMINI BRAIN: No API Key provided.");
        return null;
    }

    // 1. Prepare Data Context (Last 30 Candles + Indicators)
    const recentCandles = candles.slice(-30).map(c => ({
        t: new Date(c.time * 1000).toLocaleTimeString(),
        o: c.open, h: c.high, l: c.low, c: c.close
    }));
    
    const context = {
        market: "Volatility Index (Synthetic)",
        last_price: mr.currentPrice,
        indicators: {
            rsi: rsi,
            z_score: mr.zScore,
            ema_100: mr.ema,
            bollinger_upper: mr.upper,
            bollinger_lower: mr.lower
        },
        trend_context: mr.currentPrice > mr.ema ? "UPTREND" : "DOWNTREND",
        recent_candles: recentCandles
    };

    // 2. Construct Prompt
    const prompt = `
    You are an expert High-Frequency Trading AI for binary options.
    Analyze the provided market data (30 recent candles + Technical Indicators).
    
    GOAL: Predict the direction of the NEXT 1-minute candle.
    
    DATA:
    ${JSON.stringify(context, null, 2)}
    
    RULES:
    1. If RSI > 70 and Z-Score > 2.0 (Overbought), look for PUT (Reversal).
    2. If RSI < 30 and Z-Score < -2.0 (Oversold), look for CALL (Reversal).
    3. If Momentum is strong (e.g. 4+ same color candles), consider Exhaustion or Continuation based on Wick logic.
    4. Be precise. If uncertain, signal "NEUTRO".
    
    OUTPUT FORMAT (JSON ONLY):
    {
        "signal": "CALL" | "PUT" | "NEUTRO",
        "confidence": 0-100,
        "reason": "Short explanation"
    }
    `;

    // 3. Call API
    try {
        console.log("🧠 GEMINI THINKING...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(text);
            console.log(`🧠 GEMINI DECISION: ${result.signal} (${result.confidence}%) | ${result.reason}`);
            return result;
        }
    } catch (e) {
        console.error("❌ GEMINI ERROR:", e);
    }
    return null;
}
