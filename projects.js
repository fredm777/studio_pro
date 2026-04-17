window.fetchProjects = async function() {
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
            allProjects = json.projects;
            currentFilteredProjects = [...allProjects];
            projectPage = 1;
            renderProjects();
        }
    } catch (err) { console.error("Fetch Projects Error:", err); }
    finally {
        setSyncStatus(false);
        if (loading) loading.style.display = 'none';
    }
}

function renderProjects() {
    const tbody = document.getElementById('projectTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'none';

    if (currentFilteredProjects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem;">尚未建立專案，點擊下方按鈕開始</td></tr>`;
        const pag = document.getElementById('projectPaginationContainer');
        if (pag) pag.style.display = 'none';
        return;
    }

    // Pagination Slicing
    const totalPages = Math.ceil(currentFilteredProjects.length / projectItemsPerPage);
    if (projectPage > totalPages) projectPage = totalPages || 1;
    
    const start = (projectPage - 1) * projectItemsPerPage;
    const end = start + projectItemsPerPage;
    const pagedEntries = currentFilteredProjects.slice(start, end);

    // Update UI info
    const pag = document.getElementById('projectPaginationContainer');
    if (pag) pag.style.display = (currentFilteredProjects.length > 0) ? 'flex' : 'none';
    const info = document.getElementById('projPageInfo');
    if (info) info.innerText = `第 ${projectPage} / ${totalPages || 1} 頁 (共 ${currentFilteredProjects.length} 筆)`;

    pagedEntries.forEach(proj => {
        // Find customer nickname
        const cust = window.allCustomers.find(c => c.customerId === proj.customerId);
        const custDisp = cust ? (cust.nickname || cust.companyName) : proj.customerId;
        const dateStr = proj.date ? new Date(proj.date).toLocaleDateString() : '';
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
        document.getElementById('qDate').value = data.date ? new Date(data.date).toISOString().split('T')[0] : '';
        
        // Granular workflow inputs
        if (document.getElementById('qWfDraft')) document.getElementById('qWfDraft').value = data.days || '';
        if (document.getElementById('qWfEdit')) document.getElementById('qWfEdit').value = data.remark || '';
        if (document.getElementById('qWfOrder')) document.getElementById('qWfOrder').value = data.wfOrder || '';
        if (document.getElementById('qWfDeposit')) document.getElementById('qWfDeposit').value = data.wfDeposit || '';
        if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = data.wfDelivery || '';
        if (document.getElementById('qBankData')) document.getElementById('qBankData').value = data.bankData || '';
        
        // Map isCompleted to UI
        const isCompleted = data.isCompleted === true;
        document.getElementById('projIsCompleted').value = isCompleted;
        if (typeof updateProjectCompletedUI === 'function') updateProjectCompletedUI(isCompleted);
        
        // Fill customer via ID (this will also update the UI)
        selectCustomerById(data.customerId);
        
        // Load items via backend if necessary
        fetchProjectItems(data.projectId);
    } else {
        // New Mode
        document.getElementById('projRowIndex').value = '';
        document.getElementById('projId').value = generateProjectId();
        document.getElementById('projIsCompleted').value = 'false';
        if (typeof updateProjectCompletedUI === 'function') updateProjectCompletedUI(false);
        document.getElementById('qPic').value = currentUser ? (currentUser.nickname || currentUser.username) : '';
        document.getElementById('qDate').value = new Date().toISOString().split('T')[0];
        addQuotationRow(); // start with one empty row
        loadSettingsPreview(); // load default terms from settings
    }
}

// --- Status and Tasks Logic for Quotation Editor ---

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
    // We must ensure the project has an ID and is saved at least once 
    // to map the task directly to a valid project ID in the database.
    const projId = document.getElementById('projId').value;
    const rowIndex = document.getElementById('projRowIndex').value;
    
    if (!rowIndex) {
        // Project has never been saved. Force a save first.
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
        // Project exists, just navigate
        document.getElementById('tasksTabBtn').click();
        setTimeout(() => {
            document.getElementById('taskProjectFilter').value = projId;
            if (typeof filterTasksByProject === 'function') filterTasksByProject();
            if (typeof showTaskEditorModal === 'function') showTaskEditorModal(projId);
        }, 300);
    }
}

async function fetchProjectItems(projId) {
    // Items are now securely bundled in the backend get_projects call.
    const proj = allProjects.find(p => p.projectId === projId);
    
    // Clear any existing rows (safety fallback)
    const tbody = document.getElementById('quotationItemsBody');
    if (tbody) tbody.innerHTML = '';
    
    if (proj && proj.items && proj.items.length > 0) {
        proj.items.forEach(item => {
            addQuotationRow(item);
        });
    } else {
        // Fallback: start with one empty row if no items found
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
        // Load from cache or fetch sessionly
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
        row.cells[0].innerText = idx + 1; // update index
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

// Autocomplete Logic
function initQuotationAutocomplete() {
    const input = document.getElementById('qCustSearch');
    const container = document.getElementById('autocompleteSuggestions');
    if (!input || !container) return;

    input.oninput = () => {
        const val = input.value.trim().toLowerCase();
        if (!val) { container.style.display = 'none'; return; }
        
        const suggestions = window.allCustomers.filter(c => {
            // Scan all fields for the keyword
            return Object.values(c).some(fieldVal => 
                String(fieldVal || '').toLowerCase().includes(val)
            );
        });

        if (suggestions.length === 0) { container.style.display = 'none'; return; }

        container.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" onclick="selectCustomerById('${s.customerId}')">
                <span class="s-name">${s.companyName} (${s.nickname || '無簡稱'})</span>
                <span class="s-tax">統編：${s.taxId || '無'} | 聯絡人：${s.contact || '無'}</span>
            </div>
        `).join('');
        container.style.display = 'block';
    };

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) container.style.display = 'none';
    });
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
    
    // Hidden customer ID
    // I need a way to store the selected customer ID. I'll use a data attribute or another hidden input.
    document.getElementById('qCustSearch').dataset.selectedId = cid;
}

async function handleQuotationSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.classList.add('btn-loading');
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
        remark: document.getElementById('qWfEdit') ? document.getElementById('qWfEdit').value : '',
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
        const reqBody = { action: 'save_project', project, items };
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(reqBody)
        });
        const json = await res.json();
        
        if (json.success) {
            Swal.fire({ icon: 'success', title: '儲存成功', timer: 1500, showConfirmButton: false });
            fetchProjects();
            
            // Check if we need to redirect to add task
            if (window._redirectAfterSaveToTasks) {
                window._redirectAfterSaveToTasks = false;
                switchSubView('projects', 'list');
                document.getElementById('tasksTabBtn').click();
                setTimeout(() => {
                    document.getElementById('taskProjectFilter').value = project.projectId;
                    if (typeof filterTasksByProject === 'function') filterTasksByProject();
                    if (typeof showTaskEditorModal === 'function') showTaskEditorModal(project.projectId);
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
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

window.filterProjects = function(val) {
    const query = String(val).toLowerCase();
    window.currentFilteredProjects = window.allProjects.filter(p => {
        // Find customer nickname for joint search
        const cust = window.allCustomers.find(c => c.customerId === p.customerId);
        const custName = cust ? (cust.nickname || cust.companyName) : (p.customerId || '');
        
        return (p.projectName || '').toLowerCase().includes(query) ||
               custName.toLowerCase().includes(query) ||
               (p.pic || '').toLowerCase().includes(query) ||
               (p.projectId || '').toLowerCase().includes(query);
    });
    projectPage = 1;
    renderProjects();
};

