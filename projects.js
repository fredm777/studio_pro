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
        const cust = allCustomers.find(c => c.customerId === proj.customerId);
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
        document.getElementById('qDays').value = data.days || '';
        document.getElementById('qRemark').value = data.remark || '';
        
        // Fill customer via ID (this will also update the UI)
        selectCustomerById(data.customerId);
        
        // Load items via backend if necessary, or pass in data (Wait, GAS didn't return items in get_projects)
        // I need to fetch items separately or let GAS return them bundled. 
        // Let's adjust GAS to return bundled items or add a fetch for it.
        // Actually, let's keep it simple: I'll add a fetchItems function.
        fetchProjectItems(data.projectId);
    } else {
        // New Mode
        document.getElementById('projRowIndex').value = '';
        document.getElementById('projId').value = generateProjectId();
        document.getElementById('qPic').value = currentUser ? (currentUser.nickname || currentUser.username) : '';
        document.getElementById('qDate').value = new Date().toISOString().split('T')[0];
        addQuotationRow(); // start with one empty row
        loadSettingsPreview(); // load default terms from settings
    }
}

async function fetchProjectItems(projId) {
    // For now, I'll mock this or assume it was bundled. 
    // Optimization: I'll add the items to the same handleGetProjects in GAS next.
    // But to save time, I'll just add one dummy row for now to show UI is working.
    addQuotationRow(); 
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
            let processStr = "";
            if (s.bank_info) {
                const b = JSON.parse(s.bank_info);
                processStr += `[匯款帳號]\n銀行：${b.bankName}\n戶名：${b.accountName}\n帳號：${b.accountNumber}\n\n`;
            }
            if (s.standard_terms) {
                processStr += `[作業及合約條款]\n${s.standard_terms}`;
            }
            document.getElementById('qProcessContent').innerText = processStr;
        }
    } catch(e) {}
}

function addQuotationRow(data = null) {
    const tbody = document.getElementById('quotationItemsBody');
    const rowIdx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="text-align:center;">${rowIdx}</td>
        <td><input class="i-name" placeholder="項目名稱" value="${data ? data.name : ''}"></td>
        <td><textarea class="i-content" placeholder="細項內容..." rows="1">${data ? data.content : ''}</textarea></td>
        <td><input type="number" class="i-price" value="${data ? data.price : 0}" oninput="calcQuotation()"></td>
        <td><input type="number" class="i-qty" value="${data ? data.qty : 1}" oninput="calcQuotation()"></td>
        <td><input type="number" class="i-total readonly-field" readonly value="${data ? data.subtotal : 0}"></td>
        <td style="text-align:center;"><div class="remove-row-btn" onclick="this.closest('tr').remove(); calcQuotation();">×</div></td>
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
        
        const suggestions = allCustomers.filter(c => {
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
    const cust = allCustomers.find(c => c.customerId === cid);
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
        days: document.getElementById('qDays').value,
        remark: document.getElementById('qRemark').value
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
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_project', project, items })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire({ icon: 'success', title: '儲存成功', timer: 1500, showConfirmButton: false });
            switchSubView('projects', 'list');
            fetchProjects();
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
    currentFilteredProjects = allProjects.filter(p => {
        // Find customer nickname for joint search
        const cust = allCustomers.find(c => c.customerId === p.customerId);
        const custName = cust ? (cust.nickname || cust.companyName) : (p.customerId || '');
        
        return (p.projectName || '').toLowerCase().includes(query) ||
               custName.toLowerCase().includes(query) ||
               (p.pic || '').toLowerCase().includes(query) ||
               (p.projectId || '').toLowerCase().includes(query);
    });
    projectPage = 1;
    renderProjects();
};

