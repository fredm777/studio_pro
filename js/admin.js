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
            if (document.getElementById('setBankName')) document.getElementById('setBankName').value = s.bank_name || '';
            if (document.getElementById('setBankBranch')) document.getElementById('setBankBranch').value = s.bank_branch || '';
            if (document.getElementById('setAccountName')) document.getElementById('setAccountName').value = s.account_name || '';
            if (document.getElementById('setAccountNum')) document.getElementById('setAccountNum').value = s.account_num || '';
            
            if (document.getElementById('setWfOrder')) document.getElementById('setWfOrder').value = s.wf_order || '';
            if (document.getElementById('setWfDeposit')) document.getElementById('setWfDeposit').value = s.wf_deposit || '';
            if (document.getElementById('setWfDraft')) document.getElementById('setWfDraft').value = s.wf_draft || '';
            if (document.getElementById('setWfEdit')) document.getElementById('setWfEdit').value = s.wf_edit || '';
            if (document.getElementById('setWfDelivery')) document.getElementById('setWfDelivery').value = s.wf_delivery || '';
        }
    } catch(e) { console.error("Fetch Settings Error:", e); }
    finally { setSyncStatus(false); }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    setSyncStatus(true);
    
    const settings = {
        bank_name: document.getElementById('setBankName').value,
        bank_branch: document.getElementById('setBankBranch').value,
        account_name: document.getElementById('setAccountName').value,
        account_num: document.getElementById('setAccountNum').value,
        
        wf_order: document.getElementById('setWfOrder').value,
        wf_deposit: document.getElementById('setWfDeposit').value,
        wf_draft: document.getElementById('setWfDraft').value,
        wf_edit: document.getElementById('setWfEdit').value,
        wf_delivery: document.getElementById('setWfDelivery').value
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

async function fetchMembers() {
    if (!window.currentUser || (window.currentUser.level || '').trim() !== '管理者') {
        console.warn(">> fetchMembers blocked: insufficient permissions or no user");
        return;
    }
    try {
        setSyncStatus(true);
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: 'get_all_members', username: window.currentUser.username }) 
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
        tr.style.cursor = 'pointer';
        tr.ondblclick = () => showMemberEditor(m.rowIndex);
        tr.innerHTML = `<td>${m.username}</td><td>${m.nickname || ''}</td><td><span class="status-badge" style="background:#f1f5f9; color:var(--text-dark); border:1px solid var(--border);">${m.level || '未知'}</span></td><td>${m.email || ''}</td>`;
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

    if (!window.currentUser) return;
    const m = allMembers.find(x => x.rowIndex == idx);
    if (!m) return console.error("Member not found for row index:", idx);
    
    switchSubView('permissions', 'edit');

    document.getElementById('memberTargetRow').value = idx;
    document.getElementById('memberUser').value = m.username || '';
    document.getElementById('memberLevel').value = m.level || '客戶';
    document.getElementById('memberStatus').value = m.status || '啟用';

    // Clear error
    const memErr = document.getElementById('memberError');
    if (memErr) { memErr.innerText = ''; memErr.classList.remove('active'); }
    
    if (window.lucide) lucide.createIcons();
};

async function handleMemberUpdateSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const body = { action: 'update_member_status', adminUser: window.currentUser.username, targetRowIndex: parseInt(document.getElementById('memberTargetRow').value), level: document.getElementById('memberLevel').value, status: document.getElementById('memberStatus').value };
    
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
            switchSubView('permissions', 'list'); 
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

