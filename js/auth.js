// Auth and Profile Logic v2.0.3
// ==========================================

function checkAuth() {
    const session = localStorage.getItem('st_pro_session');
    if (session) {
        try { window.currentUser = JSON.parse(session); enterApp(); } catch (e) { showAuth(); }
    } else { showAuth(); }
}

function enterApp() {
    const authOverlay = document.getElementById('authOverlay');
    const appEl = document.getElementById('app');
    if (authOverlay) {
        authOverlay.classList.add('fade-out');
        setTimeout(() => authOverlay.style.display = 'none', 500);
    }
    if (appEl) {
        appEl.classList.remove('hidden');
        appEl.classList.add('fade-in');
    }
    const displayEl = document.getElementById('displayUser');
    const settingsBtn = document.getElementById('settingsTabBtn');
    const permissionsBtn = document.getElementById('permissionsTabBtn');
    const tasksBtn = document.getElementById('tasksTabBtn');
    const customersBtn = document.getElementById('customersTabBtn');
    const projectsBtn = document.getElementById('projectsTabBtn');
    const customerActions = document.getElementById('customerActions');

    if (!window.currentUser) { showAuth(); return; }

    window.hasPermission = function(key) {
        if (!window.currentUser) return false;
        
        // --- Admin Always Has All Permissions ---
        const lvl = (window.currentUser.level || '').trim();
        const isAdmin = (lvl === '管理者' || lvl === '管理員');
        if (isAdmin) return true;

        // --- Compatibility Mode for existing sessions or standard logic ---
        if (!window.currentUser.permissions) {
            const isOp = (lvl === '操作人員');
            const isClient = (lvl === '客戶');

            if (isOp) {
                if (key === 'perm_m') return false;
                if (key === 'set_u') return false;
                if (key.endsWith('_d')) return false; // Default: Operators cannot delete
                return true; 
            }
            if (isClient) {
                return (key === 'proj_v' || key === 'cust_v');
            }
            return false;
        }
        
        return window.currentUser.permissions[key] === true;
    };

    window.applyPermissionState = function(el, key) {
        if (!el) return;
        const hasPerm = window.hasPermission(key);
        if (hasPerm) {
            el.classList.remove('permission-locked');
            if (el.tagName === 'BUTTON') el.disabled = false;
        } else {
            el.classList.add('permission-locked');
            if (el.tagName === 'BUTTON') el.disabled = true;
        }
    };

    // Dynamic Tab & Action Visibility based on permissions (Now using LOCK instead of HIDE)
    window.applyPermissionState(customersBtn, 'cust_v');
    window.applyPermissionState(projectsBtn, 'proj_v');
    window.applyPermissionState(tasksBtn, 'task_v');
    window.applyPermissionState(permissionsBtn, 'perm_m');

    // Default tab click logic (only if the tab is NOT locked)
    if (customersBtn && !customersBtn.classList.contains('permission-locked') && !document.querySelector('.tab-link.active')) {
        customersBtn.click();
    }

    // Global Action Buttons (Add Customer, etc.)
    applyPermissionState(document.getElementById('addCustomerBtn'), 'cust_c');
    applyPermissionState(document.getElementById('addProjectBtn'), 'proj_c');
    applyPermissionState(document.getElementById('addTaskBtn'), 'task_c');

    // Settings Save Button
    const settingsForm = document.querySelector('form[onsubmit="handleGlobalSettingsSubmit(event)"]');
    if (settingsForm) {
        const saveBtn = settingsForm.querySelector('button[type="submit"]');
        applyPermissionState(saveBtn, 'set_u');
    }

    if (typeof fetchCustomers === 'function') fetchCustomers();
    if (window.lucide) lucide.createIcons();
}

window.switchAuthStage = (stage, clearErrors = true) => {
    document.querySelectorAll('.auth-stage').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    const target = document.getElementById(`${stage}Stage`);
    if (target) { target.style.display = 'block'; target.classList.add('active'); }

    if (clearErrors) {
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
    switchAuthStage('login', !initialErrorMsg);
    if (initialErrorMsg) {
        const lineErr = document.getElementById('lineAuthError');
        if (lineErr) { lineErr.innerText = initialErrorMsg; lineErr.classList.add('active'); }
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    const btn = e.target ? e.target.querySelector('button[type="submit"]') : null;
    const username = (document.getElementById('loginUser').value || '').trim();
    const password = (document.getElementById('loginPass').value || '').trim();

    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    const loginErr = document.getElementById('loginMainError');
    if (loginErr) { loginErr.innerText = ''; loginErr.classList.remove('active'); }

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'login', username, password })
        });
        const json = await res.json();
        if (json.success) {
            window.currentUser = json.user;
            localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
            enterApp();
            Swal.fire({ icon: 'success', title: '登入成功', text: `歡迎回來，${window.currentUser.nickname || window.currentUser.username}`, timer: 1500, showConfirmButton: false });
        } else if (loginErr) {
            loginErr.innerText = json.error || '帳號或密碼錯誤';
            loginErr.classList.add('active');
        }
    } catch (err) {
        if (loginErr) { loginErr.innerText = '網路連線失敗'; loginErr.classList.add('active'); }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

window.handleRegister = async function (e) {
    if (e) e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const username = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value.trim();
    const errEl = document.getElementById('registerMainError');
    if (errEl) { errEl.innerText = ''; errEl.classList.remove('active'); }

    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'register', username, email, password })
        });
        const json = await res.json();
        if (json.success) {
            window.registeredUsername = username;
            window.verifyContext = 'register';
            switchAuthStage('verify');
            Toast.fire({ icon: 'info', title: '請檢查電子郵件中的驗證碼' });
        } else if (errEl) {
            errEl.innerText = json.error || '註冊失敗';
            errEl.classList.add('active');
        }
    } catch (e) { if (errEl) { errEl.innerText = '連線失敗'; errEl.classList.add('active'); } }
    finally { if (btn) btn.classList.remove('btn-loading'); setSyncStatus(false); }
}

window.handleForgotSubmit = async function (e) {
    if (e) e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById('forgotEmail').value.trim();
    const errEl = document.getElementById('forgotError');
    if (errEl) { errEl.innerText = ''; errEl.classList.remove('active'); }

    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'forgot_password', email })
        });
        const json = await res.json();
        if (json.success) {
            window.registeredUsername = json.username;
            window.verifyContext = 'forgot';
            switchAuthStage('verify');
            Toast.fire({ icon: 'info', title: '重設代碼已發送至您的信箱' });
        } else if (errEl) {
            errEl.innerText = json.error || '發送失敗';
            errEl.classList.add('active');
        }
    } catch (e) { if (errEl) { errEl.innerText = '連線失敗'; errEl.classList.add('active'); } }
    finally { if (btn) btn.classList.remove('btn-loading'); setSyncStatus(false); }
}

window.handleVerify = async function (e) {
    if (e) e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const code = document.getElementById('vCodeInput').value.trim();
    const errEl = document.getElementById('verifyError');
    if (errEl) { errEl.innerText = ''; errEl.classList.remove('active'); }

    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    try {
        const body = { action: 'verify', username: window.registeredUsername, code, context: window.verifyContext };
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (json.success) {
            if (window.verifyContext === 'register') {
                Swal.fire({ icon: 'success', title: '驗證成功', text: '帳號已啟用，請由管理員審核級別後即可使用。', confirmButtonText: '確定' }).then(() => switchAuthStage('login'));
            } else {
                Swal.fire({ icon: 'success', title: '密碼重設成功', text: `您的新密碼為: ${json.tempPassword}\n請登入後立即修改密碼。`, confirmButtonText: '確定' }).then(() => switchAuthStage('login'));
            }
        } else if (errEl) {
            errEl.innerText = json.error || '驗證碼錯誤';
            errEl.classList.add('active');
        }
    } catch (e) { if (errEl) { errEl.innerText = '連線失敗'; errEl.classList.add('active'); } }
    finally { if (btn) btn.classList.remove('btn-loading'); setSyncStatus(false); }
}

window.checkAvailability = async function (type, val) {
    if (!val) return;
    const errEl = document.getElementById(type === 'username' ? 'regUserError' : 'regEmailError');
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'check_availability', type, val })
        });
        const json = await res.json();
        if (!json.success && errEl) {
            errEl.innerText = json.error;
            errEl.classList.add('active');
        } else if (errEl) {
            errEl.innerText = '';
            errEl.classList.remove('active');
        }
    } catch (e) { }
}

window.startLiffBinding = async function () {
    if (!window.currentUser) return;
    setSyncStatus(true);
    try {
        await liff.init({ liffId: LIFF_ID });
        localStorage.setItem('st_pro_binding_user', JSON.stringify(window.currentUser));
        if (!liff.isLoggedIn()) liff.login({ redirectUri: window.location.origin + window.location.pathname });
        else await handleLiffBinding();
    } catch (e) { Swal.fire('錯誤', '無法啟動 LINE 綁定模組', 'error'); }
    finally { setSyncStatus(false); }
}

window.handleLiffRedirect = async function () {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const bindingUser = localStorage.getItem('st_pro_binding_user');
            if (bindingUser) {
                localStorage.removeItem('st_pro_binding_user');
                window.currentUser = JSON.parse(bindingUser);
                await handleLiffBinding();
            } else await handleLiffLogin();
        }
    } catch (e) { console.error("LIFF Redirect Error:", e); }
}

async function handleLiffLogin() {
    const profile = await liff.getProfile();
    const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'line_login', lineId: profile.userId })
    });
    const json = await res.json();
    if (json.success) {
        window.currentUser = json.user;
        localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
        enterApp();
    } else showAuth(json.error);
}

async function handleLiffBinding() {
    const profile = await liff.getProfile();
    const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'bind_line', username: window.currentUser.username, lineId: profile.userId })
    });
    const json = await res.json();
    if (json.success) {
        window.currentUser = json.user;
        localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
        enterApp();
        window.openProfileModal();
        Swal.fire({ icon: 'success', title: 'LINE 綁定成功', timer: 1500 });
    } else Swal.fire('失敗', json.error, 'error');
}

window.openProfileModal = function () {
    window.closeAllModals();
    if (!window.currentUser) return;
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('active');

    // Apply Permissions to Shortcut Cards
    window.applyPermissionState(document.getElementById('cardBankSettings'), 'set_v');
    window.applyPermissionState(document.getElementById('cardNoteSettings'), 'set_v');
    window.applyPermissionState(document.getElementById('cardUserAdmin'), 'perm_m');
    window.applyPermissionState(document.getElementById('cardPermAdmin'), 'perm_m');

    if (document.getElementById('profUser')) document.getElementById('profUser').value = window.currentUser.username;
    if (document.getElementById('profNick')) document.getElementById('profNick').value = window.currentUser.nickname || '';
    if (document.getElementById('profEmail')) document.getElementById('profEmail').value = window.currentUser.email || '';
    let phone = String(window.currentUser.phone || '');
    if (phone.startsWith("'")) phone = phone.slice(1);
    if (document.getElementById('profPhone')) document.getElementById('profPhone').value = phone;

    const p1 = document.getElementById('profPass1');
    const p2 = document.getElementById('profPass2');
    if (p1) { p1.value = ''; p1.type = 'password'; }
    if (p2) p2.value = '';

    const passErr = document.getElementById('profPassError');
    if (passErr) { passErr.innerText = ''; passErr.classList.remove('active'); }

    updateBindingUI('line', window.currentUser.lineId);
    updateBindingUI('google', window.currentUser.googleId);
    if (window.lucide) lucide.createIcons();
}

function updateBindingUI(type, id) {
    const bindBtn = document.getElementById(`bind${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
    const statusText = document.getElementById(`${type}StatusText`);
    if (!statusText || !bindBtn) return;

    if (id) {
        statusText.innerHTML = `<i data-lucide="circle-check" style="width:14px; margin-right:4px; color: #6A798F;"></i> 已綁定`;
        bindBtn.innerText = '解除綁定';
        bindBtn.className = 'bind-btn-grey';
        bindBtn.onclick = () => window.unbindSocialAccount(type);
    } else {
        statusText.innerHTML = `<i data-lucide="circle-x" style="width:14px; margin-right:4px; color: #C0C6CF;"></i> 尚未綁定`;
        bindBtn.innerText = '綁定帳號';
        bindBtn.className = 'bind-btn-blue';
        bindBtn.onclick = () => window.bindSocialAccount(type);
    }

    // Refresh icons for new HTML
    if (window.lucide) lucide.createIcons();
}

window.handleProfileUpdateSubmit = async function (e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const pass1 = document.getElementById('profPass1').value;
    const pass2 = document.getElementById('profPass2').value;
    const passErr = document.getElementById('profPassError');
    if (pass1 && pass1 !== pass2) {
        if (passErr) { passErr.innerText = '兩次密碼不一致'; passErr.classList.add('active'); }
        return;
    }
    const body = {
        action: 'update_profile', username: window.currentUser.username,
        nickname: document.getElementById('profNick').value, email: document.getElementById('profEmail').value,
        phone: document.getElementById('profPhone').value.startsWith("'") ? document.getElementById('profPhone').value : "'" + document.getElementById('profPhone').value,
        newPassword: pass1 || null
    };
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) {
            window.currentUser = json.user; localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
            const displayEl = document.getElementById('displayUser');
            if (displayEl) displayEl.innerText = window.currentUser.nickname || window.currentUser.username;
            Swal.fire({ icon: 'success', title: '資料已更新', timer: 1500, showConfirmButton: false });
            window.closeModal('profileModal');
        } else if (passErr) { passErr.innerText = json.error || '更新失敗'; passErr.classList.add('active'); }
    } catch (e) { if (passErr) { passErr.innerText = '連線失敗'; passErr.classList.add('active'); } }
    finally { if (btn) btn.classList.remove('btn-loading'); setSyncStatus(false); }
}

window.logout = function () {
    localStorage.removeItem('st_pro_session');
    window.currentUser = null;
    window.closeAllModals();
    showAuth();
    const d = document.getElementById('displayUser');
    if (d) d.innerText = "使用者";
    Toast.fire({ title: '期待下次與您見面', icon: 'success', timer: 1500 });
}

window.togglePassword = (id) => {
    const el = document.getElementById(id); if (!el) return;
    const isPass = el.type === 'password'; 
    el.type = isPass ? 'text' : 'password';
    const img = el.parentElement.querySelector('.toggle-password img');
    if (img) {
        img.src = isPass ? 'assets/icons/eye.svg' : 'assets/icons/eye off.svg';
    }
};

window.bindSocialAccount = function (type) {
    window.closeModal('profileModal');
    if (type === 'line') window.startLiffBinding();
    else if (type === 'google') window.bindGoogle();
};

window.unbindSocialAccount = async function (type) {
    const result = await Swal.fire({
        title: '確定解除綁定？',
        text: `解除後將無法使用 ${type.toUpperCase()} 快速登入。`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '確定解除',
        cancelButtonText: '取消',
        confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
        setSyncStatus(true);
        try {
            const res = await fetch(GAS_WEB_APP_URL, {
                method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'unbind_social', username: window.currentUser.username, type })
            });
            const json = await res.json();
            if (json.success) {
                window.currentUser = json.user;
                localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
                window.openProfileModal();
                Swal.fire({ icon: 'success', title: '已解除綁定', timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire('失敗', json.error, 'error');
            }
        } catch (e) {
            Swal.fire('錯誤', '連線失敗', 'error');
        } finally {
            setSyncStatus(false);
        }
    }
};

window.loginViaGoogle = async function () {
    Swal.fire({ icon: 'info', title: 'Google 登入開發中', confirmButtonColor: 'var(--primary)' });
}

window.bindGoogle = async function () {
    Swal.fire({ icon: 'info', title: 'Google 綁定開發中', showCancelButton: true });
}
