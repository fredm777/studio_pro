// Customer Management - Logic & CRUD
// ==========================================

// --- Sorting State --- (Deprecated but kept global vars for compatibility)
window.customerSortField = 'companyName';
window.customerSortOrder = 'asc';

window.fetchCustomers = async function() {
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
            const hasChanged = JSON.stringify(window.allCustomers) !== JSON.stringify(json.data);
            if (hasChanged) {
                window.allCustomers = json.data || []; 
                setCache('customers', window.allCustomers);
                window.currentFilteredCustomers = [...window.allCustomers];
                // applyCurrentSort(); // Disabled sorting
                window.renderCustomers(); 
            }
        }
    } catch (err) { 
        console.error("Fetch Error:", err);
    } finally {
        setSyncStatus(false);
        const loading = document.getElementById('tableLoading');
        if (loading) loading.style.display = 'none';
        if (document.getElementById('projects') && document.getElementById('projects').classList.contains('active')) {
             if (typeof fetchProjects === 'function') fetchProjects();
        }
    }
}

window.changePage = (dir) => {
    const activeTab = document.querySelector('.tab-link.active');
    if (!activeTab) return;
    const tab = activeTab.dataset.tab;

    if (tab === 'customers') {
        const totalItems = window.currentFilteredCustomers ? window.currentFilteredCustomers.length : 0;
        const totalPages = Math.ceil(totalItems / window.itemsPerPage) || 1;
        window.currentPage += dir;
        if (window.currentPage < 1) window.currentPage = 1;
        if (window.currentPage > totalPages) window.currentPage = totalPages;
        window.renderCustomers();
    } else if (tab === 'projects') {
        const totalItems = window.currentFilteredProjects ? window.currentFilteredProjects.length : 0;
        const totalPages = Math.ceil(totalItems / window.projectItemsPerPage) || 1;
        window.projectPage += dir;
        if (window.projectPage < 1) window.projectPage = 1;
        if (window.projectPage > totalPages) window.projectPage = totalPages;
        window.renderProjects();
    }
};

window.renderCustomers = function() {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const loading = document.getElementById('tableLoading');
    const pagCont = document.getElementById('paginationContainer');
    if (loading) loading.style.display = 'none';
    if (pagCont) pagCont.style.display = 'flex';
    
    const totalItems = window.currentFilteredCustomers ? window.currentFilteredCustomers.length : 0;
    const totalPages = Math.ceil(totalItems / window.itemsPerPage) || 1;
    if (window.currentPage > totalPages) window.currentPage = totalPages;
    if (window.currentPage < 1) window.currentPage = 1;
    
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) pageInfo.innerText = `第 ${window.currentPage} / ${totalPages} 頁 (共 ${totalItems} 筆)`;
    if (prevBtn) { prevBtn.disabled = (window.currentPage === 1); prevBtn.style.opacity = (window.currentPage === 1) ? '0.3' : '1'; }
    if (nextBtn) { nextBtn.disabled = (window.currentPage === totalPages); nextBtn.style.opacity = (window.currentPage === totalPages) ? '0.3' : '1'; }
    
    const startIndex = (window.currentPage - 1) * window.itemsPerPage;
    const paginatedData = window.currentFilteredCustomers.slice(startIndex, startIndex + window.itemsPerPage);
    
    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">沒有符合的資料</td></tr>`;
        return;
    }

    paginatedData.forEach(item => {
        const tr = document.createElement('tr');
        const isInvoice = (item.invoiceInfo === 'v' || item.invoiceInfo === 'V');
        const invoiceHtml = isInvoice ? '<span class="invoice-badge"><i data-lucide="check"></i></span>' : '';
        
        tr.innerHTML = `<td>${item.companyName || ''}</td><td>${item.taxId || ''}</td><td>${item.contact || ''}</td><td>${item.phone || ''}</td><td style="text-align:center;">${invoiceHtml}</td>`;
        tr.ondblclick = () => showCustomerEditor('客戶明細與編輯', item);
        tbody.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

window.switchSubView = function(tabId, viewType) {
    const section = document.getElementById(tabId);
    if (!section) return;

    const listView = section.querySelector('.sub-view-stack[id$="ListView"]');
    const editView = section.querySelector('.sub-view-stack[id$="EditView"]');

    if (viewType === 'list') {
        if (editView) editView.classList.remove('active');
        setTimeout(() => {
            if (listView) listView.classList.add('active');
        }, editView ? 50 : 0); 
    } else {
        if (listView) listView.classList.remove('active');
        setTimeout(() => {
            if (editView) editView.classList.add('active');
        }, listView ? 50 : 0);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.showCustomerEditor = (title, data = null) => {
    if (!window.currentUser) return Toast.fire({ icon: 'warning', title: '請先登入' });
    const userRole = (window.currentUser.level || '').trim();
    if (userRole === '客戶') return Swal.fire('提示', '客戶帳號僅供讀取，無法修改資料', 'info');
    
    const titleEl = document.getElementById('viewTitleCustomer');
    const form = document.getElementById('customerForm');
    
    if (titleEl) titleEl.innerText = title;
    switchSubView('customers', 'edit');
    if (form) form.reset();
    
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
    const rowIdxEl = document.getElementById('rowIndex');
    const custIdEl = document.getElementById('customerId');
    if (rowIdxEl) rowIdxEl.value = data ? (data.rowIndex || '') : '';
    if (custIdEl) custIdEl.value = data ? (data.customerId || '') : '';
    
    if (data) {
        if (document.getElementById('companyName')) document.getElementById('companyName').value = data.companyName || '';
        if (document.getElementById('taxId')) document.getElementById('taxId').value = data.taxId || '';
        if (document.getElementById('nickname')) document.getElementById('nickname').value = data.nickname || '';
        if (document.getElementById('contact')) document.getElementById('contact').value = data.contact || '';
        let phone = String(data.phone || '');
        if (phone.startsWith("'")) phone = phone.slice(1);
        if (document.getElementById('phone')) document.getElementById('phone').value = phone;
        if (document.getElementById('email')) document.getElementById('email').value = data.email || '';
        if (document.getElementById('address')) document.getElementById('address').value = data.address || '';
        if (document.getElementById('invoiceInfo')) document.getElementById('invoiceInfo').checked = (data.invoiceInfo === 'v' || data.invoiceInfo === 'V');
    }
    
    if (window.lucide) lucide.createIcons();
}

window.saveCustomer = async function() {
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
        address: document.getElementById('address').value || '',
        invoiceInfo: document.getElementById('invoiceInfo').checked ? 'v' : '',
        customerId: document.getElementById('customerId').value || ''
    };

    const originalData = JSON.parse(JSON.stringify(window.allCustomers));
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
    if (rIndex && parseInt(rIndex) !== -1) {
        const idx = window.allCustomers.findIndex(c => c.rowIndex == rIndex);
        if (idx !== -1) window.allCustomers[idx] = { ...window.allCustomers[idx], ...body };
    } else {
        window.allCustomers.unshift({ ...body, rowIndex: -1 });
    }
    
    window.currentFilteredCustomers = [...window.allCustomers];
    window.renderCustomers();
    setSyncStatus(true);

    try {
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(body) 
        });
        const json = await res.json();
        if (json.success) { 
            Toast.fire({ icon: 'success', title: '客戶已儲存' });
            window.switchSubView('customers', 'list');
            if (typeof window.fetchCustomers === 'function') window.fetchCustomers(); 
        } else {
            throw new Error(json.error);
        }
    } catch (e) { 
        window.allCustomers = originalData;
        window.currentFilteredCustomers = [...window.allCustomers];
        window.renderCustomers();
        if (custErr) {
            custErr.innerText = '同步失敗: ' + (e.message || '請重新嘗試');
            custErr.classList.add('active');
        }
    } finally {
        setSyncStatus(false);
    }
}

window.filterCustomers = function(val) {
    const query = String(val).toLowerCase();
    window.currentFilteredCustomers = window.allCustomers.filter(c => {
        return Object.values(c).some(fieldVal => 
            String(fieldVal || '').toLowerCase().includes(query)
        );
    });
    window.currentPage = 1;
    window.renderCustomers();
}
