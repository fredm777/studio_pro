window.switchAdminSubTab = function(target) {
    console.log(">> Switching Admin Sub-Tab to:", target);
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#admin .sub-nav .tab-link').forEach(l => l.classList.remove('active'));
    
    if (target === 'members') {
        const listEl = document.getElementById('adminListView');
        const tabEl = document.getElementById('adminMembersTab');
        if (listEl) listEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');
        fetchMembers();
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
        if (json.success && json.settings) {
            const s = json.settings;
            if (s.bank_info) {
                try {
                    const b = JSON.parse(s.bank_info);
                    if (document.getElementById('setBankName')) document.getElementById('setBankName').value = b.bankName || '';
                    if (document.getElementById('setAccountName')) document.getElementById('setAccountName').value = b.accountName || '';
                    if (document.getElementById('setAccountNum')) document.getElementById('setAccountNum').value = b.accountNumber || '';
                } catch(e) { console.warn("Bank Info Parse Error:", e); }
            }
            if (s.standard_terms && document.getElementById('setTerms')) {
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

window.allProjects = [];
window.currentFilteredProjects = [];
window.projectPage = 1;
window.projectItemsPerPage = parseInt(localStorage.getItem('st_pro_project_items_per_page')) || 20;

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

