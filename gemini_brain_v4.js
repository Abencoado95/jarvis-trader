/**
 * JARVIS TRADER - GEMINI BRAIN MODULE V3.0
 * Sistema Avançado de IA para Trading com Gemini 2.0 Flash
 */

class GeminiBrain {
    constructor() {
        // Tenta ler chave do input ou usa vazia
        // A chave hardcoded antiga estava vazada e foi removida por segurança
        this.API_KEY = ""; 
        
        // MODELO E ENDPOINT
        this.MODEL_ID = "gemini-2.5-flash"; 
        this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_ID}:generateContent`;
        
        this.cache = new Map();
        this.lastAnalysisTime = 0;
        this.isAnalyzing = false;
        
        console.log(`🧠 Gemini Brain Iniciado. Modelo: ${this.MODEL_ID}`);
    }
    
    getApiKey() {
        const input = document.getElementById('apiKeyInput');
        if (input && input.value.trim().length > 10) {
            return input.value.trim();
        }
        return this.API_KEY;
    }
    
    // Decisor Central
    async analyze(marketData, mode) {
        // SEPARAÇÃO DE ESTRATÉGIAS
        // 1. DÍGITOS (Alta Frequência) -> ANÁLISE LOCAL (Sem delay de API, não precisa de chave)
        if (mode === 'OVER_UNDER' || mode === 'MATCH_DIFFER') {
            const tech = this.calculateTechnicalIndicators(marketData);
            return this.analyzeDigitsLocal(tech, mode);
        }
        
        // 1.1. ACUMULADORES (HFT de Tendência) -> ANÁLISE LOCAL
        if (mode === 'ACCUMULATORS') {
            const tech = this.calculateTechnicalIndicators(marketData);
            return this.analyzeAccumulatorsLocal(tech);
        }
        
        // 2. PREÇO (Tendência) -> ANÁLISE GEMINI AI (Precisa de chave)
        return await this.analyzePriceWithAI(marketData, mode);
    }
    
    // --- ESTRATÉGIA LOCAL: ACCUMULADORES ---
    analyzeAccumulatorsLocal(tech) {
        // Regra de Ouro Acumuladores: Volatilidade Baixa + Tendência Contínua
        const candles = tech.lastCandles;
        if (candles.length < 20) return { action: 'WAIT', confidence: 0, reason: 'Coletando dados...' };
        
        const lastClose = candles[candles.length - 1].close;
        const emaFast = this.calculateEMA(candles, 9);
        const emaSlow = this.calculateEMA(candles, 21);
        
        // Volatilidade (Range médio das últimas 5 velas)
        const avgRange = candles.slice(-5).reduce((acc, c) => acc + (c.high - c.low), 0) / 5;
        const currentRange = candles[candles.length-1].high - candles[candles.length-1].low;
        
        // Se a vela atual for muito explosiva (> 2x média), perigo de spike
        const isVolatile = currentRange > (avgRange * 2.0);
        
        // Tendência de Alta
        const isUptrend = emaFast > emaSlow && lastClose > emaFast;
        
        if (!isVolatile && isUptrend) {
            return {
                action: 'ACCU', // Ação interna
                confidence: 90,
                reason: 'Tendência Estável e Baixa Volatilidade (Ideal para Acumular)'
            };
        }
        
        return {
            action: 'WAIT',
            confidence: 0,
            reason: isVolatile ? 'Volatilidade Alta (Perigo)' : 'Sem Tendência Definida'
        };
    }

    calculateEMA(candles, period) {
        // Implementação simplificada de EMA
        const k = 2 / (period + 1);
        let ema = candles[0].close;
        for (let i = 1; i < candles.length; i++) {
            ema = (candles[i].close * k) + (ema * (1 - k));
        }
        return ema;
    }

    // --- ESTRATÉGIAS DE DÍGITOS (ZERO LATENCY - V6 UNIVERSAL) ---
    analyzeDigitsLocal(tech, mode) {
        const digits = tech.candles.map(c => Math.floor(c.close * 100 % 10)); // Histórico (50)
        
        // 1. OBTER BARREIRA REAL (User Input)
        let barrier = 5;
        const digitInput = document.getElementById('digitSelect');
        if (digitInput) barrier = parseInt(digitInput.value);

        let action = 'WAIT';
        let confidence = 0;
        let reason = 'Analisando fluxo...';

        if (mode === 'OVER_UNDER') {
            // --- ESTRATÉGIA UNIVERSAL DE PROBABILIDADE + FLUXO ---

            const window = digits.slice(-20); // Janela de 20
            
            // Definição de Vitória para a Barreira Atual
            // Over N: > N
            // Under N: < N
            
            // 2. CÁLCULO DE PROBABILIDADE BASE (A Matemática não mente)
            const overWinSet = [0,1,2,3,4,5,6,7,8,9].filter(d => d > barrier);
            const underWinSet = [0,1,2,3,4,5,6,7,8,9].filter(d => d < barrier);
            
            const probOver = overWinSet.length * 10; // ex: Barrier 3 (4,5,6,7,8,9) = 60%
            const probUnder = underWinSet.length * 10; // ex: Barrier 3 (0,1,2) = 30% (7 perde em ambos)
            
            // 3. ANÁLISE DE TENDÊNCIA REAL (No Histórico Recente)
            const overWins = window.filter(d => d > barrier).length;
            const underWins = window.filter(d => d < barrier).length;
            
            const percOver = (overWins / window.length) * 100;
            const percUnder = (underWins / window.length) * 100;
            
            // 4. LÓGICA DE DECISÃO HÍBRIDA (Matemática + Tendência)
            
            // CENÁRIO A: MATEMÁTICA FAVORÁVEL (Prob > 50%)
            // O robô deve buscar confirmação para entrar a favor da estatística.
            
            if (probOver > 50) { 
                // CRITÉRIO DE FLUXO MAIS RIGOROSO (V7)
                // Antes: 40% (Aceitava contra-tendência leve). 
                // Agora: 55% (Exige tendência a favor ou neutralidade positiva).
                if (percOver >= 55) { 
                    action = 'OVER';
                    confidence = 75 + (percOver - 50); 
                    reason = `📊 Probabilidade Alta (${probOver}%) + Tendência Confirmada (${percOver.toFixed(0)}%).`;
                    
                    if (percOver > 80) confidence += 10; // Trend Fortíssima
                } else if (percOver < 30) {
                     // Reversão Sniper (Mantido, mas com cautela)
                     action = 'OVER';
                     confidence = 65; 
                     reason = `📉 Reversão à Média: Statisticamente deve subir (Prob ${probOver}%).`;
                }
            }
            
            else if (probUnder > 50) { 
                if (percUnder >= 55) { // Rigoroso 55%
                    action = 'UNDER';
                    confidence = 75 + (percUnder - 50);
                    reason = `📊 Probabilidade Alta (${probUnder}%) + Tendência Confirmada (${percUnder.toFixed(0)}%).`;
                    
                    if (percUnder > 80) confidence += 10;
                }
            }
            
            // CENÁRIO B: OPERAÇÃO DE RISCO (Prob < 40%) - O "SNIPER"
            // Só entra se ultima sequencia for MONSTRUOSA (Trend Following Absoluto)
            
            else {
                // Ex: Over 7 (Prob 20%). Só se 65% dos últimos foram Over.
                if (probOver < 40 && percOver >= 65) { 
                    action = 'OVER';
                    confidence = 70; 
                    reason = `🔥 FLUXO DE ALTA INTENSO: Surfando a onda contra a estatística.`;
                }
                
                if (probUnder < 40 && percUnder >= 65) {
                    action = 'UNDER';
                    confidence = 70;
                    reason = `❄️ FLUXO DE BAIXA INTENSO: Surfando a onda contra a estatística.`;
                }
            }
            
            // 5. FILTRO DE ÚLTIMO DÍGITO & REPETIÇÃO (V7)
            const lastDigit = digits[digits.length-1];
            // Se o último foi a barreira, penalidade (já existia)
            if ((action === 'OVER' || action === 'UNDER') && lastDigit === barrier) {
                confidence -= 20;
            }
            
            // FILTRO DE REPETIÇÃO TRIPLA (Novo)
            // Se os ultimos 3 digitos foram iguais, o mercado está travado.
            // Ex: 5, 5, 5. Não entre.
            const len = digits.length;
            if (len >= 3) {
                if (digits[len-1] === digits[len-2] && digits[len-2] === digits[len-3]) {
                     confidence = 0;
                     action = 'WAIT';
                     reason = "⚠️ Mercado Travado (Repetição Tripla). Aguardando.";
                }
            } 

        } else if (mode === 'MATCH_DIFFER') {
            // ESTRATÉGIA: SNIPER DE FLUXO E ESTATÍSTICA (V6)
            // Combinar repetição com ausência.
            
            const lookback = digits.slice(-50);
            const counts = {};
            const lastPosition = {};
            for(let i=0; i<=9; i++) { counts[i] = 0; lastPosition[i] = -1; }
            lookback.forEach((d, idx) => { counts[d]++; lastPosition[d] = idx; });
            
            let bestDigit = -1;
            let maxScore = -999;
            
            for(let d=0; d<=9; d++) {
                let score = 0;
                // 1. Frequência (Ideal 8-12%)
                const freq = (counts[d] / 50) * 100;
                if (freq === 0) score -= 50; 
                if (freq > 25) score -= 100; // Sai demais, perigo de MATCH
                if (freq >= 5 && freq <= 15) score += 30; // Zona Segura
                
                // 2. Recência (Ticks atrás)
                const ticksAgo = (lookback.length - 1) - lastPosition[d];
                if (ticksAgo === 0) score -= 200; // ACABOU DE SAIR! ABORTAR!
                if (ticksAgo === 1) score -= 50;
                if (ticksAgo >= 4 && ticksAgo <= 15) score += 40; // Zona de Ouro
                
                // 3. Modificador de Usuário (Barreira Selecionada)
                // Se o usuário selecionou um digito, damos peso a ele SE for seguro
                if (d === barrier) score += 10; 

                if (score > maxScore) {
                    maxScore = score;
                    bestDigit = d;
                }
            }
            
            // Validar Escolha do Usuário vs Sugestão da IA
            const userChoice = barrier; // O que está no select
            // Se o usuário quer apostar em X, mas X é perigoso (score baixo), avisamos ou trocamos?
            // V6: Se DIFFER, vamos sempre no MAIS SEGURO (BestDigit). 
            // Mas precisamos respeitar se for Manual. Se for AUTO, a IA decide.
            
            // Para UI feedback:
            this.predictedDigit = bestDigit;
            
            if (maxScore > 0) {
                action = 'DIFFER';
                confidence = 88;
                reason = `🎯 Alvo V6: Dígito ${bestDigit} (Score ${maxScore}). Seguro.`;
            } else {
                 action = 'DIFFER';
                 confidence = 60;
                 // Fallback seguro
                 const safe = [0,1,2,3,4,5,6,7,8,9].filter(d => d !== digits[digits.length-1])[0];
                 this.predictedDigit = safe;
                 reason = `⚠️ Mercado Instável. Alvo fallback: ${safe}`;
            }
        }

        return { action, confidence, prediction: this.predictedDigit, reason };
    }

    // --- ESTRATÉGIAS DE PREÇO (GEMINI AI) ---
    async analyzePriceWithAI(marketData, mode) {
        const now = Date.now();
        if (this.lastAnalysis && (now - this.lastAnalysis.timestamp < 15000)) {
            console.log("🧠 Usando análise em cache (Rate Limit Protection)");
            return this.lastAnalysis.analysis;
        }

        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.warn("⚠️ API Key não configurada");
            return { action: 'WAIT', confidence: 0, reason: 'Cole sua API Key do Google Gemini no painel!' };
        }

        if (this.isAnalyzing) return { action: 'WAIT', confidence: 0, reason: 'Análise em andamento...' };
        
        try {
            this.isAnalyzing = true;
            const tech = this.calculateTechnicalIndicators(marketData);
            const prompt = this.buildAdvancedPrompt(tech, mode);
            
            // CHAMADA API
            const response = await fetch(`${this.baseUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 1024
                    }
                })
            });
            
            if (response.status === 403) {
                // Se der 403 mesmo com chave nova, informa erro
                const err = await response.json();
                console.error("API 403:", err);
                throw new Error("Chave API inválida ou sem permissão para Gemini 2.5 (Use AI Studio para gerar)");
            }

            if (!response.ok) {
                // FALLBACK LOCAL SE API FALHAR (ex: 429)
                console.warn(`⚠️ API Error ${response.status}: Usando Lógica Local de Fallback`);
                const localResult = this.runLocalAnalysis(tech, mode);
                return localResult;
            }

            const data = await response.json();
            
            if (!data.candidates) {
                console.log("No candidates:", data);
                return { action: 'WAIT', confidence: 0, reason: 'Sem resposta da IA' };
            }
            
            const result = this.parseResponse(data, mode);
            this.lastAnalysis = { timestamp: now, analysis: result };
            return result;

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

// 1. OBTER BARREIRA REAL (User Input)
        let barrier = 5;
        if (typeof document !== 'undefined' && document.getElementById('digitSelect')) {
            barrier = parseInt(document.getElementById('digitSelect').value);
        }

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

ALVO SELECIONADO PELO USUÁRIO (BARREIRA): ${barrier}

FOCO: Prever se o ÚLTIMO DÍGITO do próximo tick vai REPETIR (MATCH) ou MUDAR (DIFFER).
ESTATÍSTICA: DIFFER ganha 90% das vezes. MATCH paga 9x (Risco Extremo).

ÚLTIMOS DÍGITOS OBSERVADOS:
${this.extractDigits(technicalData.lastCandles)}

ANÁLISE DE FLUXO (V6 UNIVERSAL):
1. DÍGITO DORMENHOR (${barrier}): Se o dígito ${barrier} não sai há muito tempo (>30 ticks), ele PODE ACORDAR AGORA (Perigo para Differ).
2. DÍGITO QUENTE: Se o dígito ${barrier} saiu recentemente (3-10 ticks atrás), é "Morno" e seguro para DIFFER.
3. FLUXO DE REPETIÇÃO: Se houve dígitos iguais recentes (ex: 7, 7), o mercado está em "Clumping Mode". Cuidado com Differ.

DECISÃO INTELIGENTE:
- MATCH: (MUITO ARRISCADO) Apenas se houver um padrão claro de repetição do dígito ${barrier}.
- DIFFER: (RECOMENDADO) Se o dígito ${barrier} não for um "Dorminhoco Prestes a Acordar" e não acabamos de ter um Match.

RESPONDA APENAS EM JSON:
{
    "action": "MATCH" ou "DIFFER",
    "confidence": 0-100,
    "reason": "análise de frequência e recência"
}`,

            'OVER_UNDER': `
=== MODALIDADE: OVER/UNDER (ANÁLISE AVANÇADA V6) ===

BARREIRA DEFINIDA PELO USUÁRIO: ${barrier}

REGRAS DE VITÓRIA (CRUCIAL):
- AÇÃO "OVER": Ganha se o dígito for MAIOR que ${barrier}. (Dígitos: ${[0,1,2,3,4,5,6,7,8,9].filter(d => d > barrier).join(',')})
- AÇÃO "UNDER": Ganha se o dígito for MENOR que ${barrier}. (Dígitos: ${[0,1,2,3,4,5,6,7,8,9].filter(d => d < barrier).join(',')})
- O DÍGITO ${barrier} SEMPRE PERDE EM AMBOS (EMPATE TÉCNICO É LOSS).

PROBABILIDADE BASE:
- Chance de OVER: ${[0,1,2,3,4,5,6,7,8,9].filter(d => d > barrier).length * 10}%
- Chance de UNDER: ${[0,1,2,3,4,5,6,7,8,9].filter(d => d < barrier).length * 10}%

DISTRIBUIÇÃO DOS ÚLTIMOS 20 DÍGITOS:
${this.analyzeDigitDistribution(technicalData.lastCandles)}

INSTRUÇÕES DE ELITE:
1. RESPEITE A MATEMÁTICA: Se a Probabilidade Base for < 40% (Ex: Over 7 = 20%), NÃO APOSTE nisso a menos que haja um fluxo massivo de dígitos altos (8,9) nos últimos 10 ticks.
2. BUSQUE O FLUXO: Se a Probabilidade for > 50% (Ex: Under 7 = 70%), CONFRONTE com a tendência recente. Se a tendência confirma (muitos dígitos baixos), é ENTRADA CONFIRMADA.
3. EVITE ARMADILHAS: Se estamos em "Under 7" mas saíram três "8" seguidos, NÃO ENTRE. O mercado viciou em altos.

DECISÃO:
- OVER: Se Probabilidade favorável OU Fluxo Intenso de Altos.
- UNDER: Se Probabilidade favorável OU Fluxo Intenso de Baixos.

RESPONDA APENAS EM JSON:
{
    "action": "OVER" ou "UNDER",
    "confidence": 0-100,
    "reason": "análise de probabilidade x fluxo"
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
        
        let barrier = 5;
        if (typeof document !== 'undefined' && document.getElementById('digitSelect')) {
            barrier = parseInt(document.getElementById('digitSelect').value);
        }

        const over = digits.filter(d => d > barrier).length;
        const under = digits.filter(d => d < barrier).length;
        const exact = digits.filter(d => d === barrier).length;
        
        return `OVER (> ${barrier}): ${over} | UNDER (< ${barrier}): ${under} | EXACT (= ${barrier}): ${exact}`;
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
