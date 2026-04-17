// Project Management & Quotation Editor
// ==========================================

window.currentFilteredProjects = [];
window.projectPage = 1;
window.projectItemsPerPage = parseInt(localStorage.getItem('st_pro_project_items_per_page')) || 20;

// --- Sorting State ---
window.projectSortField = localStorage.getItem('st_pro_proj_sort_field') || 'date';
window.projectSortOrder = localStorage.getItem('st_pro_proj_sort_order') || 'desc';

window.fetchProjects = async function() {
    // 1. Load from cache first for instant UI
    const cached = getCache('projects');
    if (cached) {
        window.allProjects = cached;
        window.currentFilteredProjects = [...window.allProjects];
        applyProjectSort();
        renderProjects();
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
            applyProjectSort();
            renderProjects();
            if (typeof updateTaskProjectFilter === 'function') updateTaskProjectFilter();
        }
    } catch (err) { console.error("Fetch Projects Error:", err); }
    finally {
        setSyncStatus(false);
        if (loading) loading.style.display = 'none';
    }
}

window.sortProjects = function(field) {
    if (window.projectSortField === field) {
        window.projectSortOrder = window.projectSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        window.projectSortField = field;
        window.projectSortOrder = 'asc';
    }
    
    // Persist to cache
    localStorage.setItem('st_pro_proj_sort_field', window.projectSortField);
    localStorage.setItem('st_pro_proj_sort_order', window.projectSortOrder);
    
    applyProjectSort();
    window.projectPage = 1;
    renderProjects();
}

function applyProjectSort() {
    const field = window.projectSortField;
    const order = window.projectSortOrder;
    
    window.currentFilteredProjects.sort((a, b) => {
        let valA, valB;
        
        if (field === 'custNickname') {
            const custA = window.allCustomers.find(c => c.customerId === a.customerId);
            const custB = window.allCustomers.find(c => c.customerId === b.customerId);
            valA = custA ? (custA.nickname || custA.companyName) : a.customerId;
            valB = custB ? (custB.nickname || custB.companyName) : b.customerId;
        } else if (field === 'grandTotal') {
            valA = parseFloat(a.total) || 0;
            valB = parseFloat(b.total) || 0;
        } else {
            valA = (a[field] || '').toString().toLowerCase();
            valB = (b[field] || '').toString().toLowerCase();
        }
        
        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

function updateProjectSortIcons() {
    // Reset all icons in project table
    document.querySelectorAll('#projects table thead i').forEach(icon => {
        icon.setAttribute('data-lucide', 'arrow-up-down');
        icon.parentElement.classList.remove('active');
    });
    
    const activeIcon = document.getElementById(`sortIcon-${window.projectSortField}`);
    if (activeIcon) {
        activeIcon.setAttribute('data-lucide', window.projectSortOrder === 'asc' ? 'arrow-up' : 'arrow-down');
        activeIcon.parentElement.classList.add('active');
    }
    
    if (window.lucide) lucide.createIcons();
}

function renderProjects() {
    const tbody = document.getElementById('projectTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'none';

    if (window.currentFilteredProjects.length === 0) {
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
        const cust = window.allCustomers.find(c => c.customerId === proj.customerId);
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
    
    updateProjectSortIcons();
}

window.showQuotationEditor = function(title, data = null) {
    switchSubView('projects', 'edit');
    const form = document.getElementById('quotationForm');
    form.reset();
    document.getElementById('quotationTitle').innerText = title;
    document.getElementById('quotationItemsBody').innerHTML = '';
    
    // Clear suggests
    document.getElementById('autocompleteSuggestions').style.display = 'none';

    if (data) {
        // Edit Mode
        document.getElementById('projRowIndex').value = data.rowIndex || '';
        document.getElementById('projId').value = data.projectId || '';
        document.getElementById('qProjName').value = data.projectName || '';
        document.getElementById('qPic').value = data.pic || '';
        document.getElementById('qDate').value = data.date || '';
        
        if (document.getElementById('qWfDraft')) document.getElementById('qWfDraft').value = data.days || '';
        if (document.getElementById('qWfEdit')) document.getElementById('qWfEdit').value = data.revCount || '';
        if (document.getElementById('qWfOrder')) document.getElementById('qWfOrder').value = data.wfOrder || '';
        if (document.getElementById('qWfDeposit')) document.getElementById('qWfDeposit').value = data.wfDeposit || '';
        if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = data.wfDelivery || '';
        if (document.getElementById('qBankData')) document.getElementById('qBankData').value = data.bankData || '';
        
        const isCompleted = data.isCompleted === true || String(data.isCompleted).toLowerCase() === 'true';
        document.getElementById('projIsCompleted').value = isCompleted;
        if (typeof updateProjectCompletedUI === 'function') updateProjectCompletedUI(isCompleted);
        
        selectCustomerById(data.customerId);
        
        if (typeof currentUser !== 'undefined' && currentUser) {
            if (currentUser.phone) document.getElementById('qStudioPhone').innerText = currentUser.phone;
            if (currentUser.email) document.getElementById('qStudioEmail').innerText = currentUser.email;
        }
        
        fetchProjectItems(data.projectId);
    } else {
        // New Mode
        document.getElementById('projRowIndex').value = '';
        document.getElementById('projId').value = generateProjectId();
        document.getElementById('projIsCompleted').value = 'false';
        if (typeof updateProjectCompletedUI === 'function') updateProjectCompletedUI(false);
        document.getElementById('qPic').value = currentUser ? (currentUser.nickname || currentUser.username) : '';
        document.getElementById('qDate').value = new Date().toISOString().split('T')[0];
        
        if (typeof currentUser !== 'undefined' && currentUser) {
            if (currentUser.phone) document.getElementById('qStudioPhone').innerText = currentUser.phone;
            if (currentUser.email) document.getElementById('qStudioEmail').innerText = currentUser.email;
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
        document.getElementById('tasksTabBtn').click();
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
        const price = parseFloat(row.querySelector('.i-price').value) || 0;
        const qty = parseFloat(row.querySelector('.i-qty').value) || 0;
        const total = price * qty;
        row.querySelector('.i-total').value = total;
        subtotal += total;
    });
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    document.getElementById('qSubtotal').innerText = subtotal.toLocaleString();
    document.getElementById('qTax').innerText = tax.toLocaleString();
    document.getElementById('qTotal').innerText = total.toLocaleString();
}

window.selectCustomerById = function(cid) {
    const cust = window.allCustomers.find(c => c.customerId === cid);
    if (!cust) return;
    document.getElementById('qCustName').value = cust.companyName || '';
    document.getElementById('qTaxId').value = cust.taxId || '';
    document.getElementById('qContact').value = cust.contact || '';
    document.getElementById('qPhone').value = String(cust.phone || '').replace("'", "");
    document.getElementById('qEmail').value = cust.email || '';
    document.getElementById('qCustSearch').value = cust.companyName;
    document.getElementById('autocompleteSuggestions').style.display = 'none';
    document.getElementById('qCustSearch').dataset.selectedId = cid;
}

async function handleQuotationSubmit(e) {
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
        items.push({
            index: row.cells[0].innerText,
            name: row.querySelector('.i-name').value,
            content: row.querySelector('.i-content').value,
            price: parseFloat(row.querySelector('.i-price').value),
            qty: parseFloat(row.querySelector('.i-qty').value),
            subtotal: parseFloat(row.querySelector('.i-total').value)
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
                document.getElementById('tasksTabBtn').click();
                setTimeout(() => {
                    document.getElementById('taskProjectFilter').value = project.projectId;
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
        const cust = window.allCustomers.find(c => c.customerId === p.customerId);
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
    applyProjectSort();
    window.projectPage = 1;
    renderProjects();
};

window.preparePrint = function() {
    const dateVal = document.getElementById('qDate').value; 
    const custName = document.getElementById('qCustName').value || '客戶';
    const projName = document.getElementById('qProjName').value || '未命名專案';
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
