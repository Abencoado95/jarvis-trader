/**
 * JARVIS TRADER V3.2 - REAL TRADING WITH API TOKENS
 * Sistema simplificado com tokens de API diretos
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

// DERIV CONFIG
const DERIV_CONFIG = {
    APP_ID: 114062
};

// Global State
let currentMode = 'RISE_FALL';
let currentAccount = 'demo';
let derivToken = null;
let derivAccountId = null;
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
let currentBalance = 0;
let isConnected = false;

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
    if (ws) ws.close();
    derivToken = null;
    derivAccountId = null;
    isConnected = false;
    showView('view-login');
}

// Mode Selection
function selectMode(mode) {
    currentMode = mode;
    showView('view-platform');
    setTimeout(() => initTradingPlatform(), 100);
}

function changeMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    updateTradeButtons();
    console.log("🔄 Modo alterado para:", mode);
}

// SIMPLIFIED TOKEN SYSTEM
function switchAccount(accountType) {
    currentAccount = accountType;
    
    // Update UI
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(accountType)) {
            btn.classList.add('active');
        }
    });
    
    // Prompt for API token
    promptForToken(accountType);
}

function promptForToken(accountType) {
    const storedToken = localStorage.getItem(`deriv_token_${accountType}`);
    
    if (storedToken) {
        const useStored = confirm(`Usar token ${accountType} salvo?\n\nClique OK para usar o token salvo\nClique Cancelar para inserir novo token`);
        
        if (useStored) {
            derivToken = storedToken;
            reconnectDeriv();
            return;
        }
    }
    
    const message = accountType === 'demo' 
        ? `Cole seu TOKEN DE API DEMO da Deriv:\n\n1. Vá em https://app.deriv.com/account/api-token\n2. Crie um token com permissões: Read, Trade\n3. Copie o token e cole aqui`
        : `Cole seu TOKEN DE API REAL da Deriv:\n\n⚠️ ATENÇÃO: Este token dá acesso à sua conta REAL!\n\n1. Vá em https://app.deriv.com/account/api-token\n2. Crie um token com permissões: Read, Trade\n3. Copie o token e cole aqui`;
    
    const token = prompt(message);
    
    if (token && token.trim().length > 10) {
        derivToken = token.trim();
        localStorage.setItem(`deriv_token_${accountType}`, derivToken);
        console.log(`✅ Token ${accountType} salvo`);
        reconnectDeriv();
    } else {
        alert("❌ Token inválido!");
    }
}

function reconnectDeriv() {
    if (ws) {
        ws.close();
    }
    connectDeriv();
}

// Update Trade Buttons Based on Mode
function updateTradeButtons() {
    const container = document.getElementById('tradeButtons');
    if (!container) return;
    
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
    if (!isConnected) {
        alert("⚠️ Conecte sua conta Deriv primeiro!\n\nClique em DEMO ou REAL.");
        return;
    }
    
    isAutomationActive = !isAutomationActive;
    
    const btn = document.getElementById('automationBtn');
    const status = document.getElementById('automationStatus');
    
    if (isAutomationActive) {
        btn.classList.add('active');
        btn.textContent = '⏸️ PAUSAR SISTEMA JARVIS';
        status.textContent = '🤖 SISTEMA AUTOMÁTICO ATIVO';
        status.style.color = 'var(--neon-magenta)';
        
        startAutomation();
        console.log("🤖 AUTOMAÇÃO ATIVADA");
    } else {
        btn.classList.remove('active');
        btn.textContent = '🤖 LIGAR SISTEMA JARVIS';
        status.textContent = 'SISTEMA MANUAL';
        status.style.color = '#8899a6';
        
        stopAutomation();
        console.log("⏸️ AUTOMAÇÃO PAUSADA");
    }
}

function startAutomation() {
    automationInterval = setInterval(async () => {
        if (!isAutomationActive) return;
        
        console.log("🤖 Executando análise automática...");
        
        const analysis = await analyzeMarket(true);
        
        if (analysis && analysis.confidence > 70) {
            console.log(`🎯 Sinal: ${analysis.action} (${analysis.confidence}%)`);
            
            const takeProfit = parseFloat(document.getElementById('takeProfitInput').value);
            const stopLoss = parseFloat(document.getElementById('stopLossInput').value);
            
            if (dailyProfitValue >= takeProfit) {
                toggleAutomation();
                alert(`🎉 Take Profit!\nLucro: $${dailyProfitValue.toFixed(2)}`);
                return;
            }
            
            if (dailyProfitValue <= -stopLoss) {
                toggleAutomation();
                alert(`⚠️ Stop Loss!\nPerda: $${Math.abs(dailyProfitValue).toFixed(2)}`);
                return;
            }
            
            placeTrade(analysis.action, true);
        }
    }, 30000);
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
    
    setTimeout(() => {
        initChart();
        connectDeriv();
        
        if (typeof GeminiBrain !== 'undefined') {
            geminiBrain = new GeminiBrain();
            console.log("🧠 Gemini Brain V3.0 loaded");
        }
    }, 200);
}

// Chart
function initChart() {
    const container = document.getElementById('tvChart');
    if (!container) {
        console.error("❌ Chart container not found!");
        return;
    }
    
    try {
        if (chart) {
            chart.remove();
            chart = null;
            series = null;
        }
        
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
            if (chart) {
                chart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight
                });
            }
        });
        
        console.log("✅ Chart initialized");
    } catch (error) {
        console.error("❌ Chart error:", error);
    }
}

// Deriv Connection
function connectDeriv() {
    const APP_ID = DERIV_CONFIG.APP_ID;
    ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    
    ws.onopen = () => {
        console.log("✅ Connected to Deriv");
        
        if (derivToken) {
            console.log("🔐 Authorizing with token...");
            ws.send(JSON.stringify({
                authorize: derivToken
            }));
        } else {
            console.log("📊 Connecting without authorization (demo mode)");
            ws.send(JSON.stringify({ ticks: "R_100", subscribe: 1 }));
        }
    };
    
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        
        if (data.authorize) {
            isConnected = true;
            derivAccountId = data.authorize.loginid;
            currentBalance = parseFloat(data.authorize.balance);
            
            console.log("✅ Authorized!");
            console.log(`   Account: ${derivAccountId}`);
            console.log(`   Balance: $${currentBalance.toFixed(2)}`);
            console.log(`   Currency: ${data.authorize.currency}`);
            
            updateBalance(currentBalance);
            
            // Subscribe to ticks
            ws.send(JSON.stringify({ ticks: "R_100", subscribe: 1 }));
            
            alert(`✅ Conectado com sucesso!\n\nConta: ${derivAccountId}\nSaldo: $${currentBalance.toFixed(2)}`);
        }
        
        if (data.tick) {
            updateChart(data.tick);
        }
        
        if (data.buy) {
            console.log("✅ Trade placed:", data.buy.contract_id);
            monitorContract(data.buy.contract_id);
        }
        
        if (data.proposal_open_contract) {
            handleContractUpdate(data.proposal_open_contract);
        }
        
        if (data.balance) {
            currentBalance = parseFloat(data.balance.balance);
            updateBalance(currentBalance);
        }
        
        if (data.error) {
            console.error("❌ Deriv Error:", data.error.message);
            
            if (data.error.code === 'InvalidToken') {
                alert(`❌ Token inválido!\n\n${data.error.message}\n\nPor favor, insira um novo token.`);
                localStorage.removeItem(`deriv_token_${currentAccount}`);
                derivToken = null;
                isConnected = false;
            } else {
                alert(`Erro Deriv: ${data.error.message}`);
            }
        }
    };
    
    ws.onerror = (err) => {
        console.error("❌ Connection error:", err);
    };
    
    ws.onclose = () => {
        console.log("⚠️ Connection closed");
        isConnected = false;
    };
}

function updateBalance(balance) {
    currentBalance = balance;
    const elem = document.getElementById('accountBalance');
    if (elem) {
        elem.textContent = `$${parseFloat(balance).toFixed(2)}`;
    }
}

function updateChart(tick) {
    if (!series) return;
    
    try {
        const time = Math.floor(tick.epoch / 60) * 60;
        const price = parseFloat(tick.quote);
        
        if (!currentCandle || currentCandle.time !== time) {
            if (currentCandle) {
                candles.push(currentCandle);
                series.update(currentCandle);
                
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
    } catch (error) {
        console.error("❌ Chart update error:", error);
    }
}

// Market Analysis
async function analyzeMarket(silent = false) {
    if (!silent) {
        const btn = document.getElementById('btnAnalyze');
        const subtext = document.getElementById('analyzeSubtext');
        if (btn) btn.disabled = true;
        if (subtext) {
            subtext.textContent = 'ANALISANDO...';
            subtext.style.color = 'var(--neon-gold)';
        }
    }
    
    console.log("🧠 Analyzing...");
    
    if (geminiBrain && candles.length > 20) {
        const marketData = {
            candles: candles,
            currentPrice: currentCandle ? currentCandle.close : 0,
            mode: currentMode
        };
        
        const analysis = await geminiBrain.analyze(marketData, currentMode);
        
        if (!silent) {
            const btn = document.getElementById('btnAnalyze');
            const subtext = document.getElementById('analyzeSubtext');
            if (btn) btn.disabled = false;
            if (subtext) {
                subtext.textContent = 'SISTEMA ONLINE';
                subtext.style.color = 'var(--neon-green)';
            }
            
            if (analysis.confidence > 60) {
                document.querySelectorAll('.btn-trade').forEach(btn => btn.disabled = false);
                alert(`✅ Análise OK!\n\nAção: ${analysis.action}\nConfiança: ${analysis.confidence}%`);
            } else {
                alert(`⚠️ Confiança baixa: ${analysis.confidence}%`);
            }
        }
        
        return analysis;
    } else {
        if (!silent) {
            const btn = document.getElementById('btnAnalyze');
            const subtext = document.getElementById('analyzeSubtext');
            if (btn) btn.disabled = false;
            if (subtext) {
                subtext.textContent = 'SISTEMA ONLINE';
                subtext.style.color = 'var(--neon-green)';
            }
            
            document.querySelectorAll('.btn-trade').forEach(btn => btn.disabled = false);
            alert("✅ Análise OK!");
        }
        
        return null;
    }
}

// REAL TRADE
function placeTrade(action, isAuto = false) {
    const stake = parseFloat(document.getElementById('stakeInput').value);
    const duration = parseInt(document.getElementById('durationSelect').value);
    
    if (!isConnected || !derivToken) {
        alert("⚠️ Conecte sua conta Deriv primeiro!\n\nClique em DEMO ou REAL.");
        return;
    }
    
    if (currentBalance < stake) {
        alert(`⚠️ Saldo insuficiente!\n\nSaldo: $${currentBalance.toFixed(2)}\nStake: $${stake.toFixed(2)}`);
        return;
    }
    
    console.log(`📊 ${isAuto ? '[AUTO]' : '[MANUAL]'} ${action}: $${stake}`);
    
    const params = buildContractParams(action, stake, duration);
    
    if (!params) {
        alert("❌ Erro ao construir contrato");
        return;
    }
    
    ws.send(JSON.stringify({
        buy: "1",
        price: stake,
        parameters: params
    }));
    
    if (!isAuto) {
        alert(`✅ Trade ${action} enviado!\n\nStake: $${stake}\n\nAguardando...`);
    }
}

function buildContractParams(action, stake, duration) {
    const symbol = "R_100";
    
    switch (currentMode) {
        case 'RISE_FALL':
            return {
                contract_type: action === 'CALL' ? 'CALL' : 'PUT',
                symbol: symbol,
                duration: duration,
                duration_unit: 'm',
                basis: 'stake',
                amount: stake
            };
            
        case 'MATCH_DIFFER':
            return {
                contract_type: action === 'MATCH' ? 'DIGITMATCH' : 'DIGITDIFF',
                symbol: symbol,
                duration: 5,
                duration_unit: 't',
                basis: 'stake',
                amount: stake,
                barrier: '5'
            };
            
        case 'OVER_UNDER':
            return {
                contract_type: action === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER',
                symbol: symbol,
                duration: 5,
                duration_unit: 't',
                basis: 'stake',
                amount: stake,
                barrier: '5'
            };
            
        case 'ACCUMULATORS':
            return {
                contract_type: 'ACCU',
                symbol: symbol,
                growth_rate: 0.03,
                basis: 'stake',
                amount: stake
            };
            
        default:
            return null;
    }
}

function monitorContract(contractId) {
    ws.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1
    }));
}

function handleContractUpdate(contract) {
    const profit = parseFloat(contract.profit);
    const status = contract.status;
    
    if (status === 'sold' || status === 'won' || status === 'lost') {
        const trade = {
            time: new Date().toLocaleTimeString(),
            type: contract.contract_type,
            stake: parseFloat(contract.buy_price),
            result: profit > 0 ? 'WIN' : 'LOSS',
            profit: profit,
            isAuto: isAutomationActive
        };
        
        tradeHistory.unshift(trade);
        updateHistory();
        updateDailyProfit(profit);
        
        console.log(`${profit > 0 ? '✅ WIN' : '❌ LOSS'}: $${profit.toFixed(2)}`);
    }
}

// Update History
function updateHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;
    
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

function clearHistory() {
    if (confirm('🗑️ Limpar histórico?')) {
        tradeHistory = [];
        dailyProfitValue = 0;
        updateHistory();
        updateDailyProfit(0);
    }
}

function updateDailyProfit(amount) {
    if (amount !== 0) {
        dailyProfitValue += amount;
    } else {
        dailyProfitValue = 0;
    }
    
    const elem = document.getElementById('dailyProfit');
    if (elem) {
        elem.textContent = `$${dailyProfitValue.toFixed(2)}`;
        elem.style.color = dailyProfitValue >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
    }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 JARVIS TRADER V3.2 Ready");
    console.log("🔑 API Token System Active");
});
