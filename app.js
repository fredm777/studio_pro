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

document.addEventListener('DOMContentLoaded', () => {
    console.log(">> System Init: v1.9 Release Starting...");
    try { initEventListeners(); } catch(e) { console.error("Event Init Error:", e); }
    try { initTabs(); } catch(e) { console.error("Tab Init Error:", e); }
    if (window.lucide) { lucide.createIcons(); }
    if (window.location.search.includes('liffClientId')) { handleLiffBindingRedirect(); } else { checkAuth(); }
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
    const displayEl = document.getElementById('displayUser');
    const adminBtn = document.getElementById('adminTabBtn');

    if (authOverlay) authOverlay.style.display = 'none';
    if (appEl) appEl.classList.remove('hidden');
    if (displayEl) displayEl.innerText = (currentUser.nickname || currentUser.username);
    if (adminBtn && currentUser.level === '管理員') adminBtn.classList.remove('hidden');
    
    fetchCustomers();
}

function showAuth() {
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
    switchAuthStage('login');
}

window.switchAuthStage = (stage) => {
    document.querySelectorAll('.auth-stage').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    const target = document.getElementById(`${stage}Stage`);
    if (target) { target.style.display = 'block'; target.classList.add('active'); }
};

async function handleLoginForm(e) {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    
    Swal.fire({
        title: '登入中...',
        text: '正在與伺服器建立安全連線',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'login', username, password })
        });
        
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const text = await res.text();
        const json = JSON.parse(text);
        
        if (json.success) {
            Swal.close();
            currentUser = json.user;
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
            enterApp();
        } else {
            Swal.fire('登入失敗', json.error || '帳號或密碼錯誤', 'error');
        }
    } catch (err) {
        console.error(">> Login Error Caught:", err);
        Swal.fire('連線失敗', '無法連接到伺服器: ' + err.toString(), 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    registeredUsername = document.getElementById('regUser').value;
    const password = document.getElementById('regPass').value;
    const nickname = document.getElementById('regNick').value;
    const email = document.getElementById('regEmail').value;
    console.log(">> handleRegister called", { username: registeredUsername, email });
    
    try {
        console.log(">> Fetching register...");
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'register', username: registeredUsername, password, nickname, email })
        });
        
        console.log(">> Fetch completed with status:", res.status);
        const text = await res.text();
        console.log(">> Raw Response Payload:", text);
        const json = JSON.parse(text);
        
        if (json.success) {
            alert('註冊成功！若您尚未驗證，即將前往驗證畫面（或直接登入）。');
            switchAuthStage('verify');
        } else { 
            alert('註冊失敗: ' + json.error); 
        }
    } catch (err) { 
        console.error(">> Register Error Caught:", err);
        alert('註冊連線錯誤: ' + err.toString()); 
    }
}

async function handleVerify(e) {
    e.preventDefault();
    const code = document.getElementById('vCodeInput').value;
    
    Swal.fire({
        title: '驗證中...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'verify_code', username: registeredUsername, code })
        });
        const text = await res.text();
        const json = JSON.parse(text);
        
        if (json.success) {
            Swal.fire('驗證成功！', '您的帳號已開通，請登入。', 'success').then(() => {
                switchAuthStage('login');
            });
        } else {
            Swal.fire('驗證失敗', json.error || '驗證碼無效', 'error');
        }
    } catch (err) { 
        console.error(">> Verify Error:", err);
        Swal.fire('連線錯誤', err.message, 'error');
    }
}

function initEventListeners() {
    document.getElementById('loginForm').onsubmit = handleLoginForm;
    document.getElementById('registerForm').onsubmit = handleRegister;
    document.getElementById('verifyForm').onsubmit = handleVerify;
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('bindLineBtn').onclick = startLiffBinding;
    document.getElementById('addCustomerBtn').onclick = () => openCustomerModal('新增客戶');
    document.getElementById('customerForm').onsubmit = (e) => { e.preventDefault(); saveCustomer(); };
    document.getElementById('userInfoTrigger').onclick = openProfileModal;
    document.getElementById('profileForm').onsubmit = handleProfileUpdateSubmit;
    document.getElementById('memberForm').onsubmit = handleMemberUpdateSubmit;
    document.getElementById('searchInput').oninput = (e) => filterCustomers(e.target.value);
    document.getElementById('closeModal').onclick = () => document.getElementById('modalOverlay').classList.remove('active');
    
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.onsubmit = handleForgotSubmit;

    const itemsInput = document.getElementById('itemsPerPageInput');
    if (itemsInput) {
        itemsInput.value = itemsPerPage;
        itemsInput.oninput = (e) => {
            itemsPerPage = parseInt(e.target.value) || 20;
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

    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.onclick = () => changePage(-1);
    
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.onclick = () => changePage(1);
    
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
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
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
            document.getElementById(tabId).classList.add('active');
            if (tabId === 'admin') fetchMembers();
        };
    });
}

async function fetchCustomers() {
    const loading = document.getElementById('tableLoading');
    if (loading) loading.style.display = 'block';
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_customers' })
        });
        const text = await res.text();
        const json = JSON.parse(text);
        if (json.success) { 
            allCustomers = json.data; 
            currentFilteredCustomers = allCustomers;
            currentPage = 1;
            renderCustomers(); 
        }
    } catch (err) { console.error(err); }
}

window.changePage = (dir) => {
    currentPage += dir;
    renderCustomers();
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
        // Correct Column Order: Company, TaxId, Nickname, Contact, Phone, Email, Address, Invoice
        tr.innerHTML = `<td>${item.companyName || ''}</td><td>${item.taxId || ''}</td><td>${item.nickname || ''}</td><td>${item.contact || ''}</td><td>${item.phone || ''}</td><td>${item.email || ''}</td><td>${item.address || ''}</td><td>${item.invoiceInfo || ''}</td>`;
        tr.ondblclick = () => openCustomerModal('編輯', item);
        tbody.appendChild(tr);
    });
}

function openCustomerModal(title, data = null) {
    if (currentUser.level === '訪客') return Swal.fire('提示', '訪客無法編輯', 'info');
    const titleEl = document.getElementById('modalTitle');
    const overlay = document.getElementById('modalOverlay');
    const form = document.getElementById('customerForm');
    
    if (titleEl) titleEl.innerText = title;
    if (overlay) overlay.classList.add('active');
    if (form) form.reset();
    
    const rowIdxEl = document.getElementById('rowIndex');
    if (rowIdxEl) rowIdxEl.value = data ? data.rowIndex : '';
    
    if (data) {
        if (document.getElementById('companyName')) document.getElementById('companyName').value = data.companyName || '';
        if (document.getElementById('taxId')) document.getElementById('taxId').value = data.taxId || '';
        if (document.getElementById('nickname')) document.getElementById('nickname').value = data.nickname || '';
        if (document.getElementById('contact')) document.getElementById('contact').value = data.contact || '';
        if (document.getElementById('phone')) document.getElementById('phone').value = data.phone || '';
        if (document.getElementById('email')) document.getElementById('email').value = data.email || '';
        if (document.getElementById('address')) document.getElementById('address').value = data.address || '';
        if (document.getElementById('invoiceInfo')) document.getElementById('invoiceInfo').checked = (data.invoiceInfo === 'v' || data.invoiceInfo === 'V');
    }
}

async function saveCustomer() {
    const rIndex = document.getElementById('rowIndex').value;
    const body = {
        action: rIndex ? 'update_customer' : 'add_customer',
        rowIndex: rIndex ? parseInt(rIndex) : null,
        companyName: document.getElementById('companyName').value,
        taxId: document.getElementById('taxId').value,
        nickname: document.getElementById('nickname').value,
        contact: document.getElementById('contact').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        invoiceInfo: document.getElementById('invoiceInfo').checked ? 'v' : ''
    };
    try {
        Swal.fire({ title: '儲存中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { 
            Swal.fire('完成', '', 'success'); 
            document.getElementById('modalOverlay').classList.remove('active'); 
            fetchCustomers(); 
        } else {
            Swal.fire('錯誤', json.error || '儲存失敗', 'error');
        }
    } catch (e) { Swal.fire('錯誤', '連線失敗', 'error'); }
}

async function handleForgotSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    Swal.fire({ title: '處理中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'forgot_password', email })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire('驗證碼已寄出', '請查看信箱並輸入新驗證碼', 'success').then(() => {
                registeredUsername = json.username;
                switchAuthStage('verify');
            });
        } else {
            Swal.fire('失敗', json.error || '找不到此 Email', 'error');
        }
    } catch (err) { Swal.fire('錯誤', err.toString(), 'error'); }
}

async function fetchMembers() {
    const tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'get_all_members', username: currentUser.username }) });
        const json = await res.json();
        if (json.success) {
            allMembers = json.data;
            tbody.innerHTML = '';
            allMembers.forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${m.username}</td><td>${m.nickname}</td><td>${m.level}</td><td>${m.email}</td><td><button class="primary-btn" style="width:auto; padding:4px 12px;" onclick="openMemberModal(${m.rowIndex})">設定</button></td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error(e); }
}

window.openMemberModal = (idx) => {
    const m = allMembers.find(x => x.rowIndex === idx);
    document.getElementById('memberModal').classList.add('active');
    document.getElementById('memberTargetRow').value = idx;
    document.getElementById('memberUser').value = m.username;
    document.getElementById('memberLevel').value = m.level;
    document.getElementById('memberStatus').value = m.status;
};
window.closeMemberModal = () => document.getElementById('memberModal').classList.remove('active');

async function handleMemberUpdateSubmit(e) {
    e.preventDefault();
    const body = { action: 'update_member_status', adminUser: currentUser.username, targetRowIndex: parseInt(document.getElementById('memberTargetRow').value), level: document.getElementById('memberLevel').value, status: document.getElementById('memberStatus').value };
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        if ((await res.json()).success) { Swal.fire('完成', '', 'success'); closeMemberModal(); fetchMembers(); }
    } catch (e) { Swal.fire('失敗', '', 'error'); }
}

function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
    document.getElementById('profUser').value = currentUser.username;
    document.getElementById('profNick').value = currentUser.nickname || '';
    document.getElementById('profEmail').value = currentUser.email || '';
    document.getElementById('profPhone').value = currentUser.phone || '';
    
    // Reset password fields
    const p1 = document.getElementById('profPass1');
    const p2 = document.getElementById('profPass2');
    if (p1) { p1.value = ''; p1.type = 'password'; }
    if (p2) p2.value = '';
    
    const bindBtn = document.getElementById('bindLineBtn');
    const statusText = document.getElementById('lineStatusText');
    
    if (currentUser.lineId) {
        statusText.innerHTML = '已綁定';
        statusText.style.color = '#06C755';
        bindBtn.style.display = 'none';
    } else {
        statusText.innerHTML = '⚠️ 尚未綁定';
        statusText.style.color = 'var(--text-muted)';
        bindBtn.style.display = 'block';
    }
}
window.closeProfileModal = () => document.getElementById('profileModal').classList.remove('active');

async function handleProfileUpdateSubmit(e) {
    e.preventDefault();
    const pass1 = document.getElementById('profPass1').value;
    const pass2 = document.getElementById('profPass2').value;
    
    if (pass1 && pass1 !== pass2) {
        return Swal.fire('錯誤', '兩次輸入的新密碼不一致', 'error');
    }

    const body = { 
        action: 'update_profile', 
        username: currentUser.username, 
        nickname: document.getElementById('profNick').value, 
        email: document.getElementById('profEmail').value, 
        phone: document.getElementById('profPhone').value,
        newPassword: pass1 || null
    };

    try {
        Swal.fire({ title: '更新中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { 
            currentUser = json.user; 
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser)); 
            const displayEl = document.getElementById('displayUser');
            if (displayEl) displayEl.innerText = currentUser.nickname || currentUser.username;
            Swal.fire('完成', '個人資料已更新' + (pass1 ? '（包含密碼）' : ''), 'success'); 
            closeProfileModal(); 
        } else {
            Swal.fire('失敗', json.error || '更新失敗', 'error');
        }
    } catch (e) { Swal.fire('失敗', '連線錯誤', 'error'); }
}

function filterCustomers(val) {
    const query = String(val).toLowerCase();
    currentFilteredCustomers = allCustomers.filter(c => 
        String(c.companyName || '').toLowerCase().includes(query) || 
        String(c.taxId || '').includes(query) || 
        String(c.nickname || '').toLowerCase().includes(query) ||
        String(c.contact || '').toLowerCase().includes(query) ||
        String(c.phone || '').includes(query)
    );
    currentPage = 1;
    renderCustomers();
}

function logout() { localStorage.removeItem('st_pro_session'); location.reload(); }

window.togglePassword = (id) => {
    const el = document.getElementById(id);
    const icon = el.nextElementSibling.querySelector('i');
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    icon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
    lucide.createIcons();
};

async function startLiffBinding() {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) liff.login();
    else { const p = await liff.getProfile(); bindLine(p.userId); }
}

async function handleLiffBindingRedirect() {
    await liff.init({ liffId: LIFF_ID });
    if (liff.isLoggedIn()) {
        const p = await liff.getProfile();
        currentUser = JSON.parse(localStorage.getItem('st_pro_session'));
        bindLine(p.userId);
        const url = window.location.href.split('?')[0];
        window.history.replaceState({}, '', url);
    }
}

async function bindLine(id) {
    try {
        Swal.fire({ title: '綁定中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'bind_line', username: currentUser.username, lineId: id }) });
        const json = await res.json();
        if (json.success) {
            currentUser.lineId = id;
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
            document.getElementById('lineStatusText').innerHTML = '已綁定';
            document.getElementById('lineStatusText').style.color = '#06C755';
            document.getElementById('bindLineBtn').style.display = 'none';
            Swal.fire('綁定成功', '您之後可以使用 LINE 快速登入！', 'success');
        } else {
            Swal.fire('綁定失敗', '無法完成綁定，請稍後再試。', 'error');
        }
    } catch (e) {
        Swal.fire('連線錯誤', e.toString(), 'error');
    }
}
