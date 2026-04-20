// Customer Management - Logic & CRUD
// ==========================================

// --- State ---
window.customerSortField = 'companyName';
window.customerSortOrder = 'asc';
window.allCustomers = [];
window.currentFilteredCustomers = [];
window.currentPage = 1;
window.itemsPerPage = parseInt(localStorage.getItem('st_pro_items_per_page')) || 7;

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
            window.allCustomers = json.data || []; 
            window.currentFilteredCustomers = [...window.allCustomers];
            window.renderCustomers(); 
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
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 60px 0; color: var(--text-muted); opacity: 0.6;">
                    <div style="margin-bottom: 20px;">
                        <img src="assets/icons/users.svg" style="width: 64px; height: 64px; filter: grayscale(1) brightness(1.5); opacity: 0.3;">
                    </div>
                    <p style="font-size: 0.9375rem;">目前沒有符合條件的客戶資料</p>
                </td>
            </tr>
        `;
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

window.switchSubView = async function(tabId, viewType) {
    // Safety check for unsaved quotation changes
    if (window.isQuotationModified && viewType === 'list' && tabId === 'projects') {
        const result = await Swal.fire({
            title: '尚未儲存',
            text: '報價單內容已修改，確定要離開嗎？（未儲存的變更將遺失）',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '確定離開',
            cancelButtonText: '留下來儲存',
            confirmButtonColor: '#ef4444'
        });
        if (!result.isConfirmed) return;
        window.isQuotationModified = false; // Reset if they force leave
    }

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
        
        // Tax ID handling
        let taxId = String(data.taxId || '');
        if (taxId.startsWith("'")) taxId = taxId.slice(1);
        if (document.getElementById('taxId')) document.getElementById('taxId').value = taxId;
        
        if (document.getElementById('nickname')) document.getElementById('nickname').value = data.nickname || '';
        if (document.getElementById('contact')) document.getElementById('contact').value = data.contact || '';
        
        // Phone handling
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
    const companyName = document.getElementById('companyName').value;
    let taxId = document.getElementById('taxId').value;
    let phone = document.getElementById('phone').value;

    // Auto prepend ' if starts with 0 to preserve leading zeros in Sheets
    if (taxId.startsWith('0')) taxId = "'" + taxId;
    if (phone.startsWith('0')) phone = "'" + phone;

    const body = {
        action: rIndex ? 'update_customer' : 'add_customer',
        rowIndex: rIndex ? parseInt(rIndex) : null,
        companyName,
        taxId,
        nickname: document.getElementById('nickname').value,
        contact: document.getElementById('contact').value,
        phone,
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
