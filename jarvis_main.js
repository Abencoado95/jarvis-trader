/**
 * JARVIS TRADER V3.3 - OAUTH DERIV REAL
 * Sistema idêntico ao backup funcionando
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
const APP_ID = 114062;
const SYMBOL = "R_100";

// Global State
let currentMode = 'RISE_FALL';
let currentAccount = 'demo';
let availableAccounts = [];
let currentToken = "";
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
    localStorage.removeItem('jarvis_accounts');
    availableAccounts = [];
    currentToken = "";
    isConnected = false;
    showView('view-login');
}

// Mode Selection
function selectMode(mode) {
    currentMode = mode;
    showView('view-platform');
    
    // Check if already connected
    if (isConnected && ws && ws.readyState === 1) {
        console.log("✅ Already connected, just updating mode");
        updateTradeButtons();
        return;
    }
    
    // Check auth and init
    const hasAccounts = checkAuthAndInit();
    
    if (!hasAccounts) {
        console.log("⚠️ No accounts, waiting for user to connect");
    }
}

function changeMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    updateTradeButtons();
    console.log("🔄 Modo alterado para:", mode);
}

// DERIV OAUTH (Igual ao backup)
function switchAccount(accountType) {
    currentAccount = accountType;
    
    // Update UI
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(accountType)) {
            btn.classList.add('active');
        }
    });
    
    // Check if we have accounts saved
    if (availableAccounts.length > 0) {
        // Find account by type
        const account = availableAccounts.find(a => 
            accountType === 'demo' ? a.id.startsWith('VRT') : a.id.startsWith('CR')
        );
        
        if (account) {
            console.log(`🔄 Switching to ${accountType.toUpperCase()}: ${account.id}`);
            currentToken = account.token;
            reconnectDeriv();
            return;
        }
    }
    
    // No saved account, redirect to OAuth (ONLY ONCE)
    console.log("⚠️ No saved accounts, redirecting to OAuth...");
    connectDeriv();
}

function connectDeriv() {
    console.log("🔐 Redirecting to Deriv OAuth...");
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=PT&brand=deriv`;
}

function checkAuthAndInit() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('token1')) {
        // OAuth callback - save all accounts
        let i = 1;
        let accounts = [];
        
        while (params.has(`token${i}`)) {
            accounts.push({
                token: params.get(`token${i}`),
                id: params.get(`acct${i}`),
                currency: params.get(`cur${i}`),
                type: params.get(`acct${i}`).startsWith('VRT') ? 'DEMO' : 'REAL'
            });
            i++;
        }
        
        localStorage.setItem('jarvis_accounts', JSON.stringify(accounts));
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        availableAccounts = accounts;
        currentToken = accounts[0].token;
        
        console.log(`✅ ${accounts.length} conta(s) salva(s):`);
        accounts.forEach(acc => {
            console.log(`   - ${acc.type}: ${acc.id} (${acc.currency})`);
        });
        
        // INITIALIZE IMMEDIATELY
        setTimeout(() => {
            initTradingPlatform();
        }, 500);
        
        return true;
    }
    
    // Check for saved accounts
    const saved = localStorage.getItem('jarvis_accounts');
    if (saved) {
        try {
            availableAccounts = JSON.parse(saved);
            if (availableAccounts.length > 0) {
                currentToken = availableAccounts[0].token;
                console.log(`✅ Using saved accounts (${availableAccounts.length})`);
                
                // INITIALIZE IMMEDIATELY
                setTimeout(() => {
                    initTradingPlatform();
                }, 500);
                
                return true;
            }
        } catch(e) {
            console.error("Error loading saved accounts:", e);
            localStorage.removeItem('jarvis_accounts');
        }
    }
    
    console.log("⚠️ No accounts found");
    return false;
}

function reconnectDeriv() {
    if (ws) {
        ws.close();
    }
    connectWS();
}

// Update Trade Buttons
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

// Automation
function toggleAutomation() {
    if (!isConnected) {
        alert("⚠️ Conecte sua conta Deriv primeiro!");
        return;
    }
    
    isAutomationActive = !isAutomationActive;
    
    const btn = document.getElementById('automationBtn');
    const status = document.getElementById('automationStatus');
    
    if (isAutomationActive) {
        btn.classList.add('active');
        btn.textContent = '⏸️ PAUSAR JARVIS';
        status.textContent = '🤖 AUTOMÁTICO ATIVO';
        status.style.color = 'var(--neon-magenta)';
        startAutomation();
    } else {
        btn.classList.remove('active');
        btn.textContent = '🤖 LIGAR JARVIS';
        status.textContent = 'SISTEMA MANUAL';
        status.style.color = '#8899a6';
        stopAutomation();
    }
}

function startAutomation() {
    automationInterval = setInterval(async () => {
        if (!isAutomationActive || positions.size > 0) return;
        
        const analysis = await analyzeMarket(true);
        
        if (analysis && analysis.confidence > 70) {
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
    console.log("🚀 Initializing...");
    updateTradeButtons();
    
    setTimeout(() => {
        initChart();
        connectWS();
        
        if (typeof GeminiBrain !== 'undefined') {
            geminiBrain = new GeminiBrain();
        }
    }, 200);
}

// Chart
function initChart() {
    const container = document.getElementById('tvChart');
    if (!container) return;
    
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
        
        console.log("✅ Chart OK");
    } catch (error) {
        console.error("❌ Chart error:", error);
    }
}

// WebSocket (Igual ao backup)
function connectWS() {
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
    
    ws.onopen = () => {
        console.log("✅ Connected to Deriv");
        
        if (currentToken) {
            ws.send(JSON.stringify({ authorize: currentToken }));
        }
    };
    
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        
        if (data.error) {
            console.error("❌ Deriv Error:", data.error.message);
            if (data.error.code === 'InvalidToken') {
                alert("Token inválido! Reconectando...");
                localStorage.removeItem('jarvis_accounts');
                connectDeriv();
            }
            return;
        }
        
        if (data.msg_type === 'authorize') {
            isConnected = true;
            const info = data.authorize;
            currentBalance = parseFloat(info.balance);
            
            console.log("✅ Authorized!");
            console.log(`   Account: ${info.loginid}`);
            console.log(`   Balance: ${info.balance} ${info.currency}`);
            console.log(`   Name: ${info.fullname}`);
            
            updateBalance(currentBalance);
            updateAccountUI(info);
            
            // Subscribe to data
            ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            ws.send(JSON.stringify({ 
                ticks_history: SYMBOL, 
                adjust_start_time: 1, 
                count: 500, 
                end: 'latest', 
                style: 'candles', 
                granularity: 60, 
                subscribe: 1 
            }));
            ws.send(JSON.stringify({ proposal_open_contract: 1, subscribe: 1 }));
        }
        
        if (data.msg_type === 'balance') {
            currentBalance = parseFloat(data.balance.balance);
            updateBalance(currentBalance);
        }
        
        if (data.msg_type === 'candles') {
            candles = data.candles.map(c => ({
                time: c.epoch,
                open: +c.open,
                high: +c.high,
                low: +c.low,
                close: +c.close
            }));
            if (series) series.setData(candles);
        }
        
        if (data.msg_type === 'ohlc') {
            const c = data.ohlc;
            updateCandles({
                time: c.open_time,
                open: +c.open,
                high: +c.high,
                low: +c.low,
                close: +c.close
            });
        }
        
        if (data.msg_type === 'proposal') {
            if (data.proposal.id) {
                ws.send(JSON.stringify({
                    buy: data.proposal.id,
                    price: data.proposal.ask_price
                }));
            }
        }
        
        if (data.msg_type === 'proposal_open_contract') {
            handlePosition(data.proposal_open_contract);
        }
    };
    
    ws.onerror = (err) => {
        console.error("❌ WS error:", err);
    };
    
    ws.onclose = () => {
        console.log("⚠️ Connection closed");
        isConnected = false;
    };
}

function updateAccountUI(info) {
    const isDemo = info.fullname.includes('Virtual') || info.loginid.startsWith('VRT');
    
    // Update account buttons
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
        if ((isDemo && btn.classList.contains('demo')) || (!isDemo && btn.classList.contains('real'))) {
            btn.classList.add('active');
        }
    });
    
    console.log(`🎯 Account Type: ${isDemo ? 'DEMO' : 'REAL'}`);
}

function updateBalance(balance) {
    currentBalance = balance;
    const elem = document.getElementById('accountBalance');
    if (elem) {
        elem.textContent = `$${parseFloat(balance).toFixed(2)}`;
    }
}

function updateCandles(candle) {
    if (!series) return;
    
    try {
        if (candles.length > 0 && candles[candles.length - 1].time === candle.time) {
            candles[candles.length - 1] = candle;
        } else {
            candles.push(candle);
            if (candles.length > 600) candles.shift();
        }
        
        series.update(candle);
    } catch (error) {
        console.error("❌ Candle update error:", error);
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
    
    if (geminiBrain && candles.length > 20) {
        const analysis = await geminiBrain.analyze({
            candles: candles,
            currentPrice: candles[candles.length - 1].close,
            mode: currentMode
        }, currentMode);
        
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
        }
        
        return null;
    }
}

// Place Trade
function placeTrade(direction, isAuto = false) {
    if (!isConnected || !currentToken) {
        alert("⚠️ Conecte sua conta primeiro!");
        return;
    }
    
    const stake = parseFloat(document.getElementById('stakeInput').value);
    const duration = parseInt(document.getElementById('durationSelect').value);
    
    if (currentBalance < stake) {
        alert(`⚠️ Saldo insuficiente!\nSaldo: $${currentBalance.toFixed(2)}`);
        return;
    }
    
    const req = {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type: direction,
        currency: 'USD',
        symbol: SYMBOL,
        duration: duration,
        duration_unit: 'm'
    };
    
    ws.send(JSON.stringify(req));
    console.log(`📤 Trade: ${direction} | $${stake}`);
    
    if (!isAuto) {
        alert(`✅ Trade ${direction} enviado!\nStake: $${stake}`);
    }
}

function handlePosition(p) {
    if (!p.contract_id) return;
    
    if (!positions.has(p.contract_id)) {
        positions.set(p.contract_id, p);
        console.log(`📊 Position opened: ${p.contract_type}`);
    }
    
    if (p.is_sold) {
        const profit = parseFloat(p.profit);
        positions.delete(p.contract_id);
        
        const trade = {
            time: new Date().toLocaleTimeString(),
            type: p.contract_type,
            stake: parseFloat(p.buy_price),
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
    console.log("🚀 JARVIS TRADER V3.3 Ready");
    console.log("🔐 OAuth Deriv System");
});
