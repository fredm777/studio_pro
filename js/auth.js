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
    const settingsBtn = document.getElementById('settingsTabBtn');
    const permissionsBtn = document.getElementById('permissionsTabBtn');
    const tasksBtn = document.getElementById('tasksTabBtn');
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
        // '客戶' or unknown
        if (settingsBtn) settingsBtn.classList.add('hidden');
        if (permissionsBtn) permissionsBtn.classList.add('hidden');
        if (tasksBtn) tasksBtn.classList.add('hidden');
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

    // --- System Settings Management ---

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

