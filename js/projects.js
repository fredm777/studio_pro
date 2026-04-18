// Project Management & Quotation Editor
// ==========================================

window.currentFilteredProjects = [];
window.projectPage = 1;
window.projectItemsPerPage = parseInt(localStorage.getItem('st_pro_project_items_per_page')) || 20;

// --- Sorting State --- (Deprecated but kept for compat)
window.projectSortField = 'date';
window.projectSortOrder = 'desc';

window.fetchProjects = async function() {
    // 1. Load from cache first for instant UI
    const cached = getCache('projects');
    if (cached) {
        window.allProjects = cached;
        window.currentFilteredProjects = [...window.allProjects];
        window.renderProjects();
    }

    setSyncStatus(true);
    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'block';

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_projects' })
        });
        const json = await res.json();
        if (json.success) {
            window.allProjects = json.projects || [];
            setCache('projects', window.allProjects);
            window.currentFilteredProjects = [...window.allProjects];
            window.renderProjects();
            if (typeof updateTaskProjectFilter === 'function') updateTaskProjectFilter();
        }
    } catch (err) { console.error("Fetch Projects Error:", err); }
    finally {
        setSyncStatus(false);
        if (loading) loading.style.display = 'none';
    }
}

window.renderProjects = function() {
    const tbody = document.getElementById('projectTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'none';

    if (!window.currentFilteredProjects || window.currentFilteredProjects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem;">尚未建立專案，點擊下方按鈕開始</td></tr>`;
        const pag = document.getElementById('projectPaginationContainer');
        if (pag) pag.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(window.currentFilteredProjects.length / window.projectItemsPerPage);
    if (window.projectPage > totalPages) window.projectPage = totalPages || 1;
    
    const start = (window.projectPage - 1) * window.projectItemsPerPage;
    const end = start + window.projectItemsPerPage;
    const pagedEntries = window.currentFilteredProjects.slice(start, end);

    const pag = document.getElementById('projectPaginationContainer');
    if (pag) pag.style.display = (window.currentFilteredProjects.length > 0) ? 'flex' : 'none';
    const info = document.getElementById('projPageInfo');
    if (info) info.innerText = `第 ${window.projectPage} / ${totalPages || 1} 頁 (共 ${window.currentFilteredProjects.length} 筆)`;

    pagedEntries.forEach(proj => {
        const cust = window.allCustomers ? window.allCustomers.find(c => c.customerId === proj.customerId) : null;
        const custDisp = cust ? (cust.nickname || cust.companyName) : proj.customerId;
        const dateStr = proj.date || '';
        const totalDisp = proj.total ? Number(proj.total).toLocaleString() : '0';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${custDisp}</td>
            <td>${dateStr}</td>
            <td>${proj.projectName || ''}</td>
            <td>${proj.pic || ''}</td>
            <td style="font-weight:700; color:var(--primary);">$${totalDisp}</td>
        `;
        tr.ondblclick = () => showQuotationEditor('編輯報價單', proj);
        tbody.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

window.showQuotationEditor = function(title, data = null) {
    if (typeof switchSubView === 'function') switchSubView('projects', 'edit');
    const form = document.getElementById('quotationForm');
    if (form) form.reset();
    if (document.getElementById('quotationTitle')) document.getElementById('quotationTitle').innerText = title;
    if (document.getElementById('quotationItemsBody')) document.getElementById('quotationItemsBody').innerHTML = '';
    
    // Clear suggests
    const suggest = document.getElementById('autocompleteSuggestions');
    if (suggest) suggest.style.display = 'none';

    if (data) {
        // Edit Mode
        if (document.getElementById('projRowIndex')) document.getElementById('projRowIndex').value = data.rowIndex || '';
        if (document.getElementById('projId')) document.getElementById('projId').value = data.projectId || '';
        if (document.getElementById('qProjName')) document.getElementById('qProjName').value = data.projectName || '';
        if (document.getElementById('qPic')) document.getElementById('qPic').value = data.pic || '';
        if (document.getElementById('qDate')) document.getElementById('qDate').value = data.date || '';
        
        if (document.getElementById('qWfDraft')) document.getElementById('qWfDraft').value = data.days || '';
        if (document.getElementById('qWfEdit')) document.getElementById('qWfEdit').value = data.revCount || '';
        if (document.getElementById('qWfOrder')) document.getElementById('qWfOrder').value = data.wfOrder || '';
        if (document.getElementById('qWfDeposit')) document.getElementById('qWfDeposit').value = data.wfDeposit || '';
        if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = data.wfDelivery || '';
        if (document.getElementById('qBankData')) document.getElementById('qBankData').value = data.bankData || '';
        
        const isCompleted = data.isCompleted === true || String(data.isCompleted).toLowerCase() === 'true';
        if (document.getElementById('projIsCompleted')) document.getElementById('projIsCompleted').value = isCompleted;
        if (typeof updateProjectCompletedUI === 'function') updateProjectCompletedUI(isCompleted);
        
        if (typeof selectCustomerById === 'function') selectCustomerById(data.customerId);
        
        if (window.currentUser) {
            if (window.currentUser.phone && document.getElementById('qStudioPhone')) document.getElementById('qStudioPhone').innerText = window.currentUser.phone;
            if (window.currentUser.email && document.getElementById('qStudioEmail')) document.getElementById('qStudioEmail').innerText = window.currentUser.email;
        }
        
        fetchProjectItems(data.projectId);
    } else {
        // New Mode
        if (document.getElementById('projRowIndex')) document.getElementById('projRowIndex').value = '';
        if (document.getElementById('projId')) document.getElementById('projId').value = generateProjectId();
        if (document.getElementById('projIsCompleted')) document.getElementById('projIsCompleted').value = 'false';
        if (typeof updateProjectCompletedUI === 'function') updateProjectCompletedUI(false);
        if (document.getElementById('qPic')) document.getElementById('qPic').value = window.currentUser ? (window.currentUser.nickname || window.currentUser.username) : '';
        if (document.getElementById('qDate')) document.getElementById('qDate').value = new Date().toISOString().split('T')[0];
        
        if (window.currentUser) {
            if (window.currentUser.nickname && document.getElementById('qPic')) document.getElementById('qPic').value = window.currentUser.nickname;
            if (window.currentUser.phone && document.getElementById('qStudioPhone')) document.getElementById('qStudioPhone').innerText = window.currentUser.phone;
            if (window.currentUser.email && document.getElementById('qStudioEmail')) document.getElementById('qStudioEmail').innerText = window.currentUser.email;
        }
        
        addQuotationRow(); 
        loadSettingsPreview(); 
    }
}

window.updateProjectCompletedUI = function(isCompleted) {
    const badge = document.getElementById('quoteCompletedBadge');
    const text = document.getElementById('quoteCompletedText');
    if (!badge || !text) return;
    
    if (isCompleted) {
        badge.style.background = '#06C755';
        badge.style.borderColor = '#06C755';
        text.innerText = '已完結';
        text.style.color = '#06C755';
        text.style.fontWeight = '600';
    } else {
        badge.style.background = 'transparent';
        badge.style.borderColor = 'var(--border)';
        text.innerText = '未完結';
        text.style.color = 'var(--text-main)';
        text.style.fontWeight = 'normal';
    }
}

window.toggleProjectCompleted = function() {
    const el = document.getElementById('projIsCompleted');
    if (!el) return;
    const isCompleted = el.value === 'true';
    el.value = (!isCompleted).toString();
    updateProjectCompletedUI(!isCompleted);
}

window.handleAddProjectTask = function() {
    const projId = document.getElementById('projId').value;
    const rowIndex = document.getElementById('projRowIndex').value;
    
    if (!rowIndex) {
        Swal.fire({
            title: '需先儲存報價單',
            text: '系統將為您自動儲存，並導向任務清單新增任務。',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: '確定',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                window._redirectAfterSaveToTasks = true;
                handleQuotationSubmit(new Event('submit'));
            }
        });
    } else {
        const tBtn = document.getElementById('tasksTabBtn');
        if (tBtn) tBtn.click();
        setTimeout(() => {
            const filter = document.getElementById('taskProjectFilter');
            if (filter) filter.value = projId;
            if (typeof filterTasksByProject === 'function') filterTasksByProject();
            if (typeof showTaskEditorPage === 'function') showTaskEditorPage();
        }, 300);
    }
}

async function fetchProjectItems(projId) {
    const proj = (window.allProjects || []).find(p => p.projectId === projId);
    const tbody = document.getElementById('quotationItemsBody');
    if (tbody) tbody.innerHTML = '';
    
    if (proj && proj.items && proj.items.length > 0) {
        proj.items.forEach(item => {
            addQuotationRow(item);
        });
    } else {
        addQuotationRow(); 
    }
}

function generateProjectId() {
    const date = new Date();
    const YYYYMMDD = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `SP-${YYYYMMDD}-${random}`;
}

async function loadSettingsPreview() {
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_settings' })
        });
        const json = await res.json();
        if (json.success) {
            const s = json.settings;
            if (document.getElementById('qBankData')) {
                const bname = s.bank_name ? s.bank_name : '';
                const bbranch = s.bank_branch ? s.bank_branch : '';
                const aname = s.account_name ? s.account_name : '';
                const anum = s.account_num ? s.account_num : '';
                document.getElementById('qBankData').value = `銀行：${bname} ${bbranch}\n戶名：${aname}\n帳號：${anum}`;
            }
            if (document.getElementById('qWfOrder')) document.getElementById('qWfOrder').value = s.wf_order || '';
            if (document.getElementById('qWfDeposit')) document.getElementById('qWfDeposit').value = s.wf_deposit || '';
            if (document.getElementById('qWfDraft')) document.getElementById('qWfDraft').value = s.wf_draft || '';
            if (document.getElementById('qWfEdit')) document.getElementById('qWfEdit').value = s.wf_edit || '';
            if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = s.wf_delivery || '';
        }
    } catch(e) {}
}

function addQuotationRow(data = null) {
    const tbody = document.getElementById('quotationItemsBody');
    if (!tbody) return;
    const rowIdx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${rowIdx}</td>
        <td><input class="i-name" placeholder="項目名稱" value="${data ? data.name : ''}"></td>
        <td><textarea class="i-content" placeholder="細項詳述..." rows="1" style="resize:vertical;">${data ? data.content : ''}</textarea></td>
        <td><input type="number" class="i-price text-right" value="${data ? data.price : ''}" oninput="calcQuotation()"></td>
        <td><input type="number" class="i-qty text-center" value="${data ? data.qty : 1}" oninput="calcQuotation()"></td>
        <td style="position:relative;">
            <input type="number" class="i-total text-right fw-bold" readonly tabindex="-1" value="${data ? data.subtotal : 0}">
            <div class="remove-btn-dense" onclick="this.closest('tr').remove(); calcQuotation();" style="position:absolute; right:-25px; top:50%; transform:translateY(-50%); font-size:18px;" title="移除此列">&times;</div>
        </td>
    `;
    tbody.appendChild(tr);
    calcQuotation();
}

function calcQuotation() {
    let subtotal = 0;
    const rows = document.querySelectorAll('#quotationItemsBody tr');
    rows.forEach((row, idx) => {
        row.cells[0].innerText = idx + 1; 
        const priceField = row.querySelector('.i-price');
        const qtyField = row.querySelector('.i-qty');
        const price = priceField ? parseFloat(priceField.value) || 0 : 0;
        const qty = qtyField ? parseFloat(qtyField.value) || 0 : 0;
        const total = price * qty;
        const totalField = row.querySelector('.i-total');
        if (totalField) totalField.value = total;
        subtotal += total;
    });
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    if (document.getElementById('qSubtotal')) document.getElementById('qSubtotal').innerText = subtotal.toLocaleString();
    if (document.getElementById('qTax')) document.getElementById('qTax').innerText = tax.toLocaleString();
    if (document.getElementById('qTotal')) document.getElementById('qTotal').innerText = total.toLocaleString();
}

window.handleQuotationSubmit = async function(e) {
    if (e) e.preventDefault();
    setSyncStatus(true);

    const project = {
        rowIndex: document.getElementById('projRowIndex').value,
        projectId: document.getElementById('projId').value,
        date: document.getElementById('qDate').value,
        projectName: document.getElementById('qProjName').value,
        customerId: document.getElementById('qCustSearch').dataset.selectedId,
        pic: document.getElementById('qPic').value,
        subtotal: parseFloat(document.getElementById('qSubtotal').innerText.replace(/,/g, '')),
        tax: parseFloat(document.getElementById('qTax').innerText.replace(/,/g, '')),
        total: parseFloat(document.getElementById('qTotal').innerText.replace(/,/g, '')),
        wfOrder: document.getElementById('qWfOrder') ? document.getElementById('qWfOrder').value : '',
        wfDeposit: document.getElementById('qWfDeposit') ? document.getElementById('qWfDeposit').value : '',
        bankData: document.getElementById('qBankData') ? document.getElementById('qBankData').value : '',
        days: document.getElementById('qWfDraft') ? document.getElementById('qWfDraft').value : '',
        revCount: document.getElementById('qWfEdit') ? document.getElementById('qWfEdit').value : '',
        remark: "",
        wfDelivery: document.getElementById('qWfDelivery') ? document.getElementById('qWfDelivery').value : '',
        isCompleted: document.getElementById('projIsCompleted').value === 'true'
    };

    const items = [];
    document.querySelectorAll('#quotationItemsBody tr').forEach(row => {
        const nameF = row.querySelector('.i-name');
        const contF = row.querySelector('.i-content');
        const priceF = row.querySelector('.i-price');
        const qtyF = row.querySelector('.i-qty');
        const totalF = row.querySelector('.i-total');

        items.push({
            index: row.cells[0].innerText,
            name: nameF ? nameF.value : '',
            content: contF ? contF.value : '',
            price: priceF ? parseFloat(priceF.value) || 0 : 0,
            qty: qtyF ? parseFloat(qtyF.value) || 0 : 0,
            subtotal: totalF ? parseFloat(totalF.value) || 0 : 0
        });
    });

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_project', project, items })
        });
        const json = await res.json();
        if (json.success) {
            Toast.fire({ icon: 'success', title: '專案已儲存' });
            fetchProjects();
            if (window._redirectAfterSaveToTasks) {
                window._redirectAfterSaveToTasks = false;
                switchSubView('projects', 'list');
                const tBtn = document.getElementById('tasksTabBtn');
                if (tBtn) tBtn.click();
                setTimeout(() => {
                    const filter = document.getElementById('taskProjectFilter');
                    if (filter) filter.value = project.projectId;
                    if (typeof filterTasksByProject === 'function') filterTasksByProject();
                    if (typeof showTaskEditorPage === 'function') showTaskEditorPage();
                }, 500);
            } else {
                switchSubView('projects', 'list');
            }
        } else {
            Swal.fire('錯誤', json.error || '儲存失敗', 'error');
        }
    } catch (e) {
        Swal.fire('連線錯誤', '無法儲存資料', 'error');
    } finally {
        setSyncStatus(false);
    }
}

window.filterProjects = function(val) {
    const query = String(val).toLowerCase();
    window.currentFilteredProjects = (window.allProjects || []).filter(p => {
        const cust = window.allCustomers ? window.allCustomers.find(c => c.customerId === p.customerId) : null;
        const custName = cust ? (cust.nickname || cust.companyName) : (p.customerId || '');
        return (p.projectName || '').toLowerCase().includes(query) ||
               custName.toLowerCase().includes(query) ||
               (p.pic || '').toLowerCase().includes(query) ||
               (p.projectId || '').toLowerCase().includes(query) ||
               (cust ? (cust.companyName || '').toLowerCase().includes(query) : false) ||
               (cust ? (cust.phone || '').toLowerCase().includes(query) : false) ||
               (cust ? (cust.taxId || '').toLowerCase().includes(query) : false) ||
               (cust ? (cust.address || '').toLowerCase().includes(query) : false);
    });
    window.projectPage = 1;
    window.renderProjects();
};

window.preparePrint = function() {
    const dateVal = document.getElementById('qDate') ? document.getElementById('qDate').value : ''; 
    const custName = document.getElementById('qCustName') ? document.getElementById('qCustName').value : '客戶';
    const projName = document.getElementById('qProjName') ? document.getElementById('qProjName').value : '未命名專案';
    let yymmdd = '';
    if (dateVal) {
        const parts = dateVal.split('-');
        if (parts.length === 3) yymmdd = parts[0].slice(2) + parts[1] + parts[2];
    }
    const originalTitle = document.title;
    document.title = `${yymmdd}_${custName}_${projName}`;
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 1000);
}

window.initQuotationAutocomplete = function() {
    console.log(">> Initializing Quotation Autocomplete");
    const input = document.getElementById('qCustSearch');
    const suggest = document.getElementById('autocompleteSuggestions');
    if (!input || !suggest) return;

    input.oninput = (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (!val) {
            suggest.style.display = 'none';
            return;
        }

        const matches = (window.allCustomers || []).filter(c => 
            (c.nickname || '').toLowerCase().includes(val) || 
            (c.companyName || '').toLowerCase().includes(val) ||
            (c.contactPerson || '').toLowerCase().includes(val)
        ).slice(0, 10);

        if (matches.length === 0) {
            suggest.style.display = 'none';
            return;
        }

        suggest.innerHTML = matches.map(c => `
            <div class="suggestion-item" onclick="window.selectCustomerById('${c.customerId}')" style="padding: 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer;">
                <div style="font-weight: 600; color: var(--text-dark);">${c.nickname || c.companyName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${c.contactPerson || ''} ${c.phone || ''}</div>
            </div>
        `).join('');
        suggest.style.display = 'block';
    };

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggest.contains(e.target)) {
            suggest.style.display = 'none';
        }
    });
};

window.selectCustomerById = function(id) {
    const cust = (window.allCustomers || []).find(c => c.customerId === id);
    if (!cust) return;

    const input = document.getElementById('qCustSearch');
    const displayId = document.getElementById('qCustId');
    const displayName = document.getElementById('qCustName');
    const displayTax = document.getElementById('qTaxId');
    const displayContact = document.getElementById('qContact');
    const displayPhone = document.getElementById('qPhone');
    const displayEmail = document.getElementById('qEmail');
    const suggest = document.getElementById('autocompleteSuggestions');

    if (input) {
        input.value = cust.companyName || cust.nickname;
        input.dataset.selectedId = cust.customerId;
    }
    if (displayId) displayId.value = cust.customerId;
    if (displayName) displayName.value = cust.companyName || cust.nickname;
    if (displayTax) displayTax.value = cust.taxId || '';
    if (displayContact) displayContact.value = cust.contactPerson || '';
    if (displayPhone) displayPhone.value = cust.phone || '';
    if (displayEmail) displayEmail.value = cust.email || '';

    if (suggest) suggest.style.display = 'none';
};
