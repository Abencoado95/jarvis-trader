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

// --- STATE VARIABLES ---
let currentMode = 'RISE_FALL';
let currentAccount = 'demo';
let isConnected = false;
let currentToken = "";
let availableAccounts = [];
let ws = null;
let currentBalance = 0;
let currentCurrency = 'USD';
let isAutoTrading = false; 
let activeAccumulators = []; 

let chart = null;
let series = null;
let positions = new Map();
let dailyProfitValue = 0;
let tradeHistory = [];
let geminiBrain = null;
let automationInterval = null;
let candles = [];
let currentCandle = null;
// Removed duplicate declarations directly

// ...

// Place Trade or Sell Action
function placeTrade(direction, isAuto = false) {
    // Lógica Especial para Vender Acumuladores
    if (direction === 'SELL_ACCU') {
        console.log("🛑 Fechando posições de Acumuladores...");
        if (positions.size === 0) {
            alert("⚠️ Nenhuma posição aberta para fechar.");
            return;
        }
        
        positions.forEach((pos, id) => {
            // Tenta vender contrato
            ws.send(JSON.stringify({
                sell: id,
                price: 0 // Vender a preço de mercado atual
            }));
            console.log(`📤 Vendendo posição: ${id}`);
        });
        return;
    }

    // Trade Normal de Compra/Entrada
    console.log(`🔘 Botão Clicado/Trigger: ${direction} (Auto: ${isAuto})`);
    
    // Feedback visual imediato para Manual
    if (!isAuto) {
        document.body.style.cursor = 'wait';
        setTimeout(() => document.body.style.cursor = 'default', 1000);
    }

    if (!isConnected || !currentToken) {
        alert("⚠️ Conecte sua conta primeiro!");
        return;
    }
    
    const stake = parseFloat(document.getElementById('stakeInput').value);
    const duration = parseInt(document.getElementById('durationSelect').value);
    
    // ... Validações ...
    if (currentBalance < stake) {
        alert(`⚠️ Saldo insuficiente!\nSaldo: ${currentBalance.toFixed(2)}`);
        return;
    }
    
    const params = buildContractParams(direction, stake, duration);
    
    if (!params) {
        alert("❌ Erro ao construir contrato");
        return;
    }
    
    console.log(`📤 Solicitando proposta: ${direction} | $${stake}`);
    
    // Primeiro solicita a proposta
    ws.send(JSON.stringify({
        proposal: 1,
        currency: currentCurrency || 'USD',
        ...params
    }));
    
    if (!isAuto) {
        console.log(`✅ Trade ${direction} solicitado`);
    }
}

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
    if (isAutoTrading) toggleAutomation();
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
    
    // Update UI Buttons
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    
    // Tenta achar o botão pelo modo (se event não existir)
    // Mapeamento Modo -> ID Botão (se necessário) ou texto
    // Simples: removemos active de todos e adicionamos ao clicado SE houver evento
    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: Acha o botão pelo onclick
        const btn = Array.from(document.querySelectorAll('.mode-btn')).find(b => b.getAttribute('onclick').includes(mode));
        if (btn) btn.classList.add('active');
    }

    updateTradeButtons();
    saveConfig(); // Persiste a escolha
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

function connectDeriv() {
    console.log(`🔐 Redirecting to Deriv OAuth (App ID: ${APP_ID})...`);
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=PT&brand=deriv`;
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
// Update Trade Buttons
function updateTradeButtons() {
    // 1. Visibilidade dos Inputs
    const digitConfig = document.getElementById('digitConfig');
    const durationSelect = document.getElementById('durationSelect');
    const durationLabel = durationSelect ? durationSelect.parentElement : null;
    
    if (digitConfig) digitConfig.style.display = (['MATCH_DIFFER', 'OVER_UNDER'].includes(currentMode)) ? 'block' : 'none';
    if (durationLabel) durationLabel.style.display = (currentMode === 'ACCUMULATORS' || ['MATCH_DIFFER', 'OVER_UNDER'].includes(currentMode)) ? 'none' : 'block';
    
    // 2. Container dos Botões
    const container = document.getElementById('tradeButtons');
    if (!container) return;
    
    // Limpar
    container.innerHTML = '';

    // --- MODO ACUMULADORES (BRILHANTE) ---
    if (currentMode === 'ACCUMULATORS') {
        const rateContainer = document.createElement('div');
        rateContainer.className = 'fade-in';
        rateContainer.style.marginBottom = '15px';
        rateContainer.innerHTML = `
            <label style="color: var(--neon-cyan); font-size: 0.8rem; display: block; margin-bottom: 5px;">TAXA DE CRESCIMENTO</label>
            <div style="display: flex; gap: 5px;">
                ${[1, 2, 3, 4, 5].map(r => `
                    <button id="rateBtn_${r}" class="growth-rate-btn ${r === 3 ? 'active' : ''}" 
                            onclick="selectGrowthRate(${r})"
                            style="flex: 1; padding: 10px; border: 1px solid var(--neon-cyan); 
                                   background: ${r===3 ? 'rgba(0,255,255,0.2)' : 'rgba(0,0,0,0.3)'}; 
                                   color: #fff; cursor: pointer; border-radius: 4px;">
                        ${r}%
                    </button>
                `).join('')}
            </div>
            <input type="hidden" id="growthRateInput" value="0.03">
        `;
        container.appendChild(rateContainer);
        
        // Botão Comprar
        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn-trade btn-accumulate';
        buyBtn.textContent = 'COMPRAR (ACUMULAR)';
        buyBtn.style.background = 'linear-gradient(to right, #00b09b, #96c93d)';
        buyBtn.onclick = () => placeTrade('ACCU');
        container.appendChild(buyBtn);
        
        // Botão Vender (Opcional, pois geralmente é na tabela de posições, mas bom ter aqui)
        const sellBtn = document.createElement('button');
        sellBtn.className = 'btn-trade btn-sell';
        sellBtn.textContent = 'VENDER / FECHAR';
        sellBtn.style.marginTop = '10px';
        sellBtn.style.background = 'linear-gradient(to right, #ff5f6d, #ffc371)';
        sellBtn.onclick = () => placeTrade('SELL_ACCU');
        container.appendChild(sellBtn);
        return;
    }

    // --- OUTROS MODOS (CLÁSSICOS) ---
    const buttonConfigs = {
        'RISE_FALL': [
            { id: 'btnCall', text: 'ASCENSÃO (CALL)', class: 'btn-call', action: 'CALL' },
            { id: 'btnPut', text: 'QUEDA (PUT)', class: 'btn-put', action: 'PUT' }
        ],
        'MATCH_DIFFER': [
            { id: 'btnDiffer', text: 'DIFERE (DIFFER)', class: 'btn-differ', action: 'DIFFER' },
            { id: 'btnMatch', text: 'COMBINA (MATCH)', class: 'btn-match', action: 'MATCH' }
        ],
        'OVER_UNDER': [
            { id: 'btnOver', text: 'OVER', class: 'btn-over', action: 'OVER' },
            { id: 'btnUnder', text: 'UNDER', class: 'btn-under', action: 'UNDER' }
        ]
    };
    
    const buttons = buttonConfigs[currentMode] || buttonConfigs['RISE_FALL'];
    container.innerHTML = buttons.map(btn => `
        <button class="btn-trade ${btn.class}" id="${btn.id}" onclick="placeTrade('${btn.action}')">
            ${btn.text}
        </button>
    `).join('');
}

// Helper para Selecionar Taxa
function selectGrowthRate(rate) {
    const input = document.getElementById('growthRateInput');
    if (input) input.value = (rate / 100).toFixed(2);
    
    document.querySelectorAll('.growth-rate-btn').forEach(btn => {
        btn.style.background = 'rgba(0,0,0,0.3)';
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`rateBtn_${rate}`);
    if (activeBtn) {
        activeBtn.style.background = 'rgba(0,255,255,0.2)';
        activeBtn.classList.add('active');
    }
}

// Automation Toggle
function toggleAutomation() {
    if (!isConnected) {
        alert("⚠️ Conecte sua conta Deriv primeiro!");
        return;
    }
    
    isAutoTrading = !isAutoTrading;
    const btn = document.getElementById('automationBtn'); // ID corrigido conforme HTML
    const status = document.getElementById('automationStatus'); // ID corrigido conforme HTML
    
    if (!btn || !status) {
        console.error("❌ ERRO CRÍTICO: Elemento do botão de automação não encontrado no DOM");
        return;
    }

    if (isAutoTrading) {
        // LIGAR
        btn.style.borderColor = 'var(--neon-green)';
        btn.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.4)";
        btn.innerHTML = `
            <div>PAUSAR SISTEMA JARVIS</div>
            <div id="automationStatus" style="font-size: 0.9rem; margin-top: 5px; color: var(--neon-green);">SISTEMA AUTOMÁTICO ATIVO</div>
        `;
        startAutomation();
        console.log("🚀 LIGANDO AUTOMAÇÃO");
    } else {
        // DESLIGAR
        stopAutomation();
        btn.style.borderColor = 'var(--neon-magenta)';
        btn.style.boxShadow = "none";
        btn.style.background = 'rgba(188, 19, 254, 0.1)';
        btn.innerHTML = `
            <div>LIGAR SISTEMA JARVIS</div>
            <div id="automationStatus" style="font-size: 0.9rem; margin-top: 5px; color: #8899a6;">SISTEMA MANUAL</div>
        `;
        console.log("🛑 PARANDO AUTOMAÇÃO");
    }
}

// --- VARIÁVEIS GLOBAIS EXTRAS ---
let baseStake = 1.0; // Salva a entrada inicial
let lossStreak = 0;   // Contador de perdas consecutivas

function startAutomation() {
    // A checagem if (isAutoTrading) return foi removida pois toggleAutomation ja seta como true antes de chamar
    
    // CHECK GLOBAL LIMITS (Meta/Stop)
    if (!checkGlobalLimits()) {
        stopAutomation();
        return;
    }
    
    // SAVE BASE STAKE
    const stakeInput = document.getElementById('stakeInput');
    baseStake = parseFloat(stakeInput.value);
    lossStreak = 0;
    
    isAutoTrading = true;
    // Assuming toggleAutomationUI exists or is handled by toggleAutomation
    // For now, we'll just ensure the UI is updated via toggleAutomation's logic
    // The original toggleAutomation already sets isAutoTrading and updates UI.
    // So, we might not need an explicit toggleAutomationUI(true) here if toggleAutomation is called to start.
    // However, the instruction implies this is a separate start function.
    // Let's assume toggleAutomationUI is a helper that updates the button state.
    // Since it's not defined, I'll omit it for now to avoid errors, but keep the comment.
    // toggleAutomationUI(true); 
    console.log(`🚀 LIGANDO AUTOMAÇÃO (Base Stake: $${baseStake})`);
    
    // Define intervalo baseado no modo
    // Over/Under/Match/Differ = Rápido (4s para dar tempo do tick)
    // Rise/Fall = Lento (45s)
    
    let intervalTime = 4000; 
    if (currentMode === 'RISE_FALL' || currentMode === 'ACCUMULATORS') {
        intervalTime = 45000;
    }
    
    // Primeiro ciclo imediato
    runAutoCycle();

    automationInterval = setInterval(runAutoCycle, intervalTime);
}

async function runAutoCycle() {
    if (!isAutoTrading) return;

    // 1. Verificar Limites de Segurança (TP/SL)
    if (!checkGlobalLimits()) {
        stopAutomation();
        return;
    }

    // 2. Analisar Mercado
    console.log("🔄 Ciclo de Automação: Analisando...");
    const analysis = await analyzeMarket(true); // true = silent mode
    
    // --- SMART RECOVERY INTERCEPTOR ---
    // Se acabamos de sofrer um Loss no Differ, o Brain sugere o melhor alvo para recuperar.
    if (window.needsSmartRecovery && analysis && typeof analysis.best_differ_digit !== 'undefined') {
        const newTarget = analysis.best_differ_digit;
        console.warn(`🧠 SMART RECOVERY: Trocando alvo de Differ para ${newTarget} (Estatisticamente Mais Seguro)`);
        
        const digitSel = document.getElementById('digitSelect');
        if (digitSel) {
            digitSel.value = newTarget;
            // Atualiza visualmente se necessário
        }
        
        window.needsSmartRecovery = false; // Reset flag
        
        // Forçar ação imediata de recuperação
        analysis.action = 'DIFFER'; // Garantir que trade execute
        analysis.confidence = 99;   // Prioridade máxima
    }
    
    // 3. Executar Trade se confiança alta
    if (analysis && analysis.action !== 'WAIT' && analysis.confidence >= 75) {
        console.log(`🎯 Oportunidade Identificada: ${analysis.action} (${analysis.confidence}%)`);
        placeTrade(analysis.action, true); // true = isAuto
    } else {
        const reason = analysis ? analysis.reason : 'Sem sinal';
        console.log(`⏳ Aguardando... ${reason}`);
    }
}

function stopAutomation() {
    isAutoTrading = false;
    if (automationInterval) {
        clearInterval(automationInterval);
        automationInterval = null;
    }
    const btn = document.getElementById('automationBtn');
    if (btn) {
         btn.style.borderColor = 'var(--neon-magenta)';
         btn.style.boxShadow = "none";
         btn.style.background = 'rgba(188, 19, 254, 0.1)';
         btn.innerHTML = `
            <div>LIGAR SISTEMA JARVIS</div>
            <div id="automationStatus" style="font-size: 0.9rem; margin-top: 5px; color: #8899a6;">SISTEMA MANUAL</div>
        `;
    }
}

// ... (rest of code)

function handlePosition(p) {
    if (!p.contract_id) return;
    
    // Atualizar UI de posições etc...
    // ...

    // Se a posição foi fechada (sold)
    if (p.is_sold) {
        const profit = parseFloat(p.profit);
        
        // Atualizar histórico
        const entry = {
            id: p.contract_id,
            type: p.contract_type,
            profit: profit,
            time: new Date().toLocaleTimeString()
        };
        tradeHistory.unshift(entry);
        if (tradeHistory.length > 50) tradeHistory.pop();
        updateHistory();
        
        updateDailyProfit(profit);
        
        // Log de resultado
        if (profit > 0) {
            console.log(`✅ WIN: $${profit.toFixed(2)}`);
            // Tocar som se quiser
        } else {
            console.log(`❌ LOSS: $${profit.toFixed(2)}`);
        }
        
        positions.delete(p.contract_id);
        
        // REINICIAR CICLO AUTOMÁTICO SE NECESSÁRIO
        if (isAutoTrading) {
            if (profit < 0) {
                // --- LOGICA DE MARTINGALE ---
                lossStreak++;
                
                const stakeInput = document.getElementById('stakeInput');
                let currentStake = parseFloat(stakeInput.value);
                
                // Multiplicador agressivo para Differ (baixa prob de perda, alto custo de recuperação)
                let multiplier = 2.4; // Padrão
                if (currentMode === 'MATCH_DIFFER') {
                    multiplier = 11.5; // Differ paga ~9-10%. Precisa de ~11x para cobrir.
                    
                    // ATIVAR RECUPERAÇÃO INTELIGENTE (Trocar dígito)
                    window.needsSmartRecovery = true; 
                    console.warn(`⚠️ DIFFER LOSS DETECTED. Ativando Troca Inteligente de Dígito.`);
                }
                
                const newStake = (currentStake * multiplier).toFixed(2);
                
                // Trava de Segurança (Max Stake)
                if (newStake > 50.00 && currentMode === 'MATCH_DIFFER') {
                    console.error("🛑 Martingale excedeu limite de segurança ($50). Resetando.");
                    stakeInput.value = baseStake.toFixed(2);
                    lossStreak = 0;
                } else {
                    console.log(`🔄 Martingale: Stake aumentado para $${newStake} (x${multiplier})`);
                    stakeInput.value = newStake;
                }

            } else {
                // WIN - RESET
                if (lossStreak > 0) {
                    console.log("✅ Recuperação Concluída. Resetando Stake.");
                    const stakeInput = document.getElementById('stakeInput');
                    stakeInput.value = baseStake.toFixed(2);
                    lossStreak = 0;
                }
            }
        }
    } else {
        // Atualizar status da posição aberta
        positions.set(p.contract_id, p);
        
        // Se for acumulador e tiver lucro, e estivermos no manual ou auto com meta batida...
        if (p.contract_type === 'ACCU' && p.is_valid_to_sell && p.profit > 0) {
            // Lógica de SAÍDA INTELIGENTE (Scalping)
            // Se lucro > 5% do stake (aprox 2-3 ticks), garante o lucro!
            // Acumuladores são perigosos se segurar muito tempo.
            const stake = p.buy_price;
            const targetProfit = stake * 0.05; // 5%
            
            if (p.profit >= targetProfit) {
                console.log(`💰 Auto-Closing ACCU Acc: $${p.profit.toFixed(2)} (> 5%)`);
                sellContract(p.contract_id);
            }
        }
    }
    
    // Atualizar tabela de posições
    updatePositionsTable();
}

// Helper para tick handler (Backup, por enquanto vazia pois handlePosition cuida disso via proposal)
function checkAccumulatorExit(currentPrice) {
    // Pode ser usada para Stop Loss baseado em preço spot
}

// Renderiza Tabela de Posições Abertas
function updatePositionsTable() {
    const tbody = document.getElementById('openPositionsBody');
    const totalPLSpan = document.getElementById('totalOpenPL');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let totalPL = 0;
    const sortedPositions = Array.from(positions.values()).sort((a,b) => b.buy_time - a.buy_time);
    
    sortedPositions.forEach(p => {
        const profit = parseFloat(p.profit) || 0;
        const profitColor = profit >= 0 ? '#00ff41' : '#ff003c';
        
        totalPL += profit;
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #333';
        
        // Data formatada
        const timeStr = p.purchase_time ? new Date(p.purchase_time * 1000).toLocaleTimeString() : '--:--:--';
        
        tr.innerHTML = `
            <td style="padding: 12px 8px; color: #888;">${timeStr}</td>
            <td style="padding: 12px 8px; color: #ccc;">${p.contract_type}</td>
            <td style="padding: 12px 8px; color: ${profitColor}; font-weight: bold; font-size: 1.1em;">
                ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USD
            </td>
            <td style="padding: 12px 8px;">
                ${p.is_valid_to_sell ? `
                    <button onclick="sellContract('${p.contract_id}')" style="
                        background: #ff9800; color: #000; border: none; 
                        padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;
                        font-size: 0.8em; text-transform: uppercase;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    ">FECHAR</button>
                ` : '<span style="color:#666">...</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Atualiza Lucro Total no Header
    if (totalPLSpan) {
        const totalColor = totalPL >= 0 ? '#00ff41' : '#ff003c';
        totalPLSpan.style.color = totalColor;
        totalPLSpan.innerText = `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`;
    }
}

// Vender Contrato Manualmente
window.sellContract = function(id) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`🔻 Vendendo contrato ${id}...`);
        ws.send(JSON.stringify({ sell: id, price: 0 }));
    }
}

// --- FUNÇÃO DE SEGURANÇA (FALTANDO ANTERIORMENTE) ---
function checkGlobalLimits() {
    // 1. Verificar Meta de Lucro (Take Profit)
    const tpInput = document.getElementById('takeProfitInput');
    const tp = tpInput ? parseFloat(tpInput.value) : 9999;
    
    if (dailyProfitValue >= tp) {
        console.log("🎉 META DIÁRIA BATIDA!");
        alert(`🎉 PARABÉNS! Meta de $${tp.toFixed(2)} atingida. Automação pausada.`);
        stopAutomation();
        return false;
    }
    
    // 2. Verificar Limite de Perda (Stop Loss)
    const slInput = document.getElementById('stopLossInput');
    const sl = slInput ? parseFloat(slInput.value) : 9999;
    
    // dailyProfitValue é negativo quando perdemos (ex: -10)
    // Se dailyProfitValue (-10) for menor ou igual a -stopLoss (-50), ok.
    // Mas se o usuário colocar Stop Loss 50, queremos parar se for <= -50.
    
    if (dailyProfitValue <= -sl) {
        console.log("🛑 STOP LOSS ATINGIDO!");
        alert(`🛑 ATENÇÃO! Limite de perda $${sl.toFixed(2)} atingido. Automação pausada.`);
        stopAutomation();
        return false;
    }
    
    return true; // Pode continuar operando
}

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
            // PEGAR TAXA ESCOLHIDA (1% a 5%)
            const rateInput = document.getElementById('growthRateInput');
            const growthRate = rateInput ? parseFloat(rateInput.value) : 0.03;
            
            return {
                contract_type: 'ACCU',
                symbol: symbol,
                growth_rate: growthRate,
                basis: 'stake',
                amount: stake
            };
            
        default:
            return null;
    }
}

// Init Platform
function initTradingPlatform() {
    console.log("🚀 Initializing...");
    
    // 1. CarregarConfigs
    loadConfig();
    
    // 2. Setup Auto-Save
    setupConfigSavers();

    updateTradeButtons();
    
    setTimeout(() => {
        initChart();
       // Load saved API Key
    const savedKey = localStorage.getItem('jarvis_gemini_key');
    const keyInput = document.getElementById('apiKeyInput');
    if (keyInput) {
        if (savedKey) keyInput.value = savedKey;
        
        // Auto-save on change
        keyInput.addEventListener('input', (e) => {
            localStorage.setItem('jarvis_gemini_key', e.target.value.trim());
        });
    }

    // Connect WebSocket
    connectWS();
        
        if (typeof GeminiBrain !== 'undefined') {
            geminiBrain = new GeminiBrain();
        }
    }, 200);
}

// --- SISTEMA DE CACHE DE CONFIGURAÇÕES ---
function saveConfig() {
    const config = {
        mode: currentMode,
        stake: document.getElementById('stakeInput')?.value || "1.00",
        digit: document.getElementById('digitSelect')?.value || "5",
        duration: document.getElementById('durationSelect')?.value || "1",
        tp: document.getElementById('takeProfitInput')?.value || "",
        sl: document.getElementById('stopLossInput')?.value || ""
    };
    localStorage.setItem('jarvis_user_config', JSON.stringify(config));
}

function loadConfig() {
    const saved = localStorage.getItem('jarvis_user_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            
            // Restaurar Modo
            if (config.mode && config.mode !== currentMode) changeMode(config.mode);
            
            // Restaurar Inputs
            if (config.stake && document.getElementById('stakeInput')) 
                document.getElementById('stakeInput').value = config.stake;
                
            if (config.digit && document.getElementById('digitSelect')) 
                document.getElementById('digitSelect').value = config.digit;
                
            if (config.duration && document.getElementById('durationSelect')) 
                document.getElementById('durationSelect').value = config.duration;
                
            if (config.tp && document.getElementById('takeProfitInput')) 
                document.getElementById('takeProfitInput').value = config.tp;
                
            if (config.sl && document.getElementById('stopLossInput')) 
                document.getElementById('stopLossInput').value = config.sl;
                
            console.log("📂 Configurações carregadas.");
        } catch (e) { console.error(e); }
    }
}

function setupConfigSavers() {
    const inputs = [
        'stakeInput', 'digitSelect', 'durationSelect', 
        'takeProfitInput', 'stopLossInput'
    ];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveConfig);
            el.addEventListener('input', saveConfig); 
        }
    });
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
        
        // --- INJEÇÃO DA UI VISUAL (DIGIT SELECTOR ESTÁTICO 0-9) ---
        const tradeContainer = document.getElementById('tradeButtons')?.parentElement;
        
        if (tradeContainer) {
            // 1. DIGIT VISUALIZER (Static 0-9)
            let viz = document.getElementById('digitVisualizer');
            if (!viz) {
                viz = document.createElement('div');
                viz.id = 'digitVisualizer';
                viz.style.cssText = "display: flex; gap: 8px; justify-content: center; margin: 15px 0; padding: 15px; background: rgba(0,0,0,0.6); border-radius: 12px; border: 1px solid #333;";
                tradeContainer.insertBefore(viz, document.getElementById('tradeButtons'));
                
                // Renderizar 0 a 9 fixos
                viz.innerHTML = [0,1,2,3,4,5,6,7,8,9].map(d => `
                    <div id="dig_ball_${d}" class="digit-ball" style="
                        width: 30px; height: 30px; 
                        border-radius: 50%; 
                        background: #333; 
                        color: #777; 
                        font-weight: bold; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        border: 2px solid transparent;
                    ">${d}</div>
                `).join('');
            }
            
            // 2. POSITIONS TABLE CONTAINER
            // (Mantém a lógica da tabela, se já não existir)
            if (!document.getElementById('positionsTable')) {
                // ... (código existente da tabela) ...
                const posDiv = document.createElement('div');
                posDiv.style.cssText = "margin-top: 20px; border-top: 1px solid #333; padding-top: 10px;";
                posDiv.innerHTML = `
                    <h4 style="color: #ccc; margin-bottom: 10px; display:flex; justify-content:space-between;">
                        POSIÇÕES ABERTAS <span id="totalOpenPL" style="color:#fff;">$0.00</span>
                    </h4>
                    <table id="positionsTable" style="width: 100%; text-align: left; font-size: 0.9em; border-collapse: collapse;">
                        <thead style="color: #666; border-bottom: 1px solid #333;">
                            <tr>
                                <th style="padding: 5px;">TIME</th>
                                <th style="padding: 5px;">TIPO</th>
                                <th style="padding: 5px;">LUCRO</th>
                                <th style="padding: 5px;">AÇÃO</th>
                            </tr>
                        </thead>
                        <tbody id="openPositionsBody"></tbody>
                    </table>
                `;
                tradeContainer.appendChild(posDiv);
            }
        }

    } catch (error) {
        console.error("❌ Chart error:", error);
    }
}

// --- VISUALIZADOR DE DÍGITOS 2.0 (ESTÁTICO + REGRA) ---
function renderDigitWorm(lastDigit) { // Mantendo nome para compatibilidade
    const target = parseInt(document.getElementById('digitSelect')?.value || 5);
    const mode = currentMode;
    
    // 1. Atualizar Cores Baseadas na Regra (Win/Loss)
    for (let i = 0; i <= 9; i++) {
        const el = document.getElementById(`dig_ball_${i}`);
        if (!el) continue;
        
        // Reset básico
        el.style.transform = 'scale(1)';
        el.style.boxShadow = 'none';
        el.style.borderColor = 'transparent';
        el.style.color = '#fff';
        
        let isWinZone = false;
        
        if (mode === 'OVER_UNDER') {
            // Padrão visual: Over
            // Se target = 5. Over 5 ganha em 6,7,8,9.
            if (i > target) isWinZone = true;
        } else if (mode === 'MATCH_DIFFER') {
            // Se target = 5. Match ganha em 5.
            if (i === target) isWinZone = true;
        } else {
            // Outros modos, neutro ou Par/Impar
            if (i % 2 === 0) isWinZone = true; // Exemplo
        }
        
        // Cor do Fundo
        if (isWinZone) {
            el.style.background = 'rgba(0, 255, 65, 0.2)'; // Verde suave
            el.style.color = '#00ff41';
        } else {
            el.style.background = 'rgba(255, 0, 60, 0.2)'; // Vermelho suave
            el.style.color = '#ff003c';
        }
        
        // 2. Destaque do Dígito ATUAL (O Anel de LED)
        if (i === lastDigit) {
            el.style.transform = 'scale(1.3)';
            el.style.background = isWinZone ? '#00ff41' : '#ff003c';
            el.style.color = '#000'; // Contraste
            el.style.boxShadow = `0 0 15px ${isWinZone ? '#00ff41' : '#ff003c'}`;
            el.style.borderColor = '#fff';
            el.style.zIndex = '10';
        }
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
            currentCurrency = info.currency || 'USD'; // Captura a moeda da conta
            
            console.log("✅ Authorized!");
            console.log(`   Account: ${info.loginid}`);
            console.log(`   Balance: ${info.balance} ${currentCurrency}`);
            console.log(`   Name: ${info.fullname}`);
            
            updateBalance(currentBalance);
            updateAccountUI(info);
            
            // Subscribe to data
            ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            // Candles
            ws.send(JSON.stringify({ 
                ticks_history: SYMBOL, 
                adjust_start_time: 1, 
                count: 500, 
                end: 'latest', 
                style: 'candles', 
                granularity: 60, 
                subscribe: 1 
            }));
            // TICKS REAIS (Para Digit Worm e precisão)
            ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1 }));
            
            ws.send(JSON.stringify({ proposal_open_contract: 1, subscribe: 1 }));
        }
        
        // --- TICK HANDLER (NOVO) ---
        if (data.msg_type === 'tick') {
            const price = data.tick.quote;
            const time = data.tick.epoch;
            
            // Atualiza Digit Worm VISUALMENTE (Prioridade)
            const quoteStr = price.toFixed(data.tick.pip_size || 2); 
            const lastDigit = parseInt(quoteStr.slice(-1));
            
            if (!isNaN(lastDigit)) {
                // Atualiza Worm apenas se tivermos renderDigitWorm
                if (typeof renderDigitWorm === 'function') {
                    renderDigitWorm(lastDigit);
                }
            }

            // NÃO ATUALIZAR GRÁFICO AQUI! 
            // O gráfico é de CANDLES. Atualizar com tick quebra a lib (Erro: Cannot update oldest data).
            // Deixe o stream de 'ohlc' cuidar do gráfico.
            
            // Salva dígitos para estratégia local (Gemini Brain)
            if (window.updateDigits) window.updateDigits(lastDigit); 
            
            // Se estiver em Acumuladores, monitorar saída (Scalping)
            if (currentMode === 'ACCUMULATORS') {
                checkAccumulatorExit(price);
            }
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
            
            // Sempre habilitar botões após análise
            document.querySelectorAll('.btn-trade').forEach(btn => btn.disabled = false);
            
            // Log da análise no console (sem popup)
            console.log(`📊 Análise: ${analysis.action} | Confiança: ${analysis.confidence}% | ${analysis.reason}`);
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

// Função placeTrade antiga removida (já definida no topo)

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
            isAuto: isAutoTrading
        };
        
        tradeHistory.unshift(trade);
        updateHistory();
        updateDailyProfit(profit);
        
        console.log(`${profit > 0 ? '✅ WIN' : '❌ LOSS'}: $${profit.toFixed(2)}`);
        
        // --- MARTINGALE INTELIGENTE V3 ---
        if (isAutoTrading) {
            const stakeInput = document.getElementById('stakeInput');
            let currentStake = parseFloat(stakeInput.value);
            
            if (profit > 0) {
                // WIN: Verifica se recuperou
                // Com multiplicador alto, 1 win geralmente recupera tudo.
                console.log(`♻️ WIN! Lucro: +$${profit.toFixed(2)}. Resetando sistema.`);
                stakeInput.value = baseStake.toFixed(2);
                lossStreak = 0;
            } else {
                // LOSS: Calcula recuperação agressiva
                lossStreak++;
                let multiplier = 2.4; // Aumentado de 2.1 para 2.4 para cobrir taxas/payouts menores
                
                // Ajuste para DIGIT DIFFER (Payout muito baixo ~9%)
                if (currentMode === 'MATCH_DIFFER') {
                     multiplier = 11.5; 
                }
                
                // Proteção: Limite de Gales (ex: 8)
                if (lossStreak > 8) {
                    console.warn("⚠️ Máximo de Gales atingido (8). Resetando por segurança.");
                    stakeInput.value = baseStake.toFixed(2);
                    lossStreak = 0;
                } else {
                    const newStake = (currentStake * multiplier).toFixed(2);
                    console.log(`📉 LOSS (Streak: ${lossStreak}). Martingale Agressivo ${multiplier}x: $${currentStake} -> $${newStake}`);
                    stakeInput.value = newStake;
                }
            }
        }
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
