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
    
    // Safety check for Protocol
    if (window.location.protocol === 'file:') {
        Swal.fire({ title: '環境限制提醒', text: 'LIFF (LINE 登入) 不支援以本地檔案 (file://) 方式開啟。', icon: 'warning' });
    }

    // New Combined Init Flow
    const initApp = async () => {
        const hasLiffParams = window.location.search.includes('liffClientId') || window.location.search.includes('code') || window.location.search.includes('liff.state');
        if (hasLiffParams) {
            await handleLiffRedirect();
        }
        
        // If LIFF didn't log us in, or we are not in redirect flow, check general session
        if (!currentUser) {
            checkAuth();
        }
    };

    initApp();
    initResizableTable();
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
    const customersBtn = document.getElementById('customersTabBtn');
    const projectsBtn = document.getElementById('projectsTabBtn');
    const customerActions = document.getElementById('customerActions');

    if (authOverlay) authOverlay.style.display = 'none';
    if (appEl) appEl.classList.remove('hidden');
    if (displayEl) displayEl.innerText = (currentUser.nickname || currentUser.username);
    
    // Role-based UI Gating
    if (currentUser.level === '管理者') {
        if (adminBtn) adminBtn.classList.remove('hidden');
        if (customersBtn) customersBtn.classList.remove('hidden');
        if (customerActions) customerActions.style.display = 'flex';
        // Default to customers for admin
        if (customersBtn) customersBtn.click();
    } else if (currentUser.level === '操作人員') {
        if (adminBtn) adminBtn.classList.add('hidden');
        if (customersBtn) customersBtn.classList.remove('hidden');
        if (customerActions) customerActions.style.display = 'flex';
        // Default to customers for operator
        if (customersBtn) customersBtn.click();
    } else {
        // '客戶' or others
        if (adminBtn) adminBtn.classList.add('hidden');
        if (customersBtn) customersBtn.classList.add('hidden');
        if (customerActions) customerActions.style.display = 'none';
        // Switch to Projects for Customers
        if (projectsBtn) projectsBtn.click();
    }
    
    // Background Load
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
            Swal.fire({ title: '登入失敗', text: json.error || '帳號或密碼錯誤', icon: 'error', confirmButtonText: '重新嘗試' });
        }
    } catch (err) {
        console.error(">> Login Error Caught:", err);
        Swal.fire({ title: '連線失敗', text: '無法連接到伺服器: ' + err.toString(), icon: 'error', confirmButtonText: '知道了' });
    }
}

async function handleRegister(e) {
    e.preventDefault();
    registeredUsername = document.getElementById('regUser').value;
    const password = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    // Nickname defaults to username during registration
    const nickname = registeredUsername; 
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
            Swal.fire({ 
                title: '歡迎加入 Studio Pro', 
                text: '帳號建立成功！即將前往驗證畫面以開通權限。', 
                icon: 'success', 
                confirmButtonText: '前往驗證', 
                confirmButtonColor: '#06C755' 
            }).then(() => {
                switchAuthStage('verify');
            });
        } else { 
            Swal.fire({ title: '註冊失敗', text: '伺服器回報：' + json.error, icon: 'error' }); 
        }
    } catch (err) { 
        console.error(">> Register Error Caught:", err);
        Swal.fire({ title: '連線錯誤', text: '無法連動註冊服務，請檢查網路狀態。', icon: 'error' }); 
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
            Swal.fire({ title: '驗證成功！', text: '您的帳號已順利開通，歡迎登入。', icon: 'success', confirmButtonText: '前往登入' }).then(() => {
                switchAuthStage('login');
            });
        } else {
            Swal.fire({ title: '驗證失敗', text: json.error || '驗證碼無效', icon: 'error' });
        }
    } catch (err) { 
        console.error(">> Verify Error:", err);
        Swal.fire({ title: '連線錯誤', text: err.message, icon: 'error' });
    }
}

function initEventListeners() {
    document.getElementById('loginForm').onsubmit = handleLoginForm;
    document.getElementById('registerForm').onsubmit = handleRegister;
    document.getElementById('verifyForm').onsubmit = handleVerify;
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('bindLineBtn').onclick = startLiffBinding;
    document.getElementById('lineLoginBtn').onclick = loginViaLine;
    document.getElementById('addCustomerBtn').onclick = () => openCustomerModal('新增客戶');
    document.getElementById('customerForm').onsubmit = (e) => { e.preventDefault(); saveCustomer(); };
    document.getElementById('userInfoTrigger').onclick = openProfileModal;
    document.getElementById('profileForm').onsubmit = handleProfileUpdateSubmit;
    document.getElementById('memberForm').onsubmit = handleMemberUpdateSubmit;
    document.getElementById('searchInput').oninput = (e) => {
        const tab = document.querySelector('.tab-link.active').dataset.tab;
        if (tab === 'customers') filterCustomers(e.target.value);
        else filterMembers(e.target.value);
    };
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
            
            // Contextual Button Toggle (Keep search visible)
            const addBtn = document.getElementById('addCustomerBtn');
            if (addBtn) addBtn.style.display = (tabId === 'customers') ? 'block' : 'none';
            
            // Clear search when switching
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            
            if (tabId === 'admin') fetchMembers();
            else renderCustomers(); // reset to full list for customers
            
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

async function fetchCustomers() {
    const loading = document.getElementById('tableLoading');
    // Only show loading if no cache
    if (loading && allCustomers.length === 0) loading.style.display = 'block';
    
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
            const hasChanged = JSON.stringify(allCustomers) !== JSON.stringify(json.data);
            if (hasChanged) {
                allCustomers = json.data; 
                setCache('customers', allCustomers);
                currentFilteredCustomers = allCustomers;
                renderCustomers(); 
            }
            if (loading) loading.style.display = 'none';
        }
    } catch (err) { 
        console.error("Fetch Error:", err);
        if (loading) loading.style.display = 'none';
    }
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
        tr.ondblclick = () => openCustomerModal('資料明細', item);
        tbody.appendChild(tr);
    });
}

function openCustomerModal(title, data = null) {
    if (currentUser.level === '客戶') return Swal.fire('提示', '客戶帳號僅供讀取，無法修改資料', 'info');
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
        let phone = data.phone || '';
        if (phone.startsWith("'")) phone = phone.slice(1);
        if (document.getElementById('phone')) document.getElementById('phone').value = phone;
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
        phone: document.getElementById('phone').value.startsWith("'") ? document.getElementById('phone').value : "'" + document.getElementById('phone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        invoiceInfo: document.getElementById('invoiceInfo').checked ? 'v' : ''
    };
    try {
        Swal.fire({ title: '儲存中...', text: '正在將資料存入資料庫', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { 
            Swal.fire({ title: '保存成功', icon: 'success', timer: 1500, showConfirmButton: false }); 
            document.getElementById('modalOverlay').classList.remove('active'); 
            fetchCustomers(); 
        } else {
            Swal.fire({ title: '操作失敗', text: json.error || '資料儲存過程發生錯誤', icon: 'error' });
        }
    } catch (e) { Swal.fire({ title: '連線失敗', text: '無法連動後端系統', icon: 'error' }); }
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
            Swal.fire({ title: '驗證碼已寄出', text: '請查看您的信箱並輸入 6 位數驗證碼。', icon: 'success' }).then(() => {
                registeredUsername = json.username;
                switchAuthStage('verify');
            });
        } else {
            Swal.fire({ title: '發送失敗', text: json.error || '找不到此 Email 帳號', icon: 'error' });
        }
    } catch (err) { Swal.fire({ title: '連線錯誤', text: err.toString(), icon: 'error' }); }
}

async function fetchMembers() {
    if (currentUser.level !== '管理者') return;
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'get_all_members', username: currentUser.username }) });
        const json = await res.json();
        if (json.success) {
            allMembers = json.data;
            renderMembers(allMembers);
        }
    } catch (e) { console.error("Fetch Members Error:", e); }
}

function renderMembers(list) {
    const tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${m.username}</td><td>${m.nickname}</td><td>${m.level}</td><td>${m.email}</td><td><button class="primary-btn" style="width:auto; padding:4px 12px;" onclick="openMemberModal(${m.rowIndex})">設定</button></td>`;
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
        if ((await res.json()).success) { 
            Swal.fire({ title: '權限已更新', icon: 'success', timer: 1500, showConfirmButton: false }); 
            closeMemberModal(); fetchMembers(); 
        }
    } catch (e) { Swal.fire({ title: '更新失敗', icon: 'error' }); }
}

function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
    document.getElementById('profUser').value = currentUser.username;
    document.getElementById('profNick').value = currentUser.nickname || '';
    document.getElementById('profEmail').value = currentUser.email || '';
    let phone = currentUser.phone || '';
    if (phone.startsWith("'")) phone = phone.slice(1);
    document.getElementById('profPhone').value = phone;
    
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
        phone: document.getElementById('profPhone').value.startsWith("'") ? document.getElementById('profPhone').value : "'" + document.getElementById('profPhone').value,
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
            Swal.fire({ title: '更新成功', text: '個人資料已妥善儲存' + (pass1 ? ' (含新密碼)' : ''), icon: 'success' }); 
            closeProfileModal(); 
        } else {
            Swal.fire({ title: '更新失敗', text: json.error || '請確認輸入資料是否正確', icon: 'error' });
        }
    } catch (e) { Swal.fire({ title: '連線失敗', text: '暫時無法連接至伺服器', icon: 'error' }); }
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

async function loginViaLine() {
    try {
        if (typeof liff === 'undefined') {
            throw new Error("LINE SDK (LIFF) 未成功載入。請檢查網路連線或 index.html 的 Script 標籤。");
        }
        await liff.init({ liffId: LIFF_ID });
        console.log(">> LIFF Init Success");
        if (!liff.isLoggedIn()) {
            liff.login();
        } else { 
            const p = await liff.getProfile(); 
            handleSystemLineLogin(p.userId); 
        }
    } catch (e) {
        console.error(">> LIFF Login Error:", e);
        Swal.fire('LINE 登入錯誤', e.toString() + (window.location.protocol === 'file:' ? "\n\n(注意: LIFF 不支援本地檔案 file://)" : ""), 'error');
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
                bindLine(p.userId);
            } else {
                // Context: Login (User is not logged in)
                handleSystemLineLogin(p.userId);
            }
            
            const url = window.location.href.split('?')[0];
            window.history.replaceState({}, '', url);
        }
    } catch (e) {
        console.error(">> Redirect Error:", e);
        // Usually happens if origin is not allowed or ID is wrong
        Swal.fire('LINE 導向初始化失敗', e.toString() + "\n\n請檢查 LINE Console 中的 Endpoint URL 是否與目前網址一致。", 'error');
    }
}

async function handleSystemLineLogin(id) {
    try {
        Swal.fire({ title: 'LINE 登入中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: 'line_login', lineId: id }) 
        });
        const json = await res.json();
        
        if (json.success) {
            currentUser = json.user;
            localStorage.setItem('st_pro_session', JSON.stringify(currentUser));
            enterApp();
            Swal.close();
        } else {
            Swal.fire({
                title: '尚未綁定 LINE',
                text: json.error,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '立即註冊',
                cancelButtonText: '返回登入',
                confirmButtonColor: '#06C755'
            }).then((result) => {
                if (result.isConfirmed) {
                    switchAuthStage('register');
                }
            });
        }
    } catch (e) {
        Swal.fire({ title: '連線錯誤', text: '系統暫時無法連動 LINE 登入服務：' + e.toString(), icon: 'error' });
    }
}

async function bindLine(id) {
    try {
        Swal.fire({ title: '綁定中...', text: '正在將您的社會帳號與系統連動', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
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
            Swal.fire({ title: '綁定成功', text: '您之後可以使用 LINE 快速登入系統了！', icon: 'success' });
        } else {
            Swal.fire({ title: '綁定失敗', text: '無法完成帳號連動，請稍後再試。', icon: 'error' });
        }
    } catch (e) {
        Swal.fire({ title: '連線錯誤', text: '綁定作業連線超時：' + e.toString(), icon: 'error' });
    }
}
