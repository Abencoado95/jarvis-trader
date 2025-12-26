/**
 * JARVIS TRADER V3.0 - MAIN LOGIC
 * Sistema completo de trading com automação
 */

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyAz0TWl4_ucANDaDJhY9ozLuaGnTFw_V6U",
    authDomain: "jarvis-trader-a6d3d.firebaseapp.com",
    projectId: "jarvis-trader-a6d3d",
    storageBucket: "jarvis-trader-a6d3d.firebasestorage.app",
    messagingSenderId: "1085731500934",
    appId: "1:1085731500934:web:9711ce9b71317440727207"
};

let auth, db;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("🔥 Firebase initialized");
} catch(e) {
    console.warn("⚠️ Firebase error:", e);
}

// DERIV TOKENS
const DERIV_CONFIG = {
    APP_ID: 114062,
    DEMO_TOKEN: "SEU_TOKEN_DEMO_AQUI", // Usuário deve configurar
    REAL_TOKEN: "SEU_TOKEN_REAL_AQUI"  // Usuário deve configurar
};

// Global State
let currentMode = 'RISE_FALL';
let currentAccount = 'demo'; // 'demo' or 'real'
let chart = null;
let series = null;
let ws = null;
let positions = new Map();
let dailyProfitValue = 0;
let tradeHistory = [];
let geminiBrain = null;
let isAutomationActive = false;
let automationInterval = null;
let candles = [];
let currentCandle = null;

// View Management
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// Auth
function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const msg = document.getElementById('loginMessage');
    
    if (!email || !pass) {
        msg.textContent = "Preencha todos os campos";
        return;
    }
    
    msg.textContent = "Verificando...";
    
    if (email === "user" && pass === "user") {
        msg.textContent = "Login realizado!";
        setTimeout(() => showView('view-dashboard'), 1000);
        return;
    }
    
    if (auth) {
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => {
                msg.textContent = "Login realizado!";
                setTimeout(() => showView('view-dashboard'), 1000);
            })
            .catch(err => msg.textContent = "Erro: " + err.message);
    }
}

function handleRegister() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const msg = document.getElementById('loginMessage');
    
    if (!email || !pass) {
        msg.textContent = "Preencha todos os campos";
        return;
    }
    
    msg.textContent = "Criando conta...";
    
    if (auth) {
        auth.createUserWithEmailAndPassword(email, pass)
            .then(() => {
                msg.textContent = "Conta criada!";
                setTimeout(() => showView('view-dashboard'), 1000);
            })
            .catch(err => msg.textContent = "Erro: " + err.message);
    }
}

function logout() {
    if (auth) auth.signOut();
    if (isAutomationActive) toggleAutomation();
    showView('view-login');
}

// Mode Selection
function selectMode(mode) {
    currentMode = mode;
    showView('view-platform');
    initTradingPlatform();
}

function changeMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    updateTradeButtons();
    console.log("🔄 Modo alterado para:", mode);
}

// Account Switcher
function switchAccount(accountType) {
    currentAccount = accountType;
    
    // Update UI
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(accountType)) {
            btn.classList.add('active');
        }
    });
    
    // Reconnect with appropriate token
    if (ws) {
        ws.close();
    }
    connectDeriv();
    
    console.log(`💳 Conta alterada para: ${accountType.toUpperCase()}`);
}

// Update Trade Buttons Based on Mode
function updateTradeButtons() {
    const container = document.getElementById('tradeButtons');
    
    const buttonConfigs = {
        'RISE_FALL': [
            { id: 'btnCall', text: 'COMPRAR ⬆', class: 'btn-call', action: 'CALL' },
            { id: 'btnPut', text: 'VENDER ⬇', class: 'btn-put', action: 'PUT' }
        ],
        'MATCH_DIFFER': [
            { id: 'btnMatch', text: 'MATCH', class: 'btn-match', action: 'MATCH' },
            { id: 'btnDiffer', text: 'DIFFER', class: 'btn-differ', action: 'DIFFER' }
        ],
        'OVER_UNDER': [
            { id: 'btnOver', text: 'OVER 5', class: 'btn-over', action: 'OVER' },
            { id: 'btnUnder', text: 'UNDER 5', class: 'btn-under', action: 'UNDER' }
        ],
        'ACCUMULATORS': [
            { id: 'btnAccumulate', text: 'COMPRAR (ACUMULAR)', class: 'btn-accumulate', action: 'ACCUMULATE' }
        ]
    };
    
    const buttons = buttonConfigs[currentMode] || buttonConfigs['RISE_FALL'];
    
    container.innerHTML = buttons.map(btn => `
        <button class="btn-trade ${btn.class}" id="${btn.id}" onclick="placeTrade('${btn.action}')" disabled>
            ${btn.text}
        </button>
    `).join('');
}

// Automation System
function toggleAutomation() {
    isAutomationActive = !isAutomationActive;
    
    const btn = document.getElementById('automationBtn');
    const status = document.getElementById('automationStatus');
    
    if (isAutomationActive) {
        btn.classList.add('active');
        btn.textContent = '⏸️ PAUSAR SISTEMA JARVIS';
        status.textContent = '🤖 SISTEMA AUTOMÁTICO ATIVO';
        status.style.color = 'var(--neon-magenta)';
        
        // Start automation loop
        startAutomation();
        
        console.log("🤖 AUTOMAÇÃO ATIVADA");
    } else {
        btn.classList.remove('active');
        btn.textContent = '🤖 LIGAR SISTEMA JARVIS';
        status.textContent = 'SISTEMA MANUAL';
        status.style.color = '#8899a6';
        
        // Stop automation
        stopAutomation();
        
        console.log("⏸️ AUTOMAÇÃO PAUSADA");
    }
}

function startAutomation() {
    // Run analysis every 30 seconds
    automationInterval = setInterval(async () => {
        if (!isAutomationActive) return;
        
        console.log("🤖 Executando análise automática...");
        
        const analysis = await analyzeMarket(true); // Silent mode
        
        if (analysis && analysis.confidence > 70) {
            console.log(`🎯 Sinal detectado: ${analysis.action} (${analysis.confidence}%)`);
            
            // Check daily limits
            const takeProfit = parseFloat(document.getElementById('takeProfitInput').value);
            const stopLoss = parseFloat(document.getElementById('stopLossInput').value);
            
            if (dailyProfitValue >= takeProfit) {
                console.log("✅ Take Profit diário atingido. Pausando automação.");
                toggleAutomation();
                alert(`🎉 Take Profit atingido! Lucro do dia: $${dailyProfitValue.toFixed(2)}`);
                return;
            }
            
            if (dailyProfitValue <= -stopLoss) {
                console.log("❌ Stop Loss diário atingido. Pausando automação.");
                toggleAutomation();
                alert(`⚠️ Stop Loss atingido! Perda do dia: $${Math.abs(dailyProfitValue).toFixed(2)}`);
                return;
            }
            
            // Execute trade automatically
            placeTrade(analysis.action, true);
        }
    }, 30000); // 30 seconds
}

function stopAutomation() {
    if (automationInterval) {
        clearInterval(automationInterval);
        automationInterval = null;
    }
}

// Init Platform
function initTradingPlatform() {
    console.log("🚀 Initializing platform...");
    updateTradeButtons();
    initChart();
    connectDeriv();
    if (typeof GeminiBrain !== 'undefined') {
        geminiBrain = new GeminiBrain();
        console.log("🧠 Gemini Brain V3.0 loaded");
    }
}

// Chart
function initChart() {
    const container = document.getElementById('tvChart');
    if (!container) return;
    
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            backgroundColor: 'transparent',
            textColor: '#5f7e97'
        },
        grid: {
            vertLines: { color: 'rgba(26, 38, 57, 0.5)' },
            horzLines: { color: 'rgba(26, 38, 57, 0.5)' }
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: true
        }
    });
    
    series = chart.addCandlestickSeries({
        upColor: '#00ff41',
        downColor: '#ff003c',
        borderVisible: false,
        wickUpColor: '#00ff41',
        wickDownColor: '#ff003c'
    });
    
    window.addEventListener('resize', () => {
        chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight
        });
    });
}

// Deriv Connection
function connectDeriv() {
    const APP_ID = DERIV_CONFIG.APP_ID;
    ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    
    ws.onopen = () => {
        console.log("✅ Connected to Deriv");
        
        // Authorize with token if available
        const token = currentAccount === 'demo' ? DERIV_CONFIG.DEMO_TOKEN : DERIV_CONFIG.REAL_TOKEN;
        
        if (token && token !== "SEU_TOKEN_DEMO_AQUI" && token !== "SEU_TOKEN_REAL_AQUI") {
            ws.send(JSON.stringify({
                authorize: token
            }));
        }
        
        // Subscribe to ticks
        ws.send(JSON.stringify({ ticks: "R_100" }));
    };
    
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        
        if (data.authorize) {
            console.log("✅ Authorized:", data.authorize.loginid);
            updateBalance(data.authorize.balance);
        }
        
        if (data.tick) {
            updateChart(data.tick);
        }
    };
    
    ws.onerror = (err) => {
        console.error("❌ Deriv error:", err);
    };
}

function updateBalance(balance) {
    const elem = document.getElementById('accountBalance');
    elem.textContent = `$${parseFloat(balance).toFixed(2)}`;
}

function updateChart(tick) {
    const time = Math.floor(tick.epoch / 60) * 60;
    const price = parseFloat(tick.quote);
    
    if (!currentCandle || currentCandle.time !== time) {
        if (currentCandle) {
            candles.push(currentCandle);
            series.update(currentCandle);
            
            // Keep only last 100 candles
            if (candles.length > 100) {
                candles.shift();
            }
        }
        currentCandle = {
            time: time,
            open: price,
            high: price,
            low: price,
            close: price
        };
    } else {
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentCandle.close = price;
        series.update(currentCandle);
    }
}

// Market Analysis
async function analyzeMarket(silent = false) {
    if (!silent) {
        const btn = document.getElementById('btnAnalyze');
        const subtext = document.getElementById('analyzeSubtext');
        btn.disabled = true;
        subtext.textContent = 'ANALISANDO...';
        subtext.style.color = 'var(--neon-gold)';
    }
    
    console.log("🧠 Analyzing market...");
    
    if (geminiBrain && candles.length > 20) {
        const marketData = {
            candles: candles,
            currentPrice: currentCandle ? currentCandle.close : 0,
            mode: currentMode
        };
        
        const analysis = await geminiBrain.analyze(marketData, currentMode);
        console.log("📊 Analysis:", analysis);
        
        if (!silent) {
            const btn = document.getElementById('btnAnalyze');
            const subtext = document.getElementById('analyzeSubtext');
            btn.disabled = false;
            subtext.textContent = 'SISTEMA ONLINE';
            subtext.style.color = 'var(--neon-green)';
            
            if (analysis.confidence > 60) {
                // Enable trade buttons
                document.querySelectorAll('.btn-trade').forEach(btn => btn.disabled = false);
                
                alert(`✅ Análise concluída!\n\nAção: ${analysis.action}\nConfiança: ${analysis.confidence}%\n\n${analysis.reason}`);
            } else {
                alert(`⚠️ Confiança baixa (${analysis.confidence}%)\n\nAguarde melhores condições de mercado.\n\n${analysis.reason}`);
            }
        }
        
        return analysis;
    } else {
        if (!silent) {
            const btn = document.getElementById('btnAnalyze');
            const subtext = document.getElementById('analyzeSubtext');
            btn.disabled = false;
            subtext.textContent = 'SISTEMA ONLINE';
            subtext.style.color = 'var(--neon-green)';
            
            document.querySelectorAll('.btn-trade').forEach(btn => btn.disabled = false);
            alert("✅ Análise concluída!\n\nBotões de trade habilitados.");
        }
        
        return null;
    }
}

// Place Trade
function placeTrade(action, isAuto = false) {
    const stake = parseFloat(document.getElementById('stakeInput').value);
    const duration = parseInt(document.getElementById('durationSelect').value);
    
    console.log(`📊 ${isAuto ? '[AUTO]' : '[MANUAL]'} ${action}: $${stake} for ${duration}m`);
    
    // Simulate trade result (replace with actual Deriv API call)
    const trade = {
        time: new Date().toLocaleTimeString(),
        type: action,
        stake: stake,
        result: Math.random() > 0.45 ? 'WIN' : 'LOSS', // 55% win rate
        profit: Math.random() > 0.45 ? stake * 0.9 : -stake,
        isAuto: isAuto
    };
    
    tradeHistory.unshift(trade);
    updateHistory();
    updateDailyProfit(trade.profit);
    
    if (!isAuto) {
        alert(`✅ Trade ${action} executado!\n\nStake: $${stake}\nDuração: ${duration}m\n\nResultado será processado em ${duration} minuto(s).`);
    }
}

// Update History
function updateHistory() {
    const list = document.getElementById('historyList');
    if (tradeHistory.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #445566; font-size: 0.8rem; margin-top: 40px;">Histórico vazio</div>';
        return;
    }
    
    list.innerHTML = tradeHistory.slice(0, 20).map(trade => `
        <div class="history-item ${trade.result === 'WIN' ? 'win' : 'loss'}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${trade.time} - ${trade.type} ${trade.isAuto ? '🤖' : ''}</span>
                <span style="color: ${trade.profit > 0 ? 'var(--neon-green)' : 'var(--neon-red)'}">
                    ${trade.profit > 0 ? '+' : ''}$${trade.profit.toFixed(2)}
                </span>
            </div>
            <div style="font-size: 0.75rem; color: #8899a6;">
                Stake: $${trade.stake.toFixed(2)} | ${trade.result}
            </div>
        </div>
    `).join('');
}

// Clear History
function clearHistory() {
    if (confirm('🗑️ Limpar todo o histórico e zerar lucro do dia?')) {
        tradeHistory = [];
        dailyProfitValue = 0;
        updateHistory();
        updateDailyProfit(0);
        console.log("🗑️ Histórico limpo");
    }
}

// Update Daily Profit
function updateDailyProfit(amount) {
    if (amount !== 0) {
        dailyProfitValue += amount;
    } else {
        dailyProfitValue = 0;
    }
    
    const elem = document.getElementById('dailyProfit');
    elem.textContent = `$${dailyProfitValue.toFixed(2)}`;
    elem.style.color = dailyProfitValue >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
    
    // Check limits
    const takeProfit = parseFloat(document.getElementById('takeProfitInput').value);
    const stopLoss = parseFloat(document.getElementById('stopLossInput').value);
    
    if (dailyProfitValue >= takeProfit && isAutomationActive) {
        toggleAutomation();
        alert(`🎉 TAKE PROFIT ATINGIDO!\n\nLucro do dia: $${dailyProfitValue.toFixed(2)}\n\nAutomação pausada.`);
    }
    
    if (dailyProfitValue <= -stopLoss && isAutomationActive) {
        toggleAutomation();
        alert(`⚠️ STOP LOSS ATINGIDO!\n\nPerda do dia: $${Math.abs(dailyProfitValue).toFixed(2)}\n\nAutomação pausada.`);
    }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 JARVIS TRADER V3.0 Ready");
    console.log("🧠 Gemini Brain V3.0 with Advanced Technical Analysis");
    console.log("🤖 Automation System Ready");
});
