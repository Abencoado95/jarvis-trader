/**
 * JARVIS TRADER - GEMINI BRAIN MODULE V3.0
 * Sistema Avançado de IA para Trading com Gemini 2.0 Flash
 */

class GeminiBrain {
    constructor() {
        // Chave API
        this.API_KEY = "AIzaSyDHaVHmWGFZfhinr_HUQVEEaY_V2DDE0NM";
        
        // MODELO CONFIRMADO DISPONÍVEL NA API
        this.MODEL_ID = "gemini-2.5-flash"; 
        
        // Endpoint correto da API Gemini
        this.baseUrl = `https://generativelanguage.googleapis.com/v1/models/${this.MODEL_ID}:generateContent`;
        
        this.cache = new Map();
        this.lastAnalysisTime = 0;
        this.isAnalyzing = false;
        
        console.log(`🧠 Gemini Brain Iniciado. Modelo: ${this.MODEL_ID}`);
        console.log(`📡 Endpoint: ${this.baseUrl}`);
    }
    
    /**
     * ANÁLISE PROFUNDA DE MERCADO
     * Sistema multi-camadas de análise técnica
     */
    async analyze(marketData, mode = 'RISE_FALL') {
        const now = Date.now();
        
        // RATE LIMIT CACHE: Evita chamadas em menos de 15s
        if (this.lastAnalysis && (now - this.lastAnalysis.timestamp < 15000)) {
            console.log("🧠 Usando análise em cache (Rate Limit Protection)");
            return this.lastAnalysis.analysis;
        }

        if (this.isAnalyzing) {
            return { action: 'WAIT', confidence: 0, reason: 'Análise em andamento...' };
        }
        
        this.isAnalyzing = true;
        
        try {
            // 1. PREPARAR DADOS TÉCNICOS
            const technicalData = this.calculateTechnicalIndicators(marketData);
            
            // 2. CONSTRUIR PROMPT AVANÇADO
            const prompt = this.buildAdvancedPrompt(technicalData, mode);
            
            // 3. CHAMAR GEMINI (MODELO SELECIONADO PELO USER)
            const response = await fetch(`${this.baseUrl}?key=${this.API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topK: 20,
                        topP: 0.8,
                        maxOutputTokens: 2048
                    }
                })
            });
            
            if (!response.ok) {
                // FALLBACK LOCAL SE API FALHAR (ex: 429)
                console.warn(`⚠️ API Error ${response.status}: Usando Lógica Local de Fallback`);
                const localResult = this.runLocalAnalysis(technicalData, mode);
                this.isAnalyzing = false;
                return localResult;
            }
            
            const data = await response.json();
            const analysis = this.parseResponse(data, mode);
            
            // 4. SALVAR HISTÓRICO
            this.lastAnalysis = {
                timestamp: now,
                analysis: analysis
            };
            
            return analysis;
            
        } catch (error) {
            console.error("❌ Gemini Brain Error:", error);
            // FALLBACK LOCAL EM CASO DE ERRO DE REDE
            console.warn("⚠️ API Failure: Usando Lógica Local de Fallback");
            const localResult = this.runLocalAnalysis(this.calculateTechnicalIndicators(marketData), mode);
            return localResult;
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * LÓGICA LOCAL DE FALLBACK (Se a IA estiver offline/limitada)
     */
    runLocalAnalysis(tech, mode) {
        let action = 'WAIT';
        let confidence = 0;
        let reason = 'Análise Técnica Local (Fallback)';
        
        const rsi = tech.indicators.rsi;
        const price = tech.currentPrice;
        const bb = tech.indicators.bollinger;
        const barrier = document.getElementById('digitSelect') ? parseInt(document.getElementById('digitSelect').value) : 5;

        // Lógica Simplificada de Fallback
        if (mode === 'RISE_FALL') {
            if (rsi < 35 && price < bb.lower) {
                action = 'CALL';
                confidence = 85;
                reason = `Local: RSI Sobrevenda (${rsi.toFixed(1)}) + Preço abaixo da Banda`;
            } else if (rsi > 65 && price > bb.upper) {
                action = 'PUT';
                confidence = 85;
                reason = `Local: RSI Sobrecompra (${rsi.toFixed(1)}) + Preço acima da Banda`;
            }
        } 
        else if (mode === 'OVER_UNDER') {
            // Lógica Genérica para Digit Over/Under baseada em Momentum
            // Se RSI está subindo, tende a ter dígitos maiores
            if (barrier >= 5) {
                if (rsi > 55) {
                    action = 'OVER';
                    confidence = 75;
                    reason = `Local: RSI em alta (${rsi.toFixed(1)}) favorece dígitos altos`;
                }
            } else {
                if (rsi < 45) {
                    action = 'UNDER';
                    confidence = 75;
                    reason = `Local: RSI em baixa (${rsi.toFixed(1)}) favorece dígitos baixos`;
                }
            }
        }
        else if (mode === 'MATCH_DIFFER') {
            // Estatisticamente, DIFFER é muito mais seguro
            action = 'DIFFER';
            confidence = 88;
            reason = 'Local: Probabilidade estatística favorece DIFFER';
        }
        else if (mode === 'ACCUMULATORS') {
            // Se volatilidade baixa, acumular
            const isLowVol = tech.indicators.atr < 0.005 || (bb.upper - bb.lower) < 0.005;
            if (isLowVol) {
                action = 'ACCUMULATE';
                confidence = 80;
                reason = 'Local: Baixa volatilidade detectada (ATR/BB)';
            }
        }

        return { action, confidence, reason };
    }

    
    /**
     * CÁLCULO DE INDICADORES TÉCNICOS
     * RSI, Bollinger Bands, EMA, MACD, Volume Profile
     */
    calculateTechnicalIndicators(marketData) {
        const candles = marketData.candles || [];
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume || 1);
        
        return {
            // Preço Atual
            currentPrice: marketData.currentPrice || closes[closes.length - 1],
            
            indicators: {
                // RSI (14 períodos)
                rsi: this.calculateRSI(closes, 14),
                
                // Bollinger Bands (20, 2)
                bollinger: this.calculateBollingerBands(closes, 20, 2),
                
                // EMAs
                ema9: this.calculateEMA(closes, 9),
                ema21: this.calculateEMA(closes, 21),
                ema50: this.calculateEMA(closes, 50),
                
                // MACD
                macd: this.calculateMACD(closes),
                
                // ATR (Volatilidade)
                atr: this.calculateATR(highs, lows, closes, 14),
                
                // Momentum
                momentum: this.calculateMomentum(closes, 10)
            },
            
            // Padrões de Candlestick
            patterns: this.detectCandlestickPatterns(candles.slice(-5)),
            
            // Tendência
            trend: this.detectTrend(closes),
            
            // Suporte e Resistência
            levels: this.findSupportResistance(highs, lows),
            
            // Volume Profile
            volumeProfile: this.analyzeVolume(volumes),

            // Dados brutos
            candles: candles.slice(-50),
            lastCandles: candles.slice(-10)
        };
    }
    
    /**
     * RSI (Relative Strength Index)
     */
    calculateRSI(closes, period = 14) {
        if (closes.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = closes.length - period; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    /**
     * Bollinger Bands
     */
    calculateBollingerBands(closes, period = 20, stdDev = 2) {
        if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
        
        const slice = closes.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        return {
            upper: sma + (stdDev * std),
            middle: sma,
            lower: sma - (stdDev * std)
        };
    }
    
    /**
     * EMA (Exponential Moving Average)
     */
    calculateEMA(closes, period) {
        if (closes.length < period) return closes[closes.length - 1];
        
        const k = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < closes.length; i++) {
            ema = (closes[i] * k) + (ema * (1 - k));
        }
        
        return ema;
    }
    
    /**
     * MACD (Moving Average Convergence Divergence)
     */
    calculateMACD(closes) {
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macdLine = ema12 - ema26;
        
        return {
            macd: macdLine,
            signal: macdLine * 0.9, // Simplificado
            histogram: macdLine * 0.1
        };
    }
    
    /**
     * ATR (Average True Range) - Volatilidade
     */
    calculateATR(highs, lows, closes, period = 14) {
        if (highs.length < period + 1) return 0;
        
        let tr = 0;
        for (let i = highs.length - period; i < highs.length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevClose = closes[i - 1];
            
            tr += Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
        }
        
        return tr / period;
    }
    
    /**
     * Detectar Padrões de Candlestick
     */
    detectCandlestickPatterns(candles) {
        if (candles.length < 3) return [];
        
        const patterns = [];
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        
        const body = Math.abs(last.close - last.open);
        const range = last.high - last.low;
        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;
        
        // Doji
        if (body < range * 0.1) patterns.push('DOJI');
        
        // Hammer
        if (lowerWick > body * 2 && upperWick < body * 0.3) patterns.push('HAMMER');
        
        // Shooting Star
        if (upperWick > body * 2 && lowerWick < body * 0.3) patterns.push('SHOOTING_STAR');
        
        // Engulfing
        if (last.close > last.open && prev.close < prev.open && 
            last.close > prev.open && last.open < prev.close) {
            patterns.push('BULLISH_ENGULFING');
        }
        
        return patterns;
    }
    
    /**
     * Detectar Tendência
     */
    detectTrend(closes) {
        if (closes.length < 20) return 'NEUTRAL';
        
        const recent = closes.slice(-20);
        const older = closes.slice(-40, -20);
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        const diff = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        if (diff > 0.5) return 'UPTREND';
        if (diff < -0.5) return 'DOWNTREND';
        return 'SIDEWAYS';
    }
    
    /**
     * Encontrar Suporte e Resistência
     */
    findSupportResistance(highs, lows) {
        const recent = highs.slice(-50);
        const recentLows = lows.slice(-50);
        
        return {
            resistance: Math.max(...recent),
            support: Math.min(...recentLows)
        };
    }
    
    /**
     * Analisar Volume
     */
    analyzeVolume(volumes) {
        if (volumes.length < 20) return 'NORMAL';
        
        const recent = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        
        if (recent > avg * 1.5) return 'HIGH';
        if (recent < avg * 0.5) return 'LOW';
        return 'NORMAL';
    }
    
    /**
     * Calcular Momentum
     */
    calculateMomentum(closes, period = 10) {
        if (closes.length < period) return 0;
        
        const current = closes[closes.length - 1];
        const past = closes[closes.length - period];
        
        return ((current - past) / past) * 100;
    }
    
    /**
     * CONSTRUIR PROMPT AVANÇADO PARA GEMINI 2.0
     */
    buildAdvancedPrompt(technicalData, mode) {
        const i = technicalData.indicators;
        const bb = i.bollinger; // Acesso corrigido ao bollinger
        
        const basePrompt = `Você é JARVIS, um sistema de IA especializado em trading de opções binárias.
Sua missão é analisar os dados técnicos do mercado e fornecer uma decisão de trade PRECISA e CONFIÁVEL.

=== DADOS TÉCNICOS DO MERCADO ===

PREÇO ATUAL: ${technicalData.currentPrice}

INDICADORES:
- RSI (14): ${i.rsi.toFixed(2)} ${i.rsi > 70 ? '⚠️ SOBRECOMPRADO' : i.rsi < 30 ? '⚠️ SOBREVENDIDO' : '✓ NEUTRO'}
- Bollinger Bands:
  * Superior: ${bb.upper.toFixed(4)}
  * Média: ${bb.middle.toFixed(4)}
  * Inferior: ${bb.lower.toFixed(4)}
  * Posição: ${this.getBBPosition(technicalData.currentPrice, bb)}

- EMAs:
  * EMA 9: ${i.ema9.toFixed(4)}
  * EMA 21: ${i.ema21.toFixed(4)}
  * EMA 50: ${i.ema50.toFixed(4)}
  * Alinhamento: ${this.getEMAAlignment(i)}

- MACD:
  * Linha: ${i.macd.macd.toFixed(4)}
  * Sinal: ${i.macd.signal.toFixed(4)}
  * Histograma: ${i.macd.histogram.toFixed(4)}
  * Status: ${i.macd.histogram > 0 ? 'BULLISH' : 'BEARISH'}

- ATR (Volatilidade): ${i.atr.toFixed(4)} ${i.atr > 0.01 ? '⚠️ ALTA' : '✓ BAIXA'}

- Tendência: ${technicalData.trend}
- Momentum (10): ${i.momentum.toFixed(2)}%
- Volume: ${technicalData.volumeProfile}

- Padrões de Candlestick: ${technicalData.patterns.length > 0 ? technicalData.patterns.join(', ') : 'Nenhum padrão detectado'}

- Níveis:
  * Resistência: ${technicalData.levels.resistance.toFixed(4)}
  * Suporte: ${technicalData.levels.support.toFixed(4)}

ÚLTIMOS 5 CANDLES:
${this.formatCandles(technicalData.lastCandles)}

`;

        const modeStrategies = {
            'RISE_FALL': `
=== MODALIDADE: RISE/FALL (ANÁLISE DE PREÇO) ===

FOCO: Prever se o PREÇO vai SUBIR ou DESCER.

DADOS ATUAIS:
- Preço: ${technicalData.currentPrice}
- RSI: ${i.rsi.toFixed(1)} ${i.rsi > 70 ? '(SOBRECOMPRA)' : i.rsi < 30 ? '(SOBREVENDA)' : '(NEUTRO)'}
- Tendência: ${technicalData.trend}
- MACD: ${i.macd.histogram > 0 ? 'POSITIVO (Alta)' : 'NEGATIVO (Baixa)'}

DECISÃO:
- CALL: Se RSI < 35 E preço tocou suporte E MACD virando positivo
- PUT: Se RSI > 65 E preço tocou resistência E MACD virando negativo
- WAIT: Se sinais conflitantes

RESPONDA APENAS EM JSON:
{
    "action": "CALL" ou "PUT" ou "WAIT",
    "confidence": 0-100,
    "reason": "explicação curta"
}`,

            'MATCH_DIFFER': `
=== MODALIDADE: MATCH/DIFFER (ANÁLISE DE DÍGITOS) ===

FOCO: Prever se o ÚLTIMO DÍGITO do próximo tick vai REPETIR (MATCH) ou MUDAR (DIFFER).

ÚLTIMOS DÍGITOS OBSERVADOS:
${this.extractDigits(technicalData.lastCandles)}

ANÁLISE:
1. Se há 3+ dígitos DIFERENTES seguidos → Próximo tende a MATCH
2. Se há 2+ dígitos IGUAIS seguidos → Próximo tende a DIFFER
3. Volatilidade ALTA (ATR > 0.005) → Favorece DIFFER

DECISÃO:
- MATCH: Se padrão indica repetição provável
- DIFFER: Se padrão indica mudança provável (MAIS SEGURO estatisticamente)

RESPONDA APENAS EM JSON:
{
    "action": "MATCH" ou "DIFFER",
    "confidence": 0-100,
    "reason": "padrão identificado"
}`,

            'OVER_UNDER': `
=== MODALIDADE: OVER/UNDER (ANÁLISE DE DÍGITOS) ===

FOCO: Prever se o ÚLTIMO DÍGITO do próximo tick será MAIOR (OVER) ou MENOR (UNDER) que 5.

DISTRIBUIÇÃO DOS ÚLTIMOS DÍGITOS:
${this.analyzeDigitDistribution(technicalData.lastCandles)}

MOMENTUM ATUAL:
- RSI: ${i.rsi.toFixed(1)} ${i.rsi > 55 ? '(ALTA - Favorece dígitos altos)' : i.rsi < 45 ? '(BAIXA - Favorece dígitos baixos)' : '(NEUTRO)'}

DECISÃO:
- OVER: Se RSI > 55 E maioria dos últimos dígitos foram baixos (0-4)
- UNDER: Se RSI < 45 E maioria dos últimos dígitos foram altos (6-9)

RESPONDA APENAS EM JSON:
{
    "action": "OVER" ou "UNDER",
    "confidence": 0-100,
    "reason": "análise de distribuição"
}`,

            'ACCUMULATORS': `
=== MODALIDADE: ACCUMULATORS (ANÁLISE DE PREÇO - BAIXA VOLATILIDADE) ===

FOCO: Identificar se o mercado está CALMO o suficiente para acumular lucro sem knockout.

VOLATILIDADE ATUAL:
- ATR: ${i.atr.toFixed(4)} ${i.atr < 0.005 ? '(BAIXA - IDEAL)' : '(ALTA - RISCO)'}
- Tendência: ${technicalData.trend} ${technicalData.trend === 'SIDEWAYS' ? '(IDEAL)' : '(RISCO)'}
- Largura Bollinger: ${(bb.upper - bb.lower).toFixed(4)}

DECISÃO:
- ACCUMULATE: Se ATR < 0.005 E tendência SIDEWAYS E baixo volume
- WAIT: Se volatilidade alta ou tendência forte

RESPONDA APENAS EM JSON:
{
    "action": "ACCUMULATE" ou "WAIT",
    "confidence": 0-100,
    "reason": "análise de volatilidade"
}`
        };

        return basePrompt + (modeStrategies[mode] || modeStrategies['RISE_FALL']);
    }
    
    // Funções auxiliares para o prompt
    getBBPosition(price, bb) {
        if (price >= bb.upper) return '⚠️ ACIMA DA BANDA SUPERIOR';
        if (price <= bb.lower) return '⚠️ ABAIXO DA BANDA INFERIOR';
        if (price > bb.middle) return '↗️ ACIMA DA MÉDIA';
        return '↘️ ABAIXO DA MÉDIA';
    }
    
    getEMAAlignment(data) {
        if (data.ema9 > data.ema21 && data.ema21 > data.ema50) return '🟢 BULLISH (9>21>50)';
        if (data.ema9 < data.ema21 && data.ema21 < data.ema50) return '🔴 BEARISH (9<21<50)';
        return '🟡 MISTO';
    }
    
    formatCandles(candles) {
        return candles.slice(-5).map((c, i) => 
            `${i + 1}. O:${c.open.toFixed(4)} H:${c.high.toFixed(4)} L:${c.low.toFixed(4)} C:${c.close.toFixed(4)} ${c.close > c.open ? '🟢' : '🔴'}`
        ).join('\n');
    }
    
    extractDigits(candles) {
        return candles.map(c => {
            const digit = Math.floor((c.close * 10000) % 10);
            return digit;
        }).join(', ');
    }
    
    analyzeDigitDistribution(candles) {
        const digits = candles.map(c => Math.floor((c.close * 10000) % 10));
        const over = digits.filter(d => d > 5).length;
        const under = digits.filter(d => d <= 5).length;
        return `OVER (6-9): ${over} | UNDER (0-5): ${under}`;
    }
    
    /**
     * Parse da resposta do Gemini
     */
    parseResponse(apiResponse, mode) {
        try {
            const text = apiResponse.candidates[0].content.parts[0].text;
            
            // Extrair JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const decision = JSON.parse(jsonMatch[0]);
                return {
                    action: decision.action || 'WAIT',
                    confidence: decision.confidence || 0,
                    reason: decision.reason || 'Análise concluída',
                    metadata: decision
                };
            }
            
            // Fallback
            return this.parseTextResponse(text, mode);
            
        } catch (error) {
            console.error("Parse Error:", error);
            return {
                action: 'WAIT',
                confidence: 0,
                reason: 'Erro ao interpretar resposta'
            };
        }
    }
    
    parseTextResponse(text, mode) {
        const lower = text.toLowerCase();
        let action = 'WAIT';
        
        // Detectar ação baseado no modo
        if (mode === 'RISE_FALL') {
            if (lower.includes('call') || lower.includes('compra')) action = 'CALL';
            else if (lower.includes('put') || lower.includes('venda')) action = 'PUT';
        } else if (mode === 'MATCH_DIFFER') {
            if (lower.includes('match')) action = 'MATCH';
            else if (lower.includes('differ')) action = 'DIFFER';
        } else if (mode === 'OVER_UNDER') {
            if (lower.includes('over')) action = 'OVER';
            else if (lower.includes('under')) action = 'UNDER';
        } else if (mode === 'ACCUMULATORS') {
            if (lower.includes('accumulate')) action = 'ACCUMULATE';
        }
        
        // Detectar confiança
        let confidence = 50;
        const confMatch = text.match(/(\d+)%/);
        if (confMatch) confidence = parseInt(confMatch[1]);
        
        return {
            action: action,
            confidence: confidence,
            reason: text.substring(0, 300)
        };
    }
    
    getHistory(limit = 10) {
        return this.analysisHistory.slice(-limit);
    }
    
    clearHistory() {
        this.analysisHistory = [];
        this.lastAnalysis = null;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.GeminiBrain = GeminiBrain;
}
