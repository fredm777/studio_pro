// ==========================================
// Configuration & State
// ==========================================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzO3QkIj-ZWXJaZyXEa5PiaM_jB-BLvEXFV6VFwa4Z1One8-VAW2k5lk-XhAk4oHmiQJQ/exec';
const LIFF_ID = '2009659478-RZ3Q85ZU';

let allCustomers = [];
let allMembers = [];
let currentUser = null;
let registeredUsername = ''; // 用於註冊後檢查驗證碼

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initEventListeners();
    initResizableColumns();

    if (window.lucide) lucide.createIcons();

    if (window.location.search.includes('liffClientId')) {
        handleLiffBindingRedirect();
    } else {
        checkAuth();
    }
});

function checkAuth() {
    const session = localStorage.getItem('studio_pro_session');
    if (session) {
        currentUser = JSON.parse(session);
        enterApp();
    } else {
        showAuth();
    }
}

function enterApp() {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('displayUser').innerText = `${currentUser.nickname} (${currentUser.level})`;

    const lineBtn = document.getElementById('bindLineBtn');
    const lineStatus = document.getElementById('lineStatus');
    if (currentUser.lineId) {
        lineBtn.classList.add('hidden');
        lineStatus.innerText = '已綁定 LINE';
    } else {
        lineBtn.classList.remove('hidden');
        lineStatus.innerText = '尚未綁定 LINE';
    }

    if (currentUser.level === '管理員') {
        document.getElementById('adminTabBtn').classList.remove('hidden');
    }
    fetchCustomers();
    if (window.lucide) lucide.createIcons();
}

function showAuth() {
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    switchAuthStage('login');
}

function switchAuthStage(stage) {
    document.querySelectorAll('.auth-stage').forEach(s => s.style.display = 'none');
    const target = document.getElementById(`${stage}Stage`);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
}

// ==========================================
// Auth Helpers
// ==========================================
window.togglePassword = function (inputId) {
    const input = document.getElementById(inputId);
    const iconContainer = input.nextElementSibling;
    const icon = iconContainer.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
};

function initEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLoginForm);
    document.getElementById('registerForm').addEventListener('submit', handleRegisterForm);
    document.getElementById('verifyForm').addEventListener('submit', handleVerifyForm);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('bindLineBtn').addEventListener('click', startLiffBinding);
    document.getElementById('userInfoTrigger').addEventListener('click', openProfileModal);
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdateSubmit);

    document.getElementById('closeModal').addEventListener('click', () => document.getElementById('modalOverlay').classList.remove('active'));
    document.getElementById('addCustomerBtn').addEventListener('click', () => openCustomerModal('新增客戶資料'));
    document.getElementById('customerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCustomer();
    });
    document.getElementById('memberForm').addEventListener('submit', handleMemberUpdateSubmit);
    document.getElementById('searchInput').addEventListener('input', (e) => filterCustomers(e.target.value));
}

// ==========================================
// Auth Flow
// ==========================================
async function handleLoginForm(e) {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    Swal.fire({ title: '登入中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username, password })
        });
        const json = await res.json();
        if (json.success) {
            currentUser = json.user;
            localStorage.setItem('studio_pro_session', JSON.stringify(currentUser));
            enterApp();
            Swal.close();
        } else {
            Swal.fire('登入失敗', json.error, 'error');
        }
    } catch (err) {
        Swal.fire('錯誤', '連線異常，請稍後再試', 'error');
    }
}

async function handleRegisterForm(e) {
    e.preventDefault();
    registeredUsername = document.getElementById('regUser').value;
    const password = document.getElementById('regPass').value;
    const nickname = document.getElementById('regNick').value;
    const email = document.getElementById('regEmail').value;

    Swal.fire({ title: '註冊中...', didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'register', username: registeredUsername, password, nickname, email })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire('註冊成功', '驗證碼已寄送到您的信箱', 'success');
            switchAuthStage('verify');
        } else {
            Swal.fire('註冊失敗', json.error, 'error');
        }
    } catch (err) {
        Swal.fire('錯誤', '註冊暫時無法使用', 'error');
    }
}

async function handleVerifyForm(e) {
    e.preventDefault();
    const code = document.getElementById('vCodeInput').value;
    Swal.fire({ title: '驗證中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'verify_code', username: registeredUsername, code })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire('驗證成功', '請使用您的帳號進行登入', 'success');
            switchAuthStage('login');
        } else {
            Swal.fire('驗證失敗', json.error, 'error');
        }
    } catch (err) {
        Swal.fire('錯誤', '驗證暫時無法使用', 'error');
    }
}

// ==========================================
// Profile Management
// ==========================================
function openProfileModal() {
    if (!currentUser) return;
    document.getElementById('profileModal').classList.add('active');
    document.getElementById('profUser').value = currentUser.username;
    document.getElementById('profNick').value = currentUser.nickname;
    document.getElementById('profEmail').value = currentUser.email;
    document.getElementById('profPhone').value = currentUser.phone || '';
}

window.closeProfileModal = function () {
    document.getElementById('profileModal').classList.remove('active');
};

async function handleProfileUpdateSubmit(e) {
    e.preventDefault();
    const payload = {
        action: 'update_profile',
        username: currentUser.username,
        nickname: document.getElementById('profNick').value,
        email: document.getElementById('profEmail').value,
        phone: document.getElementById('profPhone').value
    };
    Swal.fire({ title: '更新中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) {
            currentUser = json.user;
            localStorage.setItem('studio_pro_session', JSON.stringify(currentUser));
            document.getElementById('displayUser').innerText = `${currentUser.nickname} (${currentUser.level})`;
            Swal.fire('更新成功', '', 'success');
            closeProfileModal();
        } else { Swal.fire('更新失敗', json.error, 'error'); }
    } catch (err) { Swal.fire('錯誤', '網路異常', 'error'); }
}

// ==========================================
// Customer Data Management
// ==========================================
async function fetchCustomers() {
    const loading = document.getElementById('tableLoading');
    loading.style.display = 'block';
    loading.innerText = '讀取中...';
    try {
        const res = await fetch(`${GAS_WEB_APP_URL}?action=get_customers`);
        const json = await res.json();
        if (json.success) {
            allCustomers = json.data;
            renderCustomers(allCustomers);
        }
    } catch (err) {
        loading.innerHTML = '<span style="color:red;">載入失敗，請檢查網路</span>';
    }
}

function renderCustomers(data) {
    const tbody = document.getElementById('customerTableBody');
    tbody.innerHTML = '';
    document.getElementById('tableLoading').style.display = 'none';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.companyName || ''}</td>
            <td>${item.taxId || ''}</td>
            <td>${item.contact || ''}</td>
            <td>${item.nickname || ''}</td>
            <td>${item.phone || ''}</td>
            <td>${item.email || ''}</td>
            <td>${item.address || ''}</td>
            <td>${item.invoiceInfo || ''}</td>
        `;
        tr.addEventListener('dblclick', () => openCustomerModal('編輯客戶資料', item));
        tbody.appendChild(tr);
    });
}

function openCustomerModal(title, data = null) {
    if (currentUser.level === '訪客') {
        Swal.fire('權限不足', '訪客僅供檢視', 'warning');
        return;
    }
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('customerForm').reset();
    document.getElementById('rowIndex').value = '';
    if (data) {
        document.getElementById('rowIndex').value = data.rowIndex;
        document.getElementById('companyName').value = data.companyName || '';
        document.getElementById('taxId').value = data.taxId || '';
        document.getElementById('contact').value = data.contact || '';
        document.getElementById('email').value = data.email || '';
    }
}

async function saveCustomer() {
    const rowIndex = document.getElementById('rowIndex').value;
    const payload = {
        action: rowIndex ? 'update_customer' : 'add_customer',
        rowIndex: rowIndex ? parseInt(rowIndex) : null,
        companyName: document.getElementById('companyName').value,
        taxId: document.getElementById('taxId').value,
        contact: document.getElementById('contact').value,
        email: document.getElementById('email').value,
        nickname: "", phone: "", address: "", invoiceInfo: "" // 補齊欄位避免後端錯誤
    };
    Swal.fire({ title: '儲存中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) {
            Swal.fire('儲存成功', '', 'success');
            document.getElementById('modalOverlay').classList.remove('active');
            fetchCustomers();
        }
    } catch (err) { Swal.fire('錯誤', '儲存失敗', 'error'); }
}

// ==========================================
// Admin: Member Management
// ==========================================
async function fetchMembers() {
    if (currentUser.level !== '管理員') return;
    const tbody = document.getElementById('memberTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">載入中...</td></tr>';
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_all_members', username: currentUser.username })
        });
        const json = await res.json();
        if (json.success) {
            allMembers = json.data;
            renderMembers(allMembers);
        }
    } catch (err) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">無法載入會員資料</td></tr>'; }
}

function renderMembers(data) {
    const tbody = document.getElementById('memberTableBody');
    tbody.innerHTML = '';
    data.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.username}</td>
            <td>${m.nickname}</td>
            <td><strong>${m.level}</strong></td>
            <td>${m.email}</td>
            <td><span class="badge ${m.status}">${m.status}</span></td>
            <td><button class="primary-btn" style="padding:4px 8px; font-size:0.8rem;" onclick="openMemberEditModal(${m.rowIndex})">修改</button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.openMemberEditModal = function (rowIndex) {
    const member = allMembers.find(m => m.rowIndex === rowIndex);
    if (!member) return;
    document.getElementById('memberModal').classList.add('active');
    document.getElementById('memberTargetRow').value = rowIndex;
    document.getElementById('memberUser').value = member.username;
    document.getElementById('memberLevel').value = member.level;
    document.getElementById('memberStatus').value = member.status;
};

window.closeMemberModal = function () {
    document.getElementById('memberModal').classList.remove('active');
};

async function handleMemberUpdateSubmit(e) {
    e.preventDefault();
    const payload = {
        action: 'update_member_status',
        adminUser: currentUser.username,
        targetRowIndex: parseInt(document.getElementById('memberTargetRow').value),
        level: document.getElementById('memberLevel').value,
        status: document.getElementById('memberStatus').value
    };
    Swal.fire({ title: '更新中...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) {
            Swal.fire('更新成功', '', 'success');
            closeMemberModal();
            fetchMembers();
        }
    } catch (err) { Swal.fire('錯誤', '更動失敗', 'error'); }
}

// ==========================================
// LINE Binding Logic
// ==========================================
async function startLiffBinding() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            const profile = await liff.getProfile();
            bindLine(profile.userId);
        }
    } catch (err) { Swal.fire('錯誤', 'LIFF 初始化失敗', 'error'); }
}

async function handleLiffBindingRedirect() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            const session = localStorage.getItem('studio_pro_session');
            if (!session) return;
            currentUser = JSON.parse(session);
            bindLine(profile.userId);
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
    } catch (err) { console.error(err); }
}

async function bindLine(lineId) {
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'bind_line', username: currentUser.username, lineId })
        });
        const json = await res.json();
        if (json.success) {
            currentUser.lineId = lineId;
            localStorage.setItem('studio_pro_session', JSON.stringify(currentUser));
            enterApp();
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// General Helpers
// ==========================================
function logout() {
    localStorage.removeItem('studio_pro_session');
    location.reload();
}

function initTabs() {
    document.querySelectorAll('.tab-link').forEach(t => {
        t.onclick = () => {
            document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(t.dataset.tab).classList.add('active');
            if (target === 'admin') fetchMembers();
        };
    });
}

function filterCustomers(query) {
    const q = query.toLowerCase();
    const filtered = allCustomers.filter(c =>
        (c.companyName || '').toLowerCase().includes(q) ||
        (c.taxId || '').toLowerCase().includes(q) ||
        (c.contact || '').toLowerCase().includes(q)
    );
    renderCustomers(filtered);
}

function initResizableColumns() { }
