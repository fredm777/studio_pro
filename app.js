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

// --- Performance & Sync Helpers ---
function setSyncStatus(active) {
    const bar = document.getElementById('syncProgressBar');
    const badge = document.getElementById('syncBadge');
    if (active) {
        bar.style.width = '30%';
        bar.classList.add('active');
        badge.classList.add('active');
        // Simulate progress
        setTimeout(() => { if(bar.classList.contains('active')) bar.style.width = '70%'; }, 500);
    } else {
        bar.style.width = '100%';
        setTimeout(() => {
            bar.classList.remove('active');
            badge.classList.remove('active');
            bar.style.width = '0%';
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
    const authOverlay = document.getElementById('authOverlay');
    const appEl = document.getElementById('app');
    
    if (authOverlay) {
        authOverlay.classList.remove('fade-out');
        authOverlay.style.display = 'flex';
    }
    if (appEl) appEl.classList.add('hidden');
    switchAuthStage('login');
}

window.switchAuthStage = (stage) => {
    document.querySelectorAll('.auth-stage').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    const target = document.getElementById(`${stage}Stage`);
    if (target) { target.style.display = 'block'; target.classList.add('active'); }
    
    // Clear all inline errors
    document.querySelectorAll('.auth-error-inline').forEach(err => {
        err.innerText = '';
        err.classList.remove('active');
    });
};

async function handleLoginForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    
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
        } else {
            if (loginErr) {
                loginErr.innerText = json.error || '帳號或密碼錯誤';
                loginErr.classList.add('active');
            } else {
                Toast.fire({ title: '登入失敗', text: json.error || '帳號或密碼錯誤', icon: 'error' });
            }
        }
    } catch (err) {
        console.error(">> Login Error Caught:", err);
        if (loginErr) {
            loginErr.innerText = '連線失敗，請檢查網路';
            loginErr.classList.add('active');
        } else {
            Toast.fire({ title: '連線失敗', text: '請檢查網路連線', icon: 'error' });
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
            Toast.fire({ title: '帳號建立成功', text: '請完成 E-mail 驗證', icon: 'success' });
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
                errorEl.innerText = `⚠️ 此${type === 'username' ? '帳號' : 'E-mail'}已被使用`;
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
                Toast.fire({ title: '驗證成功', icon: 'success' });
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
    document.getElementById('loginForm').onsubmit = handleLoginForm;
    document.getElementById('registerForm').onsubmit = handleRegister;
    
    // Live Validation for Registration
    const regUserInput = document.getElementById('regUser');
    const regEmailInput = document.getElementById('regEmail');
    
    if (regUserInput) regUserInput.onblur = () => checkAvailability('username', regUserInput.value);
    if (regEmailInput) regEmailInput.onblur = () => checkAvailability('email', regEmailInput.value);

    document.getElementById('verifyForm').onsubmit = handleVerify;
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('bindLineBtn').onclick = startLiffBinding;
    document.getElementById('lineLoginBtn').onclick = loginViaLine;

    const socialToggle = document.getElementById('socialToggle');
    if (socialToggle) {
        socialToggle.onclick = () => {
            const options = document.getElementById('socialOptions');
            if (options) {
                options.style.display = options.style.display === 'none' ? 'block' : 'none';
            }
        };
    }
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

    // Password Visibility Logic: Show eye icon only when there is content
    document.querySelectorAll('.password-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const toggle = wrapper.querySelector('.toggle-password');
        if (input && toggle) {
            // Initial check in case of browser auto-fill
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
    
    // Clear error
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
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
    Toast.fire({ title: '正在同步資料', icon: 'info', timer: 1000 });

    try {
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(body) 
        });
        const json = await res.json();
        if (json.success) { 
            Toast.fire({ title: '資料已安全存入', icon: 'success' }); 
            const modal = document.getElementById('modalOverlay');
            if (modal) modal.classList.remove('active');
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
            Toast.fire({ title: '驗證碼已寄出', text: '請查收您的電子郵件', icon: 'success' });
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

    // Clear error
    const memErr = document.getElementById('memberError');
    if (memErr) { memErr.innerText = ''; memErr.classList.remove('active'); }
};
window.closeMemberModal = () => document.getElementById('memberModal').classList.remove('active');

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
            Toast.fire({ title: '權限已成功更新', icon: 'success' }); 
            closeMemberModal(); 
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

async function handleProfileUpdateSubmit(e) {
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
            Toast.fire({ title: '資料已更新', icon: 'success' }); 
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

function logout() { 
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
            Toast.fire({ title: 'LINE 登入成功', icon: 'success' });
        } else {
            console.warn(">> Line Login Failed:", json.error);
            if (errorEl) {
                errorEl.innerText = "LINE 尚未綁定，請先一般登入後進行綁定";
                errorEl.classList.add('active');
                const options = document.getElementById('socialOptions');
                if (options) options.style.display = 'block';
            }
            showAuth();
        }
    } catch (e) {
        console.error(">> handleSystemLineLogin Error:", e);
        if (errorEl) {
            errorEl.innerText = "系統暫時無法連動 LINE 服務";
            errorEl.classList.add('active');
            const options = document.getElementById('socialOptions');
            if (options) options.style.display = 'block';
        }
        showAuth();
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
            Toast.fire({ title: '綁定成功', text: '您可以使用 LINE 快速登入了', icon: 'success' });
        } else {
            if (passErr) {
                passErr.innerText = json.error || '綁定失敗';
                passErr.classList.add('active');
            } else {
                Toast.fire({ title: '綁定失敗', icon: 'error' });
            }
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
