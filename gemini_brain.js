/**
 * JARVIS TRADER - GEMINI BRAIN MODULE
 * Sistema de IA para análise e decisão de trades
 */

class GeminiBrain {
    constructor() {
        this.apiKey = "AIzaSyDHaVHmWGFZfhinr_HUQVEEaY_V2DDE0NM";
        this.model = "gemini-2.0-flash-exp";
        this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        this.analysisHistory = [];
        this.lastAnalysis = null;
    }
    
    /**
     * Analisa o mercado e retorna decisão de trade
     * @param {Object} marketData - Dados do mercado (candles, indicators, etc)
     * @param {String} mode - Modo de operação (RISE_FALL, MATCH_DIFFER, etc)
     * @returns {Promise<Object>} - Decisão de trade com confiança
     */
    async analyze(marketData, mode = 'RISE_FALL') {
        try {
            const prompt = this.buildPrompt(marketData, mode);
            
            const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            const analysis = this.parseResponse(data);
            
            this.lastAnalysis = analysis;
            this.analysisHistory.push({
                timestamp: Date.now(),
                mode: mode,
                analysis: analysis
            });
            
            return analysis;
            
        } catch (error) {
            console.error("❌ Gemini Brain Error:", error);
            return {
                action: 'WAIT',
                confidence: 0,
                reason: 'Erro na análise: ' + error.message
            };
        }
    }
    
    /**
     * Constrói o prompt baseado no modo de operação
     */
    buildPrompt(marketData, mode) {
        const baseContext = `Você é JARVIS, uma IA especializada em trading de opções binárias.
Analise os dados do mercado e forneça uma decisão de trade.

DADOS DO MERCADO:
${JSON.stringify(marketData, null, 2)}

MODO DE OPERAÇÃO: ${mode}
`;
        
        const modeInstructions = {
            'RISE_FALL': `
ESTRATÉGIA RISE/FALL:
- Analise reversão de tendência usando Bollinger Bands
- Identifique zonas de sobrecompra/sobrevenda (RSI)
- Procure por padrões de candlestick de reversão
- Considere a força da tendência atual

RESPONDA NO FORMATO JSON:
{
    "action": "CALL" ou "PUT" ou "WAIT",
    "confidence": 0-100,
    "reason": "explicação breve da decisão",
    "entry_price": preço sugerido,
    "stop_loss": nível de stop,
    "take_profit": nível de lucro
}`,
            
            'MATCH_DIFFER': `
ESTRATÉGIA MATCH/DIFFER:
- Analise os últimos 3 dígitos
- Identifique padrões de repetição ou diferença
- Considere a probabilidade estatística
- Procure por sequências contrárias

RESPONDA NO FORMATO JSON:
{
    "action": "MATCH" ou "DIFFER" ou "WAIT",
    "confidence": 0-100,
    "reason": "explicação da análise de dígitos",
    "predicted_digit": dígito previsto,
    "pattern": "padrão identificado"
}`,
            
            'OVER_UNDER': `
ESTRATÉGIA OVER/UNDER:
- Analise a distribuição de dígitos recentes
- Identifique tendências de dígitos altos/baixos
- Considere o threshold (geralmente 5)
- Procure por desequilíbrios estatísticos

RESPONDA NO FORMATO JSON:
{
    "action": "OVER" ou "UNDER" ou "WAIT",
    "confidence": 0-100,
    "reason": "análise estatística dos dígitos",
    "threshold": 5,
    "predicted_range": "faixa prevista"
}`,
            
            'ACCUMULATORS': `
ESTRATÉGIA ACCUMULATORS:
- Analise a volatilidade do mercado
- Identifique períodos de baixa volatilidade
- Calcule o risco de knockout
- Considere o potencial de acumulação

RESPONDA NO FORMATO JSON:
{
    "action": "ACCUMULATE" ou "WAIT",
    "confidence": 0-100,
    "reason": "análise de volatilidade",
    "growth_rate": taxa de crescimento esperada,
    "knockout_risk": "baixo/médio/alto"
}`
        };
        
        return baseContext + (modeInstructions[mode] || modeInstructions['RISE_FALL']);
    }
    
    /**
     * Extrai a decisão da resposta da API
     */
    parseResponse(apiResponse) {
        try {
            const text = apiResponse.candidates[0].content.parts[0].text;
            
            // Tenta extrair JSON da resposta
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
            
            // Fallback: análise de texto
            return this.parseTextResponse(text);
            
        } catch (error) {
            console.error("❌ Parse Error:", error);
            return {
                action: 'WAIT',
                confidence: 0,
                reason: 'Erro ao interpretar resposta'
            };
        }
    }
    
    /**
     * Analisa resposta em texto livre
     */
    parseTextResponse(text) {
        const lowerText = text.toLowerCase();
        
        // Detecta ação
        let action = 'WAIT';
        if (lowerText.includes('call') || lowerText.includes('compra')) action = 'CALL';
        else if (lowerText.includes('put') || lowerText.includes('venda')) action = 'PUT';
        else if (lowerText.includes('match')) action = 'MATCH';
        else if (lowerText.includes('differ')) action = 'DIFFER';
        else if (lowerText.includes('over')) action = 'OVER';
        else if (lowerText.includes('under')) action = 'UNDER';
        
        // Detecta confiança
        let confidence = 50;
        const confMatch = text.match(/(\d+)%/);
        if (confMatch) {
            confidence = parseInt(confMatch[1]);
        }
        
        return {
            action: action,
            confidence: confidence,
            reason: text.substring(0, 200)
        };
    }
    
    /**
     * Retorna o histórico de análises
     */
    getHistory(limit = 10) {
        return this.analysisHistory.slice(-limit);
    }
    
    /**
     * Limpa o histórico
     */
    clearHistory() {
        this.analysisHistory = [];
        this.lastAnalysis = null;
    }
}

// Exporta para uso global
if (typeof window !== 'undefined') {
    window.GeminiBrain = GeminiBrain;
}
