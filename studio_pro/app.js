// Studio Pro Dashboard Logic v1.9 (RELEASE)
// ==========================================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwX9xG_snc8EmBttBBOW3M8bNOUxZojeXjfag22pGgGnb5EcfgphhJ3klR8JPv8cAObFQ/exec';
const LIFF_ID = '2009659478-RZ3Q85ZU'; 

let allCustomers = [];
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
    const session = localStorage.getItem('studio_pro_session');
    if (session) {
        try { currentUser = JSON.parse(session); enterApp(); } catch (e) { showAuth(); }
    } else { showAuth(); }
}

function enterApp() {
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('displayUser').innerText = currentUser.nickname || currentUser.username;
    if (currentUser.lineId) {
        document.getElementById('bindLineBtn').classList.add('hidden');
        document.getElementById('lineStatus').innerText = '✅ LINE';
    }
    if (currentUser.level === '管理員') document.getElementById('adminTabBtn').classList.remove('hidden');
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
    Swal.fire({ title: '登入中...', didOpen: () => Swal.showLoading() });
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'login', username, password })
        });
        
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const json = await res.json();
        
        if (json.success) {
            currentUser = json.user;
            localStorage.setItem('studio_pro_session', JSON.stringify(currentUser));
            enterApp();
            Swal.close();
        } else {
            Swal.fire('失敗', json.error || '帳號密碼錯誤', 'error');
        }
    } catch (err) {
        Swal.fire('連線失敗', '系統目前正在初始化後端權限，請確認您已在 GAS 執行過 initSheets。', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    registeredUsername = document.getElementById('regUser').value;
    const password = document.getElementById('regPass').value;
    const nickname = document.getElementById('regNick').value;
    const email = document.getElementById('regEmail').value;
    Swal.fire({ title: '註冊中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'register', username: registeredUsername, password, nickname, email })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire('成功', '若您尚未驗證，請輸入預設 6 位數代碼', 'success');
            switchAuthStage('verify');
        } else { Swal.fire('失敗', json.error, 'error'); }
    } catch (err) { Swal.fire('錯誤', '無法連線至系統', 'error'); }
}

async function handleVerify(e) {
    e.preventDefault();
    const code = document.getElementById('vCodeInput').value;
    Swal.fire({ title: '驗證中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'verify_code', username: registeredUsername, code })
        });
        const json = await res.json();
        if (json.success) { Swal.fire('驗證成功', '請重新登入', 'success'); switchAuthStage('login'); }
        else { Swal.fire('錯誤', json.error || '驗證碼錯誤', 'error'); }
    } catch (err) { Swal.fire('失敗', '驗證連線失敗', 'error'); }
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
        const res = await fetch(`${GAS_WEB_APP_URL}?action=get_customers`);
        const json = await res.json();
        if (json.success) { allCustomers = json.data; renderCustomers(allCustomers); }
    } catch (err) { console.error(err); }
}

function renderCustomers(data) {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const loading = document.getElementById('tableLoading');
    if (loading) loading.style.display = 'none';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.companyName}</td><td>${item.taxId}</td><td>${item.contact}</td><td>${item.nickname}</td><td>${item.phone}</td><td>${item.email}</td><td>${item.address}</td><td>${item.invoiceInfo}</td>`;
        tr.ondblclick = () => openCustomerModal('編輯', item);
        tbody.appendChild(tr);
    });
}

function openCustomerModal(title, data = null) {
    if (currentUser.level === '訪客') return Swal.fire('提示', '訪客無法編輯', 'info');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('customerForm').reset();
    document.getElementById('rowIndex').value = data ? data.rowIndex : '';
    if (data) {
        document.getElementById('companyName').value = data.companyName;
        document.getElementById('taxId').value = data.taxId;
        document.getElementById('contact').value = data.contact;
        document.getElementById('email').value = data.email;
    }
}

async function saveCustomer() {
    const rIndex = document.getElementById('rowIndex').value;
    const body = {
        action: rIndex ? 'update_customer' : 'add_customer',
        rowIndex: rIndex ? parseInt(rIndex) : null,
        companyName: document.getElementById('companyName').value,
        taxId: document.getElementById('taxId').value,
        contact: document.getElementById('contact').value,
        email: document.getElementById('email').value
    };
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        if ((await res.json()).success) { Swal.fire('完成', '', 'success'); document.getElementById('modalOverlay').classList.remove('active'); fetchCustomers(); }
    } catch (e) { Swal.fire('錯誤', '儲存失敗', 'error'); }
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
    document.getElementById('profNick').value = currentUser.nickname;
    document.getElementById('profEmail').value = currentUser.email;
}
window.closeProfileModal = () => document.getElementById('profileModal').classList.remove('active');

async function handleProfileUpdateSubmit(e) {
    e.preventDefault();
    const body = { action: 'update_profile', username: currentUser.username, nickname: document.getElementById('profNick').value, email: document.getElementById('profEmail').value, phone: document.getElementById('profPhone').value };
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { currentUser = json.user; localStorage.setItem('studio_pro_session', JSON.stringify(currentUser)); document.getElementById('displayUser').innerText = currentUser.nickname; Swal.fire('完成', '', 'success'); closeProfileModal(); }
    } catch (e) { Swal.fire('失敗', '', 'error'); }
}

function filterCustomers(val) {
    const filtered = allCustomers.filter(c => c.companyName.includes(val) || c.taxId.includes(val) || (c.nickname && c.nickname.includes(val)));
    renderCustomers(filtered);
}

function logout() { localStorage.removeItem('studio_pro_session'); location.reload(); }

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
        currentUser = JSON.parse(localStorage.getItem('studio_pro_session'));
        bindLine(p.userId);
        const url = window.location.href.split('?')[0];
        window.history.replaceState({}, '', url);
    }
}

async function bindLine(id) {
    await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'bind_line', username: currentUser.username, lineId: id }) });
    currentUser.lineId = id;
    localStorage.setItem('studio_pro_session', JSON.stringify(currentUser));
    location.reload();
}
