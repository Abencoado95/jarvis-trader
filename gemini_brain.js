
// --------------------------------------------------------------------------
// GEMINI BRAIN INTEGRATION (SECRET MODE)
// Model: Gemini 1.5 Flash (Optimized for HFT)
// --------------------------------------------------------------------------
const INTERNAL_KEY = "AIzaSyDHaVHmWGFZfhinr_HUQVEEaY_V2DDE0NM"; // SECRET KEY

async function callGeminiBrain(candles, rsi, mr) {
    // 1. Secret Key Access
    const apiKey = INTERNAL_KEY; 
    
    if (!apiKey) {
        console.warn("⚠️ JARVIS BRAIN: Missing Neural Key.");
        return null;
    }

    // 2. Prepare Detailed Market Perception
    const recentCandles = candles.slice(-30).map(c => ({
        t: new Date(c.time * 1000).toLocaleTimeString(),
        o: c.open, h: c.high, l: c.low, c: c.close
    }));
    
    const context = {
        instrument: "Synthetic Volatility Index",
        current_price: mr.currentPrice,
        trend_ema_100: mr.ema,
        trend_status: mr.currentPrice > mr.ema ? "BULLISH (Above EMA)" : "BEARISH (Below EMA)",
        indicators: {
            rsi_14: rsi,
            z_score: mr.zScore,
            bollinger_upper: mr.upper,
            bollinger_lower: mr.lower,
            distance_from_ema: mr.currentPrice - mr.ema
        },
        market_structure: recentCandles.slice(-5) // Last 5 candles for pattern rec
    };

    // 3. The "Powerful" Prompt
    const prompt = `
    ROLE: You are JARVIS, an advanced High-Frequency Trading AI.
    TASK: Analyze the market microstructure and execute a binary option trade (1 Minute Duration).
    
    MARKET CONTEXT:
    ${JSON.stringify(context, null, 2)}
    
    STRATEGY PROTOCOLS:
    1. TREND FOLLOW: If Price is far from EMA and Momentum is strong (RSI 40-60), follow the trend.
    2. REVERSAL SNIPER: If Price hits Bollinger Bands (Z-Score > 2.0 or < -2.0) AND RSI is extreme (>70 or <30), SIGNAL REVERSAL immediately.
    3. EXHAUSTION: If 4+ candles of same color appear, look for weakness (wicks) to bet against them.
    
    DECISION LOGIC:
    - CALL if: Oversold (RSI < 30), Z-Score < -2.0, or Momentum Up in Uptrend.
    - PUT if: Overbought (RSI > 70), Z-Score > 2.0, or Momentum Down in Downtrend.
    - NEUTRO if: Indecisive, choppy, or middle of channel with no momentum.
    
    YOUR OUTPUT (JSON ONLY):
    {
        "signal": "CALL" | "PUT" | "NEUTRO",
        "confidence": 0-100,
        "reason": "Technical justification (e.g. 'RSI 85 + Upper BB Hit')"
    }
    `;

    // 4. Call Google Gemini API (v1beta)
    try {
        console.log("🧠 JARVIS THINKING...");
        // ENDPOINT FIX: Using 'gemini-1.5-flash-latest' to ensure availability
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.2 // Low temperature for precision
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(text);
            console.log(`🧠 JARVIS DECISION: ${result.signal} (${result.confidence}%) | ${result.reason}`);
            return result;
        }
    } catch (e) {
        console.error("❌ JARVIS BRAIN FAILURE:", e);
    }
    return null;
}
