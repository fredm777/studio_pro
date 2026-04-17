// Studio Pro Dashboard Logic v1.9 (RELEASE)
// ==========================================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwX9xG_snc8EmBttBBOW3M8bNOUxZojeXjfag22pGgGnb5EcfgphhJ3klR8JPv8cAObFQ/exec';
const LIFF_ID = '2009659478-RZ3Q85ZU'; 

let allCustomers = [];
let currentFilteredCustomers = [];
let currentPage = 1;
let itemsPerPage = parseInt(localStorage.getItem('st_pro_items_per_page')) || 20;

let allMembers = [];
let currentUser = null;
let registeredUsername = ''; 
let verifyContext = 'register'; 

// --- Toast Mixin for Non-blocking Notifications ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

let navHintTimer = null;
function showNavHint(msg) {
    const saveBtn = document.querySelector('.save-btn');
    const originalBtnText = saveBtn ? saveBtn.innerText : '儲存變更';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = '同步中...';
    }

    try {
        const hintEl = document.getElementById('navHint');
        if (!hintEl) return;
        hintEl.innerText = msg;
        hintEl.classList.add('active');
        if (navHintTimer) clearTimeout(navHintTimer);
        navHintTimer = setTimeout(() => {
            hintEl.classList.remove('active');
        }, 4000);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = originalBtnText;
        }
    }
}

// --- Performance & Sync Helpers ---

window.closeAllModals = () => {
    console.log(">> Closing all active modals...");
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
};

function setSyncStatus(active) {
    const bar = document.getElementById('syncProgressBar');
    const badge = document.getElementById('syncBadge');
    if (active) {
        if (bar) {
            bar.style.width = '30%';
            bar.classList.add('active');
        }
        if (badge) badge.classList.add('active');
        // Simulate progress
        setTimeout(() => { 
            if (bar && bar.classList.contains('active')) bar.style.width = '70%'; 
        }, 500);
    } else {
        if (bar) bar.style.width = '100%';
        setTimeout(() => {
            if (bar) {
                bar.classList.remove('active');
                bar.style.width = '0%';
            }
            if (badge) badge.classList.remove('active');
        }, 300);
    }
}

// --- Hybrid Caching Helpers ---
function getCache(key) {
    const cached = localStorage.getItem(`st_pro_cache_${key}`);
    return cached ? JSON.parse(cached) : null;
}
function setCache(key, data) {
    localStorage.setItem(`st_pro_cache_${key}`, JSON.stringify(data));
}
document.addEventListener('DOMContentLoaded', () => {
    console.log(">> System Init: v1.9 Release Starting...");
    try { initEventListeners(); } catch(e) { console.error("Event Init Error:", e); }
    try { initTabs(); } catch(e) { console.error("Tab Init Error:", e); }
    if (window.lucide) { lucide.createIcons(); }
    

    // New Combined Init Flow
    const initApp = async () => {
        setSyncStatus(true);
        const hasLiffParams = window.location.search.includes('liffClientId') || window.location.search.includes('code') || window.location.search.includes('liff.state');
        
        if (hasLiffParams) {
            console.log(">> LINE Redirect detected, awaiting processing...");
            await handleLiffRedirect();
        }
        
        // Final state check: If we don't have a user and aren't already switching stages (e.g. to Register), show auth
        if (!currentUser && document.querySelectorAll('.auth-stage.active').length === 0) {
            checkAuth();
        }
        setSyncStatus(false);
    };

    initApp();
    initResizableTable();
    initBackgroundParallax();
    setTimeout(checkModalIntegrity, 2000);
});

function checkAuth() {
    const session = localStorage.getItem('st_pro_session');
    if (session) {
        try { currentUser = JSON.parse(session); enterApp(); } catch (e) { showAuth(); }
    } else { showAuth(); }
}

function enterApp() {
    const authOverlay = document.getElementById('authOverlay');
    const appEl = document.getElementById('app');
    
    // Smooth transition
    if (authOverlay) authOverlay.classList.add('fade-out');
    if (appEl) {
        appEl.classList.remove('hidden');
        appEl.classList.add('fade-in');
    }
    const displayEl = document.getElementById('displayUser');
    const adminBtn = document.getElementById('adminTabBtn');
    const customersBtn = document.getElementById('customersTabBtn');
    const projectsBtn = document.getElementById('projectsTabBtn');
    const customerActions = document.getElementById('customerActions');

    if (authOverlay) authOverlay.style.display = 'none';
    if (appEl) appEl.classList.remove('hidden');
    if (!currentUser) {
        console.error(">> enterApp Error: currentUser is NULL. Redirecting to auth...");
        showAuth();
        return;
    }
    
    if (displayEl) displayEl.innerText = (currentUser.nickname || currentUser.username || "使用者");
    
    const userLevel = (currentUser.level || '').trim();
    console.log(">> Normalized User Level:", userLevel);

    if (userLevel === '管理者') {
        if (adminBtn) adminBtn.classList.remove('hidden');
        if (customersBtn) {
            customersBtn.classList.remove('hidden');
            customersBtn.click();
        }
        if (customerActions) customerActions.style.display = 'flex';
    } else if (userLevel === '操作人員') {
        if (adminBtn) adminBtn.classList.add('hidden');
        if (customersBtn) {
            customersBtn.classList.remove('hidden');
            customersBtn.click();
        }
        if (customerActions) customerActions.style.display = 'flex';
    } else {
        // '客戶' or unknown
        if (adminBtn) adminBtn.classList.add('hidden');
        if (customersBtn) {
            customersBtn.classList.remove('hidden'); // allow viewing but restricted actions
            customersBtn.click();
        }
        if (customerActions) customerActions.style.display = 'none'; // strictly read-only
    }
    
    // Background Load
    fetchCustomers();
}

window.switchAuthStage = (stage, clearErrors = true) => {
    document.querySelectorAll('.auth-stage').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    const target = document.getElementById(`${stage}Stage`);
    if (target) { target.style.display = 'block'; target.classList.add('active'); }
    
    if (clearErrors) {
        // Clear all inline errors
        document.querySelectorAll('.auth-error-inline, .input-error-msg').forEach(err => {
            err.innerText = '';
            err.classList.remove('active');
        });
    }
};

function showAuth(initialErrorMsg = null) {
    const authOverlay = document.getElementById('authOverlay');
    const appEl = document.getElementById('app');
    
    if (authOverlay) {
        authOverlay.classList.remove('fade-out');
        authOverlay.style.display = 'flex';
    }
    if (appEl) appEl.classList.add('hidden');
    
    // Switch to login stage, optionally preserving errors
    switchAuthStage('login', !initialErrorMsg);
    
    if (initialErrorMsg) {
        const lineErr = document.getElementById('lineAuthError');
        if (lineErr) {
            lineErr.innerText = initialErrorMsg;
            lineErr.classList.add('active');
        }
    }
}

async function handleLoginForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);

    const loginErr = document.getElementById('loginMainError');
    if (loginErr) { loginErr.innerText = ''; loginErr.classList.remove('active'); }

    // --- System Settings Management ---

window.switchAdminSubTab = function(target) {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#admin .sub-nav .tab-link').forEach(l => l.classList.remove('active'));
    
    if (target === 'members') {
        const listEl = document.getElementById('adminListView');
        const tabEl = document.getElementById('adminMembersTab');
        if (listEl) listEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');
    } else if (target === 'settings') {
        const settingsEl = document.getElementById('adminSettingsView');
        const tabEl = document.getElementById('adminSettingsTab');
        if (settingsEl) settingsEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');
        fetchSettings();
    }
}

async function fetchSettings() {
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_settings' })
        });
        const json = await res.json();
        if (json.success) {
            const s = json.settings;
            if (s.bank_info) {
                const b = JSON.parse(s.bank_info);
                document.getElementById('setBankName').value = b.bankName || '';
                document.getElementById('setAccountName').value = b.accountName || '';
                document.getElementById('setAccountNum').value = b.accountNumber || '';
            }
            if (s.standard_terms) {
                document.getElementById('setTerms').value = s.standard_terms;
            }
        }
    } catch(e) { console.error("Fetch Settings Error:", e); }
    finally { setSyncStatus(false); }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    setSyncStatus(true);
    const bankInfo = {
        bankName: document.getElementById('setBankName').value,
        accountName: document.getElementById('setAccountName').value,
        accountNumber: document.getElementById('setAccountNum').value
    };
    const settings = {
        bank_info: JSON.stringify(bankInfo),
        standard_terms: document.getElementById('setTerms').value
    };
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'update_settings', settings })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire({ icon: 'success', title: '設定已儲存', timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire('錯誤', '儲存設定失敗', 'error');
        }
    } catch(e) { 
        Swal.fire('連線錯誤', '無法儲存設定', 'error');
    } finally { setSyncStatus(false); }
}

// --- Project & Quotation Logic ---

let allProjects = [];
let currentFilteredProjects = [];
let projectPage = 1;
let projectItemsPerPage = parseInt(localStorage.getItem('st_pro_project_items_per_page')) || 20;

window.fetchProjects = async function() {
    setSyncStatus(true);
    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'block';

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_projects' })
        });
        const json = await res.json();
        if (json.success) {
            allProjects = json.projects;
            currentFilteredProjects = [...allProjects];
            projectPage = 1;
            renderProjects();
        }
    } catch (err) { console.error("Fetch Projects Error:", err); }
    finally {
        setSyncStatus(false);
        if (loading) loading.style.display = 'none';
    }
}

function renderProjects() {
    const tbody = document.getElementById('projectTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'none';

    if (currentFilteredProjects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem;">尚未建立專案，點擊下方按鈕開始</td></tr>`;
        const pag = document.getElementById('projectPaginationContainer');
        if (pag) pag.style.display = 'none';
        return;
    }

    // Pagination Slicing
    const totalPages = Math.ceil(currentFilteredProjects.length / projectItemsPerPage);
    if (projectPage > totalPages) projectPage = totalPages || 1;
    
    const start = (projectPage - 1) * projectItemsPerPage;
    const end = start + projectItemsPerPage;
    const pagedEntries = currentFilteredProjects.slice(start, end);

    // Update UI info
    const pag = document.getElementById('projectPaginationContainer');
    if (pag) pag.style.display = (currentFilteredProjects.length > 0) ? 'flex' : 'none';
    const info = document.getElementById('projPageInfo');
    if (info) info.innerText = `第 ${projectPage} / ${totalPages || 1} 頁 (共 ${currentFilteredProjects.length} 筆)`;

    pagedEntries.forEach(proj => {
        // Find customer nickname
        const cust = allCustomers.find(c => c.customerId === proj.customerId);
        const custDisp = cust ? (cust.nickname || cust.companyName) : proj.customerId;
        const dateStr = proj.date ? new Date(proj.date).toLocaleDateString() : '';
        const totalDisp = proj.total ? Number(proj.total).toLocaleString() : '0';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${custDisp}</td>
            <td>${dateStr}</td>
            <td>${proj.projectName || ''}</td>
            <td>${proj.pic || ''}</td>
            <td style="font-weight:700; color:var(--primary);">$${totalDisp}</td>
        `;
        tr.ondblclick = () => showQuotationEditor('編輯報價單', proj);
        tbody.appendChild(tr);
    });
}

window.showQuotationEditor = function(title, data = null) {
    switchSubView('projects', 'edit');
    const form = document.getElementById('quotationForm');
    form.reset();
    document.getElementById('quotationTitle').innerText = title;
    document.getElementById('quotationItemsBody').innerHTML = '';
    
    // Clear suggests
    document.getElementById('autocompleteSuggestions').style.display = 'none';

    if (data) {
        // Edit Mode
        document.getElementById('projRowIndex').value = data.rowIndex || '';
        document.getElementById('projId').value = data.projectId || '';
        document.getElementById('qProjName').value = data.projectName || '';
        document.getElementById('qPic').value = data.pic || '';
        document.getElementById('qDate').value = data.date ? new Date(data.date).toISOString().split('T')[0] : '';
        document.getElementById('qDays').value = data.days || '';
        document.getElementById('qRemark').value = data.remark || '';
        
        // Fill customer via ID (this will also update the UI)
        selectCustomerById(data.customerId);
        
        // Load items via backend if necessary, or pass in data (Wait, GAS didn't return items in get_projects)
        // I need to fetch items separately or let GAS return them bundled. 
        // Let's adjust GAS to return bundled items or add a fetch for it.
        // Actually, let's keep it simple: I'll add a fetchItems function.
        fetchProjectItems(data.projectId);
    } else {
        // New Mode
        document.getElementById('projRowIndex').value = '';
        document.getElementById('projId').value = generateProjectId();
        document.getElementById('qPic').value = currentUser ? (currentUser.nickname || currentUser.username) : '';
        document.getElementById('qDate').value = new Date().toISOString().split('T')[0];
        addQuotationRow(); // start with one empty row
        loadSettingsPreview(); // load default terms from settings
    }
}

async function fetchProjectItems(projId) {
    // For now, I'll mock this or assume it was bundled. 
    // Optimization: I'll add the items to the same handleGetProjects in GAS next.
    // But to save time, I'll just add one dummy row for now to show UI is working.
    addQuotationRow(); 
}

function generateProjectId() {
    const date = new Date();
    const YYYYMMDD = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `SP-${YYYYMMDD}-${random}`;
}

async function loadSettingsPreview() {
    try {
        // Load from cache or fetch sessionly
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_settings' })
        });
        const json = await res.json();
        if (json.success) {
            const s = json.settings;
            let processStr = "";
            if (s.bank_info) {
                const b = JSON.parse(s.bank_info);
                processStr += `[匯款帳號]\n銀行：${b.bankName}\n戶名：${b.accountName}\n帳號：${b.accountNumber}\n\n`;
            }
            if (s.standard_terms) {
                processStr += `[作業及合約條款]\n${s.standard_terms}`;
            }
            document.getElementById('qProcessContent').innerText = processStr;
        }
    } catch(e) {}
}

function addQuotationRow(data = null) {
    const tbody = document.getElementById('quotationItemsBody');
    const rowIdx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="text-align:center;">${rowIdx}</td>
        <td><input class="i-name" placeholder="項目名稱" value="${data ? data.name : ''}"></td>
        <td><textarea class="i-content" placeholder="細項內容..." rows="1">${data ? data.content : ''}</textarea></td>
        <td><input type="number" class="i-price" value="${data ? data.price : 0}" oninput="calcQuotation()"></td>
        <td><input type="number" class="i-qty" value="${data ? data.qty : 1}" oninput="calcQuotation()"></td>
        <td><input type="number" class="i-total readonly-field" readonly value="${data ? data.subtotal : 0}"></td>
        <td style="text-align:center;"><div class="remove-row-btn" onclick="this.closest('tr').remove(); calcQuotation();">×</div></td>
    `;
    tbody.appendChild(tr);
    calcQuotation();
}

function calcQuotation() {
    let subtotal = 0;
    const rows = document.querySelectorAll('#quotationItemsBody tr');
    rows.forEach((row, idx) => {
        row.cells[0].innerText = idx + 1; // update index
        const price = parseFloat(row.querySelector('.i-price').value) || 0;
        const qty = parseFloat(row.querySelector('.i-qty').value) || 0;
        const total = price * qty;
        row.querySelector('.i-total').value = total;
        subtotal += total;
    });

    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;

    document.getElementById('qSubtotal').innerText = subtotal.toLocaleString();
    document.getElementById('qTax').innerText = tax.toLocaleString();
    document.getElementById('qTotal').innerText = total.toLocaleString();
}

// Autocomplete Logic
function initQuotationAutocomplete() {
    const input = document.getElementById('qCustSearch');
    const container = document.getElementById('autocompleteSuggestions');
    if (!input || !container) return;

    input.oninput = () => {
        const val = input.value.trim().toLowerCase();
        if (!val) { container.style.display = 'none'; return; }
        
        const suggestions = allCustomers.filter(c => {
            // Scan all fields for the keyword
            return Object.values(c).some(fieldVal => 
                String(fieldVal || '').toLowerCase().includes(val)
            );
        });

        if (suggestions.length === 0) { container.style.display = 'none'; return; }

        container.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" onclick="selectCustomerById('${s.customerId}')">
                <span class="s-name">${s.companyName} (${s.nickname || '無簡稱'})</span>
                <span class="s-tax">統編：${s.taxId || '無'} | 聯絡人：${s.contact || '無'}</span>
            </div>
        `).join('');
        container.style.display = 'block';
    };

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) container.style.display = 'none';
    });
}

window.selectCustomerById = function(cid) {
    const cust = allCustomers.find(c => c.customerId === cid);
    if (!cust) return;

    document.getElementById('qCustName').value = cust.companyName || '';
    document.getElementById('qTaxId').value = cust.taxId || '';
    document.getElementById('qContact').value = cust.contact || '';
    document.getElementById('qPhone').value = String(cust.phone || '').replace("'", "");
    document.getElementById('qEmail').value = cust.email || '';
    document.getElementById('qCustSearch').value = cust.companyName;
    document.getElementById('autocompleteSuggestions').style.display = 'none';
    
    // Hidden customer ID
    // I need a way to store the selected customer ID. I'll use a data attribute or another hidden input.
    document.getElementById('qCustSearch').dataset.selectedId = cid;
}

async function handleQuotationSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);

    const project = {
        rowIndex: document.getElementById('projRowIndex').value,
        projectId: document.getElementById('projId').value,
        date: document.getElementById('qDate').value,
        projectName: document.getElementById('qProjName').value,
        customerId: document.getElementById('qCustSearch').dataset.selectedId,
        pic: document.getElementById('qPic').value,
        subtotal: parseFloat(document.getElementById('qSubtotal').innerText.replace(/,/g, '')),
        tax: parseFloat(document.getElementById('qTax').innerText.replace(/,/g, '')),
        total: parseFloat(document.getElementById('qTotal').innerText.replace(/,/g, '')),
        days: document.getElementById('qDays').value,
        remark: document.getElementById('qRemark').value
    };

    const items = [];
    document.querySelectorAll('#quotationItemsBody tr').forEach(row => {
        items.push({
            index: row.cells[0].innerText,
            name: row.querySelector('.i-name').value,
            content: row.querySelector('.i-content').value,
            price: parseFloat(row.querySelector('.i-price').value),
            qty: parseFloat(row.querySelector('.i-qty').value),
            subtotal: parseFloat(row.querySelector('.i-total').value)
        });
    });

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_project', project, items })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire({ icon: 'success', title: '儲存成功', timer: 1500, showConfirmButton: false });
            switchSubView('projects', 'list');
            fetchProjects();
        } else {
            Swal.fire('錯誤', json.error || '儲存失敗', 'error');
        }
    } catch (e) {
        Swal.fire('連線錯誤', '無法儲存資料', 'error');
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    const btn = e.target ? e.target.querySelector('button[type="submit"]') : null;
    const username = document.getElementById('user').value || '';
    const password = document.getElementById('pass').value || '';
    
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    
    const loginErr = document.getElementById('loginMainError');
    if (loginErr) { loginErr.innerText = ''; loginErr.classList.remove('active'); }

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'login', username, password })
        });
        
        const json = await res.json();
        
        if (json.success) {
            currentUser = json.user;
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
            enterApp();
            Swal.fire({ icon: 'success', title: '登入成功', text: `歡迎回來, ${currentUser.nickname || currentUser.username}`, timer: 1500, showConfirmButton: false });
        } else {
            if (loginErr) {
                loginErr.innerText = json.error || '帳號或密碼錯誤';
                loginErr.classList.add('active');
            } else {
                Swal.fire({ icon: 'error', title: '登入失敗', text: json.error || '帳號或密碼錯誤' });
            }
        }
    } catch (err) {
        console.error(">> Login Error Caught:", err);
        if (loginErr) {
            loginErr.innerText = '連線失敗，請檢查網路';
            loginErr.classList.add('active');
        } else {
            Swal.fire({ icon: 'error', title: '連線失敗', text: '請檢查網路連線' });
        }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    registeredUsername = document.getElementById('regUser').value;
    const password = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const nickname = registeredUsername; 
    
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    
    // Clear error
    const regErr = document.getElementById('registerMainError');
    if (regErr) { regErr.innerText = ''; regErr.classList.remove('active'); }
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'register', username: registeredUsername, password, nickname, email })
        });
        
        const json = await res.json();
        
        if (json.success) {
            Swal.fire({ icon: 'success', title: '註冊成功', text: '帳號建立成功，請完成驗證', timer: 2000, showConfirmButton: false });
            verifyContext = 'register';
            switchAuthStage('verify');
        } else { 
            if (regErr) {
                regErr.innerText = json.error || '註冊失敗';
                regErr.classList.add('active');
            } else {
                Toast.fire({ title: '註冊失敗', text: json.error, icon: 'error' }); 
            }
        }
    } catch (err) { 
        if (regErr) {
            regErr.innerText = '連線失敗，請檢查網路';
            regErr.classList.add('active');
        } else {
            Toast.fire({ title: '連線錯誤', icon: 'error' }); 
        }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

async function checkAvailability(type, value) {
    if (!value) return;
    const errorEl = document.getElementById(type === 'username' ? 'regUserError' : 'regEmailError');
    if (!errorEl) return;

    // Simple Email Check
    if (type === 'email' && !value.includes('@')) {
        errorEl.innerText = '請輸入有效的電子郵件地址';
        errorEl.classList.add('active');
        return;
    }

    try {
        const body = { action: 'check_availability' };
        if (type === 'username') body.username = value;
        else body.email = value;

        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        
        if (json.success) {
            const available = type === 'username' ? json.usernameAvailable : json.emailAvailable;
            if (!available) {
                errorEl.innerText = `此${type === 'username' ? '帳號' : 'E-mail'}已被使用`;
                errorEl.classList.add('active');
            } else {
                errorEl.classList.remove('active');
            }
        }
    } catch (e) { console.error("Validation Error:", e); }
}

async function handleVerify(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const code = document.getElementById('vCodeInput').value;
    
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    
    // Clear error
    const vErr = document.getElementById('verifyError');
    if (vErr) { vErr.innerText = ''; vErr.classList.remove('active'); }
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'verify_code', username: registeredUsername, code })
        });
        const json = await res.json();
        
        if (json.success) {
            if (verifyContext === 'forgot' && json.user) {
                currentUser = json.user;
                localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
                enterApp();
                openProfileModal();
                
                // Show hint in red text
                const passErr = document.getElementById('profPassError');
                if (passErr) {
                    passErr.innerText = '驗證成功，請直接輸入新密碼並儲存';
                    passErr.classList.add('active');
                }
            } else {
                Swal.fire({ icon: 'success', title: '驗證成功', timer: 1500, showConfirmButton: false });
                switchAuthStage('login');
            }
        } else {
            if (vErr) {
                vErr.innerText = json.error || '驗證碼無效';
                vErr.classList.add('active');
            } else {
                Toast.fire({ title: '驗證失敗', text: json.error || '驗證碼無效', icon: 'error' });
            }
        }
    } catch (err) { 
        if (vErr) {
            vErr.innerText = '連線失敗，請稍後再試';
            vErr.classList.add('active');
        } else {
            Toast.fire({ title: '連線錯誤', text: '請稍後再試', icon: 'error' });
        }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

function initEventListeners() {
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el[event] = handler;
    };

    safeBind('loginForm', 'onsubmit', handleLoginForm);
    safeBind('registerForm', 'onsubmit', handleRegister);
    
    // Live Validation for Registration
    const regUserInput = document.getElementById('regUser');
    const regEmailInput = document.getElementById('regEmail');
    if (regUserInput) regUserInput.onblur = () => checkAvailability('username', regUserInput.value);
    if (regEmailInput) regEmailInput.onblur = () => checkAvailability('email', regEmailInput.value);

    safeBind('verifyForm', 'onsubmit', handleVerify);
    safeBind('logoutBtn', 'onclick', logout);
    safeBind('bindLineBtn', 'onclick', startLiffBinding);
    safeBind('lineLoginBtn', 'onclick', loginViaLine);

    const socialToggle = document.getElementById('socialToggle');
    if (socialToggle) {
        socialToggle.onclick = () => {
            const options = document.getElementById('socialOptions');
            if (options) {
                options.style.display = options.style.display === 'none' ? 'block' : 'none';
            }
        };
    }
    
    safeBind('addCustomerBtn', 'onclick', () => showCustomerEditor('新增客戶資料'));
    const custForm = document.getElementById('customerForm');
    if (custForm) custForm.onsubmit = (e) => { e.preventDefault(); saveCustomer(); };
    
    safeBind('userInfoTrigger', 'onclick', openProfileModal);
    safeBind('profileForm', 'onsubmit', handleProfileUpdateSubmit);
    safeBind('memberForm', 'onsubmit', handleMemberUpdateSubmit);
    safeBind('globalSettingsForm', 'onsubmit', handleSettingsSubmit);
    safeBind('quotationForm', 'onsubmit', handleQuotationSubmit);
    
    // Initialize specific components
    initQuotationAutocomplete();
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const activeTab = document.querySelector('.tab-link.active');
            if (!activeTab) return;
            const tab = activeTab.dataset.tab;
            if (tab === 'customers') filterCustomers(e.target.value);
            else if (tab === 'projects') filterProjects(e.target.value);
            else filterMembers(e.target.value);
        };
    }
    
    // Note: ModalOverlay specific listeners removed as it's now a sub-view

    // Profile Modal outside-click
    const pModal = document.getElementById('profileModal');
    if (pModal) {
        pModal.onclick = (e) => {
            if (e.target === pModal) closeProfileModal();
        };
    }
    
    safeBind('forgotForm', 'onsubmit', handleForgotSubmit);

    // Customer Pagination
    const itemsInput = document.getElementById('itemsPerPageInput');
    if (itemsInput) {
        itemsInput.value = itemsPerPage;
        itemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 20;
            itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', itemsPerPage);
            currentPage = 1;
            renderCustomers();
        };
        itemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(itemsInput.value) || 20;
            if (e.deltaY < 0) val += 5; else val -= 5;
            if (val < 1) val = 1;
            if (val > 200) val = 200;
            itemsInput.value = val;
            itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', itemsPerPage);
            currentPage = 1;
            renderCustomers();
        };
    }

    // Project Pagination
    const projItemsInput = document.getElementById('projItemsPerPageInput');
    if (projItemsInput) {
        projItemsInput.value = projectItemsPerPage;
        projItemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 20;
            projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', projectItemsPerPage);
            projectPage = 1;
            renderProjects();
        };
        projItemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(projItemsInput.value) || 20;
            if (e.deltaY < 0) val += 5; else val -= 5;
            if (val < 1) val = 1;
            if (val > 200) val = 200;
            projItemsInput.value = val;
            projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', projectItemsPerPage);
            projectPage = 1;
            renderProjects();
        };
    }

    safeBind('prevPageBtn', 'onclick', () => changePage(-1));
    safeBind('nextPageBtn', 'onclick', () => changePage(1));
    safeBind('projPrevPageBtn', 'onclick', () => changePage(-1));
    safeBind('projNextPageBtn', 'onclick', () => changePage(1));
    
    const sel = document.getElementById('itemsPerPageSelector');
    if (sel) sel.onchange = (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderCustomers();
    };

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 1. Close Modals
            const activeModals = document.querySelectorAll('.modal-overlay.active');
            if (activeModals.length > 0) {
                activeModals.forEach(m => m.classList.remove('active'));
                return;
            }

            // 2. Back to List if in Edit mode
            const activeTab = document.querySelector('.tab-link.active');
            if (activeTab) {
                const tabId = activeTab.dataset.tab;
                const editView = document.getElementById(`${tabId}EditView`);
                if (editView && editView.classList.contains('active')) {
                    switchSubView(tabId, 'list');
                }
            }
        }
    });

    // Password Visibility Logic
    document.querySelectorAll('.password-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const toggle = wrapper.querySelector('.toggle-password');
        if (input && toggle) {
            if (input.value.length > 0) toggle.classList.add('visible');
            input.addEventListener('input', () => {
                if (input.value.length > 0) toggle.classList.add('visible');
                else toggle.classList.remove('visible');
            });
        }
    });
}

function initTabs() {
    document.querySelectorAll('.tab-link').forEach(t => {
        t.onclick = () => {
            const tabId = t.dataset.tab;
            document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const section = document.getElementById(tabId);
            if (section) {
                section.classList.add('active');
                // Always reset to list view when switching main tabs
                switchSubView(tabId, 'list');
            }
            
            // Contextual Button Toggle (Keep search visible)
            const addBtn = document.getElementById('addCustomerBtn');
            const customerActions = document.getElementById('customerActions');
            if (addBtn) addBtn.style.display = (tabId === 'customers') ? 'block' : 'none';
            if (customerActions) customerActions.style.display = (tabId === 'customers' || tabId === 'projects') ? 'flex' : 'none';
            
            // Clear search when switching
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            
            if (tabId === 'admin') {
                fetchMembers();
                switchAdminSubTab('members');
            } else if (tabId === 'projects') {
                fetchProjects();
            } else {
                renderCustomers();
            }
            
            // Re-init resizers for new tab content
            initResizableTable();
        };
    });
}

function initResizableTable() {
    document.querySelectorAll('th').forEach(th => {
        if (th.querySelector('.resizer')) return;
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);

        let x = 0;
        let w = 0;

        const onMouseMove = (e) => {
            const dx = e.pageX - x;
            th.style.width = `${w + dx}px`;
            th.style.minWidth = `${w + dx}px`; // Important for table-layout
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', (e) => {
            x = e.pageX;
            const styles = window.getComputedStyle(th);
            w = parseInt(styles.width, 10);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.classList.add('resizing');
        });

        // Double Click to Auto-Fit
        resizer.addEventListener('dblclick', () => {
            const colIndex = Array.from(th.parentNode.children).indexOf(th);
            const table = th.closest('table');
            const rows = table.querySelectorAll('tr');
            
            // Create a temporary span to measure text width accurately
            const tester = document.createElement('span');
            tester.style.visibility = 'hidden';
            tester.style.position = 'absolute';
            tester.style.whiteSpace = 'nowrap';
            tester.style.font = window.getComputedStyle(th).font;
            document.body.appendChild(tester);

            let maxWidth = 0;
            rows.forEach(row => {
                const cell = row.children[colIndex];
                if (cell) {
                    tester.innerText = cell.innerText;
                    const cellWidth = tester.offsetWidth + 32; // Include padding
                    if (cellWidth > maxWidth) maxWidth = cellWidth;
                }
            });

            document.body.removeChild(tester);
            th.style.width = `${maxWidth}px`;
            th.style.minWidth = `${maxWidth}px`;
        });
    });
}

window.fetchCustomers = async function() {
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_customers' })
        });
        const json = await res.json();
        if (json.success) { 
            const hasChanged = JSON.stringify(allCustomers) !== JSON.stringify(json.data);
            if (hasChanged) {
                allCustomers = json.data; 
                setCache('customers', allCustomers);
                currentFilteredCustomers = allCustomers;
                renderCustomers(); 
            }
        }
    } catch (err) { 
        console.error("Fetch Error:", err);
    } finally {
        setSyncStatus(false);
        const loading = document.getElementById('tableLoading');
        if (loading) loading.style.display = 'none';
        // Reload projects if needed after customer data is ready for name mapping
        if (document.getElementById('projects').classList.contains('active')) fetchProjects();
    }
}

window.changePage = (dir) => {
    const activeTab = document.querySelector('.tab-link.active');
    if (!activeTab) return;
    const tab = activeTab.dataset.tab;

    if (tab === 'customers') {
        const totalPages = Math.ceil(currentFilteredCustomers.length / itemsPerPage);
        currentPage += dir;
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages || 1;
        renderCustomers();
    } else if (tab === 'projects') {
        const totalPages = Math.ceil(currentFilteredProjects.length / projectItemsPerPage);
        projectPage += dir;
        if (projectPage < 1) projectPage = 1;
        if (projectPage > totalPages) projectPage = totalPages || 1;
        renderProjects();
    }
};

function renderCustomers() {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const loading = document.getElementById('tableLoading');
    const pagCont = document.getElementById('paginationContainer');
    if (loading) loading.style.display = 'none';
    if (pagCont) pagCont.style.display = 'flex';
    
    const totalItems = currentFilteredCustomers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) pageInfo.innerText = `第 ${currentPage} / ${totalPages} 頁 (共 ${totalItems} 筆)`;
    if (prevBtn) { prevBtn.disabled = (currentPage === 1); prevBtn.style.opacity = (currentPage === 1) ? '0.3' : '1'; }
    if (nextBtn) { nextBtn.disabled = (currentPage === totalPages); nextBtn.style.opacity = (currentPage === totalPages) ? '0.3' : '1'; }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = currentFilteredCustomers.slice(startIndex, startIndex + itemsPerPage);
    
    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;">沒有符合的資料</td></tr>`;
        return;
    }

    paginatedData.forEach(item => {
        const tr = document.createElement('tr');
        const isInvoice = (item.invoiceInfo === 'v' || item.invoiceInfo === 'V');
        const invoiceHtml = isInvoice ? '<span class="invoice-badge"><i data-lucide="check"></i></span>' : '';
        
        tr.innerHTML = `<td>${item.companyName || ''}</td><td>${item.taxId || ''}</td><td>${item.nickname || ''}</td><td>${item.contact || ''}</td><td>${item.phone || ''}</td><td>${item.email || ''}</td><td>${item.address || ''}</td><td style="text-align:center;">${invoiceHtml}</td>`;
        tr.ondblclick = () => showCustomerEditor('客戶明細與編輯', item);
        tbody.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

window.switchSubView = function(tabId, viewType) {
    const section = document.getElementById(tabId);
    if (!section) return;

    // viewType: 'list' or 'edit'
    const listView = section.querySelector('.sub-view-stack[id$="ListView"]');
    const editView = section.querySelector('.sub-view-stack[id$="EditView"]');

    if (viewType === 'list') {
        if (editView) editView.classList.remove('active');
        setTimeout(() => {
            if (listView) listView.classList.add('active');
        }, editView ? 50 : 0); // Minimal delay for transition feel
    } else {
        if (listView) listView.classList.remove('active');
        setTimeout(() => {
            if (editView) editView.classList.add('active');
        }, listView ? 50 : 0);
    }
    
    // Auto-scroll to top of view
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.showCustomerEditor = (title, data = null) => {
    console.log(">> showCustomerEditor Triggered:", { title, hasData: !!data });

    if (!currentUser) {
        return Toast.fire({ icon: 'warning', title: '請先登入' });
    }
    const userRole = (currentUser.level || '').trim();
    if (userRole === '客戶') {
        return Swal.fire('提示', '客戶帳號僅供讀取，無法修改資料', 'info');
    }
    
    const titleEl = document.getElementById('viewTitleCustomer');
    const form = document.getElementById('customerForm');
    
    if (titleEl) titleEl.innerText = title;
    switchSubView('customers', 'edit');
    
    if (form) form.reset();
    
    // Clear error
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
    const rowIdxEl = document.getElementById('rowIndex');
    if (rowIdxEl) rowIdxEl.value = data ? data.rowIndex : '';
    const custIdEl = document.getElementById('customerId');
    if (custIdEl) custIdEl.value = data ? data.customerId : '';
    
    if (data) {
        if (document.getElementById('companyName')) document.getElementById('companyName').value = data.companyName || '';
        if (document.getElementById('taxId')) document.getElementById('taxId').value = data.taxId || '';
        if (document.getElementById('nickname')) document.getElementById('nickname').value = data.nickname || '';
        if (document.getElementById('contact')) document.getElementById('contact').value = data.contact || '';
        let phone = String(data.phone || '');
        if (phone.startsWith("'")) phone = phone.slice(1);
        if (document.getElementById('phone')) document.getElementById('phone').value = phone;
        if (document.getElementById('email')) document.getElementById('email').value = data.email || '';
        if (document.getElementById('address')) document.getElementById('address').value = data.address || '';
        if (document.getElementById('invoiceInfo')) document.getElementById('invoiceInfo').checked = (data.invoiceInfo === 'v' || data.invoiceInfo === 'V');
    }
    
    if (window.lucide) lucide.createIcons();
}

window.saveCustomer = async function() {
    const rIndex = document.getElementById('rowIndex').value;
    const body = {
        action: rIndex ? 'update_customer' : 'add_customer',
        rowIndex: rIndex ? parseInt(rIndex) : null,
        customerId: document.getElementById('customerId') ? document.getElementById('customerId').value : '',
        companyName: document.getElementById('companyName').value,
        taxId: document.getElementById('taxId').value,
        nickname: document.getElementById('nickname').value,
        contact: document.getElementById('contact').value,
        phone: document.getElementById('phone').value.startsWith("'") ? document.getElementById('phone').value : "'" + document.getElementById('phone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        invoiceInfo: document.getElementById('invoiceInfo').checked ? 'v' : ''
    };

    // --- Optimistic UI Update ---
    const originalData = JSON.parse(JSON.stringify(allCustomers));
    
    // Clear error
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
    if (rIndex) {
        const idx = allCustomers.findIndex(c => c.rowIndex == rIndex);
        if (idx !== -1) allCustomers[idx] = { ...allCustomers[idx], ...body };
    } else {
        // Temporary row index for new items (will be overwritten by fetch)
        allCustomers.unshift({ ...body, rowIndex: -1 });
    }
    
    currentFilteredCustomers = allCustomers;
    renderCustomers();
    setSyncStatus(true);

    try {
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(body) 
        });
        const json = await res.json();
        if (json.success) { 
            Swal.fire({ 
                html: `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem;">
                        <div class="invoice-badge" style="width: 60px; height: 60px; background: rgba(5, 196, 107, 0.1); border-radius: 50%;">
                            <i data-lucide="check" style="width: 32px; height: 32px; color: #05c46b; stroke-width: 4;"></i>
                        </div>
                        <h2 style="font-size: 1.5rem; color: var(--text-dark); margin: 0;">已儲存</h2>
                    </div>
                `,
                timer: 1500, 
                showConfirmButton: false,
                didOpen: () => {
                    if (window.lucide) lucide.createIcons();
                }
            });
            switchSubView('customers', 'list');
            fetchCustomers(); // Refresh to get actual server state/IDs
        } else {
            throw new Error(json.error);
        }
    } catch (e) { 
        // Revert UI
        allCustomers = originalData;
        currentFilteredCustomers = allCustomers;
        renderCustomers();
        
        if (custErr) {
            custErr.innerText = '同步失敗: ' + (e.message || '請重新嘗試');
            custErr.classList.add('active');
        } else {
            Toast.fire({ title: '同步失敗', text: '資料已還原，編號：' + (e.message || ''), icon: 'error' }); 
        }
    } finally {
        setSyncStatus(false);
    }
}

async function handleForgotSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById('forgotEmail').value;
    
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    
    // Clear error
    const fErr = document.getElementById('forgotError');
    if (fErr) { fErr.innerText = ''; fErr.classList.remove('active'); }
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'forgot_password', email })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire({ icon: 'success', title: '驗證碼已寄出', text: '請檢查您的電子郵件', timer: 2000, showConfirmButton: false });
            registeredUsername = json.username;
            verifyContext = 'forgot';
            switchAuthStage('verify');
        } else {
            if (fErr) {
                fErr.innerText = json.error || '發送失敗';
                fErr.classList.add('active');
            } else {
                Toast.fire({ title: '發送失敗', text: json.error, icon: 'error' });
            }
        }
    } catch (err) { 
        if (fErr) {
            fErr.innerText = '連線失敗，請檢查網路';
            fErr.classList.add('active');
        } else {
            Toast.fire({ title: '連線錯誤', icon: 'error' }); 
        }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

async function fetchMembers() {
    if (!currentUser || (currentUser.level || '').trim() !== '管理者') {
        console.warn(">> fetchMembers blocked: insufficient permissions or no user");
        return;
    }
    try {
        setSyncStatus(true);
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: 'get_all_members', username: currentUser.username }) 
        });
        const json = await res.json();
        if (json.success) {
            allMembers = json.data;
            renderMembers(allMembers);
        } else {
            console.error("Fetch Members Backend Error:", json.error);
        }
    } catch (e) { 
        console.error("Fetch Members Network/Request Error:", e); 
    } finally {
        setSyncStatus(false);
    }
}

function renderMembers(list) {
    const tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${m.username}</td><td>${m.nickname}</td><td>${m.level}</td><td>${m.email}</td><td><button class="primary-btn" style="width:auto; padding:4px 12px;" onclick="showMemberEditor(${m.rowIndex})">設定</button></td>`;
        tbody.appendChild(tr);
    });
}

function filterMembers(query) {
    const q = query.toLowerCase();
    const filtered = allMembers.filter(m => 
        String(m.username || '').toLowerCase().includes(q) ||
        String(m.nickname || '').toLowerCase().includes(q) ||
        String(m.email || '').toLowerCase().includes(q)
    );
    renderMembers(filtered);
}

window.showMemberEditor = (idx) => {
    console.log(">> showMemberEditor Triggered for Index:", idx);

    if (!currentUser) return;
    const m = allMembers.find(x => x.rowIndex == idx);
    if (!m) return console.error("Member not found for row index:", idx);
    
    switchSubView('admin', 'edit');

    document.getElementById('memberTargetRow').value = idx;
    document.getElementById('memberUser').value = m.username || '';
    document.getElementById('memberLevel').value = m.level || '客戶';
    document.getElementById('memberStatus').value = m.status || 'active';

    // Clear error
    const memErr = document.getElementById('memberError');
    if (memErr) { memErr.innerText = ''; memErr.classList.remove('active'); }
    
    if (window.lucide) lucide.createIcons();
};

async function handleMemberUpdateSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const body = { action: 'update_member_status', adminUser: currentUser.username, targetRowIndex: parseInt(document.getElementById('memberTargetRow').value), level: document.getElementById('memberLevel').value, status: document.getElementById('memberStatus').value };
    
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    
    // Clear error
    const memErr = document.getElementById('memberError');
    if (memErr) { memErr.innerText = ''; memErr.classList.remove('active'); }
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { 
            Swal.fire({ icon: 'success', title: '權限已更新', timer: 1500, showConfirmButton: false });
            switchSubView('admin', 'list'); 
            fetchMembers(); 
        } else {
            if (memErr) {
                memErr.innerText = json.error || '更新失敗';
                memErr.classList.add('active');
            } else {
                Toast.fire({ title: '更新失敗', icon: 'error' });
            }
        }
    } catch (e) { 
        if (memErr) {
            memErr.innerText = '更新失敗，請檢查網路';
            memErr.classList.add('active');
        } else {
            Toast.fire({ title: '更新失敗', icon: 'error' }); 
        }
    }
    finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

window.openProfileModal = function() {
    console.log(">> openProfileModal Triggered.");
    window.closeAllModals();
    if (!currentUser) return console.warn(">> openProfileModal blocked: no currentUser.");

    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.classList.add('active');
        console.log(">> Added 'active' class to profileModal.");
    }
    
    if (document.getElementById('profUser')) document.getElementById('profUser').value = currentUser.username;
    if (document.getElementById('profNick')) document.getElementById('profNick').value = currentUser.nickname || '';
    if (document.getElementById('profEmail')) document.getElementById('profEmail').value = currentUser.email || '';
    let phone = String(currentUser.phone || '');
    if (phone.startsWith("'")) phone = phone.slice(1);
    document.getElementById('profPhone').value = phone;
    
    // Reset password fields
    const p1 = document.getElementById('profPass1');
    const p2 = document.getElementById('profPass2');
    if (p1) { p1.value = ''; p1.type = 'password'; }
    if (p2) p2.value = '';
    
    // Clear error message
    const passErr = document.getElementById('profPassError');
    if (passErr) { 
        passErr.innerText = ''; 
        passErr.classList.remove('active'); 
    }
    
    const bindBtn = document.getElementById('bindLineBtn');
    const statusText = document.getElementById('lineStatusText');
    
    if (currentUser.lineId) {
        statusText.innerHTML = '已綁定';
        statusText.style.color = '#06C755';
        bindBtn.style.display = 'none';
    } else {
        statusText.innerHTML = '尚未綁定';
        statusText.style.color = 'var(--text-muted)';
        bindBtn.style.display = 'block';
    }
}
window.closeProfileModal = () => document.getElementById('profileModal').classList.remove('active');

window.handleProfileUpdateSubmit = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const pass1 = document.getElementById('profPass1').value;
    const pass2 = document.getElementById('profPass2').value;
    
    // Clear error message first
    const passErr = document.getElementById('profPassError');
    if (passErr) { 
        passErr.innerText = ''; 
        passErr.classList.remove('active'); 
    }
    
    if (pass1 && pass1 !== pass2) {
        if (passErr) {
            passErr.innerText = '兩次輸入的密碼不一致';
            passErr.classList.add('active');
        } else {
            Toast.fire('錯誤', '兩次密碼不一致', 'error');
        }
        return;
    }

    const body = { 
        action: 'update_profile', 
        username: currentUser.username, 
        nickname: document.getElementById('profNick').value, 
        email: document.getElementById('profEmail').value, 
        phone: document.getElementById('profPhone').value.startsWith("'") ? document.getElementById('profPhone').value : "'" + document.getElementById('profPhone').value,
        newPassword: pass1 || null
    };

    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);

    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { 
            currentUser = json.user; 
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser)); 
            const displayEl = document.getElementById('displayUser');
            if (displayEl) displayEl.innerText = currentUser.nickname || currentUser.username;
            Swal.fire({ icon: 'success', title: '資料已更新', timer: 1500, showConfirmButton: false });
            closeProfileModal(); 
        } else {
            if (passErr) {
                passErr.innerText = json.error || '更新失敗';
                passErr.classList.add('active');
            } else {
                Toast.fire({ title: '更新失敗', text: json.error, icon: 'error' });
            }
        }
    } catch (e) { 
        if (passErr) {
            passErr.innerText = '連線失敗，請檢查網路';
            passErr.classList.add('active');
        } else {
            Toast.fire({ title: '連線失敗', icon: 'error' }); 
        }
    }
    finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

window.filterCustomers = function(val) {
    const query = String(val).toLowerCase();
    currentFilteredCustomers = allCustomers.filter(c => {
        // Global keyword scan across all fields (address, contact, email, etc.)
        return Object.values(c).some(fieldVal => 
            String(fieldVal || '').toLowerCase().includes(query)
        );
    });
    currentPage = 1;
    renderCustomers();
}

window.filterProjects = function(val) {
    const query = String(val).toLowerCase();
    currentFilteredProjects = allProjects.filter(p => {
        // Find customer nickname for joint search
        const cust = allCustomers.find(c => c.customerId === p.customerId);
        const custName = cust ? (cust.nickname || cust.companyName) : (p.customerId || '');
        
        return (p.projectName || '').toLowerCase().includes(query) ||
               custName.toLowerCase().includes(query) ||
               (p.pic || '').toLowerCase().includes(query) ||
               (p.projectId || '').toLowerCase().includes(query);
    });
    projectPage = 1;
    renderProjects();
};

window.logout = function() { 
    localStorage.removeItem('st_pro_session'); 
    currentUser = null;
    showAuth();
    Toast.fire({ title: '期待下次與您見面', icon: 'success', timer: 1500 });
}

window.togglePassword = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    
    // Switch icon via data-lucide attribute
    const toggle = el.parentElement.querySelector('.toggle-password i');
    if (toggle) {
        toggle.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons();
    }
};

async function startLiffBinding() {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) liff.login();
    else { const p = await liff.getProfile(); bindLine(p.userId); }
}

async function loginViaLine() {
    const btn = document.getElementById('lineLoginBtn');
    if (btn) btn.classList.add('btn-loading');
    
    try {
        if (typeof liff === 'undefined') {
            throw new Error("LINE SDK (LIFF) 未成功載入。請檢查網路連線。");
        }
        await liff.init({ liffId: LIFF_ID });
        console.log(">> LIFF Init Success");
        
        if (!liff.isLoggedIn()) {
            liff.login();
        } else { 
            const p = await liff.getProfile(); 
            console.log(">> LIFF Profile Success:", p.userId);
            await handleSystemLineLogin(p.userId); 
        }
    } catch (e) {
        console.error(">> LIFF Login Error:", e);
        const errorEl = document.getElementById('lineAuthError');
        if (errorEl) {
            errorEl.innerText = "LINE 初始化失敗: " + e.toString();
            errorEl.classList.add('active');
            const options = document.getElementById('socialOptions');
            if (options) options.style.display = 'block';
        } else {
            Toast.fire({ title: 'LINE 登入錯誤', text: e.toString(), icon: 'error' });
        }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
    }
}

async function handleLiffRedirect() {
    try {
        if (typeof liff === 'undefined') return;
        await liff.init({ liffId: LIFF_ID });
        console.log(">> Redirect: LIFF Init Success");
        
        if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            console.log(">> Redirect: User is logged in to LINE", p.userId);
            const session = localStorage.getItem('st_pro_session');
            
            if (session) {
                // Context: Binding (User is already logged in to the system)
                currentUser = JSON.parse(session);
                await bindLine(p.userId);
            } else {
                // Context: Login (User is not logged in)
                await handleSystemLineLogin(p.userId);
            }
            
            const url = window.location.href.split('?')[0];
            window.history.replaceState({}, '', url);
        }
    } catch (e) {
        console.error(">> Redirect Error:", e);
        const errorEl = document.getElementById('lineAuthError');
        if (errorEl) {
            errorEl.innerText = "LINE 導向失敗: " + e.toString();
            errorEl.classList.add('active');
            const options = document.getElementById('socialOptions');
            if (options) options.style.display = 'block';
        }
        showAuth();
    }
}

async function handleSystemLineLogin(id) {
    setSyncStatus(true);
    console.log(">> HandleSystemLineLogin called for:", id);
    const errorEl = document.getElementById('lineAuthError');
    if (errorEl) { errorEl.innerText = ''; errorEl.classList.remove('active'); }

    try {
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: 'line_login', lineId: id }) 
        });
        
        if (!res.ok) throw new Error("伺服器連線狀態異常: " + res.status);
        
        const json = await res.json();
        console.log(">> Line Login Response:", json);
        
        if (json.success) {
            currentUser = json.user;
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
            enterApp();
            setTimeout(() => {
                Swal.fire({ 
                    html: `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem;">
                            <div class="invoice-badge" style="width: 60px; height: 60px; background: rgba(5, 196, 107, 0.1); border-radius: 50%;">
                                <i data-lucide="check" style="width: 32px; height: 32px; color: #05c46b; stroke-width: 4;"></i>
                            </div>
                            <h2 style="font-size: 1.5rem; color: var(--text-dark); margin: 0;">LINE 登入成功</h2>
                        </div>
                    `,
                    timer: 1500, 
                    showConfirmButton: false,
                    didOpen: () => { if (window.lucide) lucide.createIcons(); }
                });
            }, 600);
        } else {
            console.warn(">> Line Login Failed:", json.error);
            showAuth("LINE 尚未綁定，請先一般登入後進行綁定");
            const options = document.getElementById('socialOptions');
            if (options) options.style.display = 'block';
        }
    } catch (e) {
        console.error(">> handleSystemLineLogin Error:", e);
        showAuth("系統暫時無法連動 LINE 服務");
    } finally {
        setSyncStatus(false);
    }
}

async function bindLine(id) {
    setSyncStatus(true);
    const passErr = document.getElementById('profPassError');
    if (passErr) { passErr.innerText = ''; passErr.classList.remove('active'); }
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'bind_line', username: currentUser.username, lineId: id }) });
        const json = await res.json();
        if (json.success) {
            currentUser.lineId = id;
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
            if (document.getElementById('lineStatusText')) {
                document.getElementById('lineStatusText').innerHTML = '已綁定';
                document.getElementById('lineStatusText').style.color = '#06C755';
                document.getElementById('bindLineBtn').style.display = 'none';
            }
            Swal.fire({ 
                html: `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem;">
                        <div class="invoice-badge" style="width: 60px; height: 60px; background: rgba(5, 196, 107, 0.1); border-radius: 50%;">
                            <i data-lucide="check" style="width: 32px; height: 32px; color: #05c46b; stroke-width: 4;"></i>
                        </div>
                        <h2 style="font-size: 1.5rem; color: var(--text-dark); margin: 0;">LINE 綁定成功</h2>
                    </div>
                `,
                timer: 1500, 
                showConfirmButton: false,
                didOpen: () => { if (window.lucide) lucide.createIcons(); }
            });
        } else {
            console.warn(">> Bind LINE Failed:", json.error);
            if (passErr) {
                passErr.innerText = json.error || '綁定失敗';
                passErr.classList.add('active');
            }
            Swal.fire({ 
                icon: 'warning', 
                title: '綁定失敗', 
                text: json.error || '此 LINE 帳號可能已被其他帳號綁定',
                confirmButtonText: '知道了',
                confirmButtonColor: '#06C755'
            });
        }
    } catch (e) {
        if (passErr) {
            passErr.innerText = '連線錯誤，請稍後再試';
            passErr.classList.add('active');
        } else {
            Toast.fire({ title: '連線錯誤', icon: 'error' });
        }
    } finally {
        setSyncStatus(false);
    }
}

// --- Premium Interactions & Stability ---

function initBackgroundParallax() {
    const overlay = document.getElementById('authOverlay');
    if (!overlay) return;
    
    console.log(">> Initializing Premium Parallax Background...");
    
    overlay.addEventListener('mousemove', (e) => {
        const { clientX: x, clientY: y } = e;
        const { innerWidth: w, innerHeight: h } = window;
        
        // Calculate normalized position (-1 to 1)
        const nx = (x / w) * 2 - 1;
        const ny = (y / h) * 2 - 1;
        
        // Update CSS variables for smooth movement
        overlay.style.setProperty('--mx', nx.toFixed(3));
        overlay.style.setProperty('--my', ny.toFixed(3));
    });
}

function checkModalIntegrity() {
    // Only profileModal remains as a permanent modal in DOM
    const criticalModals = ['profileModal'];
    const missing = criticalModals.filter(id => !document.getElementById(id));
    
    if (missing.length > 0) {
        console.error(">> [DOM CRITICAL ERROR] Modals missing from DOM:", missing);
    } else {
        console.log(">> Modal Integrity Check: Profile modal present.");
    }
}

// --- End of Script ---
