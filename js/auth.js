// Auth and Profile Logic v2.0.2
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
    
    if (authOverlay) authOverlay.classList.add('fade-out');
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

    if (authOverlay) authOverlay.style.display = 'none';
    if (appEl) appEl.classList.remove('hidden');
    if (!window.currentUser) {
        showAuth();
        return;
    }
    
    if (displayEl) displayEl.innerText = (window.currentUser.nickname || window.currentUser.username || "使用者");
    
    const userLevel = (window.currentUser.level || '').trim();

    if (userLevel === '管理者' || userLevel === '管理員') {
        if (settingsBtn) settingsBtn.classList.remove('hidden');
        if (permissionsBtn) permissionsBtn.classList.remove('hidden');
        if (tasksBtn) tasksBtn.classList.remove('hidden');
        if (customersBtn) {
            customersBtn.classList.remove('hidden');
            customersBtn.click();
        }
        if (customerActions) customerActions.style.display = 'flex';
    } else if (userLevel === '操作人員') {
        if (settingsBtn) settingsBtn.classList.add('hidden');
        if (permissionsBtn) permissionsBtn.classList.add('hidden');
        if (tasksBtn) tasksBtn.classList.remove('hidden');
        if (customersBtn) {
            customersBtn.classList.remove('hidden');
            customersBtn.click();
        }
        if (customerActions) customerActions.style.display = 'flex';
    } else {
        if (settingsBtn) settingsBtn.classList.add('hidden');
        if (permissionsBtn) permissionsBtn.classList.add('hidden');
        if (tasksBtn) tasksBtn.classList.add('hidden');
        if (customersBtn) {
            customersBtn.classList.remove('hidden');
            customersBtn.click();
        }
        if (customerActions) customerActions.style.display = 'none';
    }
    
    if (typeof fetchCustomers === 'function') fetchCustomers();
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
        if (lineErr) {
            lineErr.innerText = initialErrorMsg;
            lineErr.classList.add('active');
        }
    }
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    const btn = e.target ? e.target.querySelector('button[type="submit"]') : null;
    const username = document.getElementById('loginUser').value || '';
    const password = document.getElementById('loginPass').value || '';
    
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
            window.currentUser = json.user;
            localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
            enterApp();
            Swal.fire({ icon: 'success', title: '登入成功', text: `歡迎回來, ${window.currentUser.nickname || window.currentUser.username}`, timer: 1500, showConfirmButton: false });
        } else {
            if (loginErr) {
                loginErr.innerText = json.error || '帳號或密碼錯誤';
                loginErr.classList.add('active');
            } else {
                Swal.fire({ icon: 'error', title: '登入失敗', text: json.error || '帳號或密碼錯誤' });
            }
        }
    } catch (err) {
        console.error("Login Error:", err);
        if (loginErr) { loginErr.innerText = '網路連線失敗'; loginErr.classList.add('active'); }
    } finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

window.startLiffBinding = async function() {
    if (!window.currentUser) return;
    setSyncStatus(true);
    try {
        await liff.init({ liffId: LINE_LIFF_ID });
        // Store current user to restore after redirect
        localStorage.setItem('st_pro_binding_user', JSON.stringify(window.currentUser));
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: window.location.origin + window.location.pathname });
        } else {
            await handleLiffBinding();
        }
    } catch (e) {
        console.error("LIFF Binding Error:", e);
        Swal.fire('錯誤', '無法啟動 LINE 綁定模組', 'error');
    } finally { setSyncStatus(false); }
}

window.handleLiffRedirect = async function() {
    setSyncStatus(true);
    try {
        await liff.init({ liffId: LINE_LIFF_ID });
        if (liff.isLoggedIn()) {
            const bindingUser = localStorage.getItem('st_pro_binding_user');
            if (bindingUser) {
                localStorage.removeItem('st_pro_binding_user');
                window.currentUser = JSON.parse(bindingUser);
                await handleLiffBinding();
            } else {
                await handleLiffLogin();
            }
        }
    } catch (e) {
        console.error("LIFF Redirect Error:", e);
    } finally { setSyncStatus(false); }
}

async function handleLiffLogin() {
    const profile = await liff.getProfile();
    const lineId = profile.userId;
    
    const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'line_login', lineId })
    });
    const json = await res.json();
    if (json.success) {
        window.currentUser = json.user;
        localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
        enterApp();
        Swal.fire({ icon: 'success', title: 'LINE 登入成功', timer: 1500 });
    } else {
        showAuth(json.error || '此 LINE 帳號尚未綁定任何系統帳號');
    }
}

async function handleLiffBinding() {
    const profile = await liff.getProfile();
    const lineId = profile.userId;
    
    const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'bind_line', username: window.currentUser.username, lineId })
    });
    const json = await res.json();
    if (json.success) {
        window.currentUser = json.user;
        localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser));
        enterApp();
        window.openProfileModal();
        Swal.fire({ icon: 'success', title: 'LINE 綁定成功', timer: 1500 });
    } else {
        Swal.fire('綁定失敗', json.error || '此 LINE 帳號已被其他使用者綁定', 'error');
    }
}

// --- Profile & Modal Logic ---

window.openProfileModal = function() {
    window.closeAllModals();
    if (!window.currentUser) return;
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('active');
    
    // Toggle Admin section
    const adminSec = document.getElementById('profAdminSection');
    const userLevel = (window.currentUser.level || '').trim();
    if (adminSec) {
        adminSec.style.display = (userLevel === '管理者' || userLevel === '管理員') ? 'block' : 'none';
    }

    if (document.getElementById('profUser')) document.getElementById('profUser').value = window.currentUser.username;
    if (document.getElementById('profNick')) document.getElementById('profNick').value = window.currentUser.nickname || '';
    if (document.getElementById('profEmail')) document.getElementById('profEmail').value = window.currentUser.email || '';
    let phone = String(window.currentUser.phone || '');
    if (phone.startsWith("'")) phone = phone.slice(1);
    document.getElementById('profPhone').value = phone;
    
    const p1 = document.getElementById('profPass1');
    const p2 = document.getElementById('profPass2');
    if (p1) { p1.value = ''; p1.type = 'password'; }
    if (p2) p2.value = '';
    
    const passErr = document.getElementById('profPassError');
    if (passErr) { passErr.innerText = ''; passErr.classList.remove('active'); }
    
    // Status Logic
    updateBindingUI('line', window.currentUser.lineId);
    updateBindingUI('google', window.currentUser.googleId);
    
    if (window.lucide) lucide.createIcons();
}

function updateBindingUI(type, id) {
    const bindBtn = document.getElementById(`bind${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
    const statusText = document.getElementById(`${type}StatusText`);
    if (!statusText || !bindBtn) return;

    if (id) {
        statusText.innerHTML = `<i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> 已綁定`;
        statusText.style.color = type === 'line' ? '#06C755' : '#4285F4';
        bindBtn.style.display = 'none';
    } else {
        statusText.innerHTML = `<i data-lucide="x-circle" style="width:14px;height:14px;"></i> 尚未綁定`;
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
    const passErr = document.getElementById('profPassError');
    if (passErr) { passErr.innerText = ''; passErr.classList.remove('active'); }
    if (pass1 && pass1 !== pass2) {
        if (passErr) { passErr.innerText = '兩次密碼不一致'; passErr.classList.add('active'); }
        return;
    }
    const body = { 
        action: 'update_profile', username: window.currentUser.username, 
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
            window.currentUser = json.user; 
            localStorage.setItem('st_pro_session', JSON.stringify(window.currentUser)); 
            const displayEl = document.getElementById('displayUser');
            if (displayEl) displayEl.innerText = window.currentUser.nickname || window.currentUser.username;
            Swal.fire({ icon: 'success', title: '資料已更新', timer: 1500, showConfirmButton: false });
            window.closeAllModals(); 
        } else if (passErr) { passErr.innerText = json.error || '更新失敗'; passErr.classList.add('active'); }
    } catch (e) { if (passErr) { passErr.innerText = '連線失敗'; passErr.classList.add('active'); } }
    finally { if (btn) btn.classList.remove('btn-loading'); setSyncStatus(false); }
}

window.logout = function() { 
    console.log(">> User Logging Out...");
    localStorage.removeItem('st_pro_session'); 
    window.currentUser = null; 
    
    // Hard UI reset
    window.closeAllModals();
    showAuth();
    
    // Clear display info
    const displayEl = document.getElementById('displayUser');
    if (displayEl) displayEl.innerText = "使用者";
    
    Toast.fire({ title: '期待下次與您見面', icon: 'success', timer: 1500 });
}

window.togglePassword = (id) => {
    const el = document.getElementById(id); if (!el) return;
    const isPass = el.type === 'password'; el.type = isPass ? 'text' : 'password';
    const toggle = el.parentElement.querySelector('.toggle-password i');
    if (toggle) {
        toggle.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons();
    }
};

async function loginViaGoogle() {
    console.log(">> loginViaGoogle Triggered");
    Swal.fire({
        title: 'Google 登入',
        text: 'Google 登入功能正在串接中，請先使用帳號密碼登入或使用 LINE 登入。',
        icon: 'info',
        confirmButtonText: '了解',
        confirmButtonColor: 'var(--primary)',
        customClass: {
            popup: 'swal2-popup',
            title: 'swal2-title'
        }
    });
}

window.loginViaGoogle = loginViaGoogle;

window.bindGoogle = async function() {
    Swal.fire({
        title: 'Google 帳號綁定',
        text: '即將引導您完成 Google 帳號授權，以利未來同步雲端試算表。',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '開始綁定',
        cancelButtonText: '稍後再說'
    }).then((result) => {
        if (result.isConfirmed) {
            Toast.fire({ icon: 'info', title: '功能開發中，敬請期待' });
        }
    });
}
