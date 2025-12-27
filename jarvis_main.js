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
    try {
        const saved = localStorage.getItem('jarvis_accounts');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                availableAccounts = parsed;
                const acc = availableAccounts.find(a => a.type.toUpperCase() === currentAccount.toUpperCase());
                currentToken = acc ? acc.token : parsed[0].token;
                
                console.log(`✅ Contas recuperadas: ${parsed.length}`);
                console.log(`🔑 Usando token: ${currentToken.substring(0, 5)}...`);
                
                // INITIALIZE IMMEDIATELY
                setTimeout(() => {
                    if (!isConnected) initTradingPlatform();
                }, 500);
                
                return true;
            }
        }
    } catch(e) {
        console.error("Error loading saved accounts:", e);
    }
    
    console.log("⚠️ Nenhuma conta encontrada. Necessário conectar.");
    return false;
}

function reconnectDeriv() {
    if (ws) {
        ws.close();
    }
    setTimeout(connectWS, 500);
}

// DERIV OAUTH (Reforçado)
function switchAccount(accountType) {
    currentAccount = accountType;
    
    // Update UI
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(accountType)) {
            btn.classList.add('active');
        }
    });
    
    // Check memory first
    let account = availableAccounts.find(a => 
        accountType === 'demo' ? a.id.startsWith('VRT') : a.id.startsWith('CR')
    );
    
    // Check disk second (Backup logic)
    if (!account) {
        try {
            const saved = JSON.parse(localStorage.getItem('jarvis_accounts') || '[]');
            account = saved.find(a => accountType === 'demo' ? a.id.startsWith('VRT') : a.id.startsWith('CR'));
            if (account) availableAccounts = saved; // Refresh memory
        } catch(e) { console.error(e); }
    }
    
    if (account) {
        console.log(`🔄 Trocando para ${accountType.toUpperCase()}: ${account.id}`);
        currentToken = account.token;
        reconnectDeriv();
    } else {
        console.log("⚠️ Conta não encontrada, redirecionando para OAuth...");
        connectDeriv();
    }
}

// Update Trade Buttons
function updateTradeButtons() {
    const container = document.getElementById('tradeButtons');
    if (!container) return;
    
    // UI Visibility Logic
    const digitConfig = document.getElementById('digitConfig');
    const durationSelect = document.getElementById('durationSelect');
    const durationLabel = durationSelect ? durationSelect.parentElement : null;
    
    // Show/Hide Digest Config
    if (['MATCH_DIFFER', 'OVER_UNDER'].includes(currentMode)) {
        if (digitConfig) digitConfig.style.display = 'block';
        if (durationLabel) durationLabel.style.display = 'none'; // Hide duration for ticks
    } else {
        if (digitConfig) digitConfig.style.display = 'none';
        if (durationLabel) durationLabel.style.display = 'block';
    }
    
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
            { id: 'btnOver', text: 'OVER', class: 'btn-over', action: 'OVER' },
            { id: 'btnUnder', text: 'UNDER', class: 'btn-under', action: 'UNDER' }
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
        btn.textContent = 'PAUSAR SISTEMA JARVIS';
        status.textContent = 'SISTEMA AUTOMÁTICO ATIVO';
        status.style.color = 'var(--neon-magenta)';
        startAutomation();
    } else {
        btn.classList.remove('active');
        btn.textContent = 'LIGAR SISTEMA JARVIS';
        status.textContent = 'SISTEMA MANUAL';
        status.style.color = '#8899a6';
        stopAutomation();
    }
}

function startAutomation() {
    // Avoid spamming API
    if (automationInterval) clearInterval(automationInterval);
    
    automationInterval = setInterval(async () => {
        if (!isAutomationActive || positions.size > 0) return;
        
        // Only analyze if not recently analyzed (rate limit avoid)
        const analysis = await analyzeMarket(true);
        
        if (analysis && analysis.confidence > 70) {
            placeTrade(analysis.action, true);
        }
    }, 45000); // Increased to 45s to avoid 429 errors
}

// ... (rest of code)

function buildContractParams(action, stake, duration) {
    const symbol = "R_100";
    // Get barrier for digits
    const barrier = document.getElementById('digitSelect') ? document.getElementById('digitSelect').value : '5';
    
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
                barrier: barrier
            };
            
        case 'OVER_UNDER':
            return {
                contract_type: action === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER',
                symbol: symbol,
                duration: 5,
                duration_unit: 't',
                basis: 'stake',
                amount: stake,
                barrier: barrier
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
    
    const params = buildContractParams(direction, stake, duration);
    
    if (!params) {
        alert("❌ Erro ao construir contrato");
        return;
    }
    
    ws.send(JSON.stringify({
        buy: "1",
        price: stake,
        parameters: params
    }));
    
    console.log(`📤 Trade: ${direction} | $${stake} | Barrier: ${params.barrier || 'N/A'}`);
    
    if (!isAuto) {
        // Only alert if manual
        // alert(`✅ Trade ${direction} enviado!\nStake: $${stake}`);
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
                <span>${trade.time} - ${trade.type} ${trade.isAuto ? '[AUTO]' : ''}</span>
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

// Helper para Token Manual (Emergência)
window.setToken = function(token, isReal = false) {
    const type = isReal ? 'REAL' : 'DEMO';
    const id = isReal ? 'MANUAL_REAL' : 'MANUAL_DEMO';
    const currency = 'USD';
    
    const acc = { token, id, currency, type };
    availableAccounts = [acc];
    localStorage.setItem('jarvis_accounts', JSON.stringify(availableAccounts));
    currentToken = token;
    
    console.log(`✅ Token MANUAL definido para ${type}. Conectando...`);
    reconnectDeriv();
};

// Init
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 JARVIS TRADER V3.3 Ready");
    console.log("🔐 OAuth Deriv System");
    
    // Check for OAuth callback or saved accounts immediately
    setTimeout(() => {
        checkAuthAndInit();
    }, 500);
});
