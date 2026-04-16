// ==========================================
// Configuration & State
// ==========================================
// UPDATED: 使用與 1 版部署一致的網址
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwX2PQ5Ta0yDo0ZYY5jHIP2F-jJ6V-qCzO5o1lPRLOSYVqz3BII2J42IZpTkRi4YYi9NQ/exec';
const LIFF_ID = '2009511611-ArfdbQzS'; // 此處請更新為您的 LIFF ID

let allCustomers = [];
let currentProfile = null;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initEventListeners();
    initResizableColumns();
    await initLiff();
    fetchCustomers();
});

async function initLiff() {
    try {
        if (!LIFF_ID || LIFF_ID === 'YOUR_LIFF_ID') {
            document.getElementById('userName').innerText = '未設定 LIFF';
            return;
        }

        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        currentProfile = await liff.getProfile();
        document.getElementById('userName').innerText = currentProfile.displayName;
    } catch (err) {
        console.error('LIFF Init Error:', err);
        document.getElementById('userName').innerText = '訪客模式';
    }
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.disabled) return;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
}

function initEventListeners() {
    // Modal Close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') closeModal();
    });

    // Add UI
    document.getElementById('addCustomerBtn').addEventListener('click', () => {
        openModal('新增客戶資料');
    });

    // Form Submit
    document.getElementById('customerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCustomer();
    });

    // Delete Button in Modal
    document.getElementById('deleteBtn').addEventListener('click', () => {
        const rowIndex = document.getElementById('rowIndex').value;
        if (rowIndex) deleteCustomer(parseInt(rowIndex));
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterCustomers(e.target.value);
    });
}

// ==========================================
// Spreadsheet Interaction Logic
// ==========================================
function renderCustomers(data) {
    const tbody = document.getElementById('customerTableBody');
    tbody.innerHTML = '';
    document.getElementById('tableLoading').style.display = 'none';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#999;">查無資料</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.rowIndex = item.rowIndex;
        
        // Define column keys in order
        const columns = ['companyName', 'taxId', 'contact', 'nickname', 'phone', 'email', 'address', 'invoiceInfo'];
        
        columns.forEach(col => {
            const td = document.createElement('td');
            td.innerText = item[col] || '';
            tr.appendChild(td);
        });

        // Event: Double Click to Edit
        tr.addEventListener('dblclick', () => {
            editCustomer(item.rowIndex);
        });

        // Event: Single Click to Highlight
        tr.addEventListener('click', () => {
            document.querySelectorAll('tbody tr').forEach(r => r.classList.remove('selected'));
            tr.classList.add('selected');
        });

        tbody.appendChild(tr);
    });
}

// ==========================================
// API Operations
// ==========================================
async function fetchCustomers() {
    document.getElementById('tableLoading').style.display = 'block';
    
    try {
        const url = `${GAS_WEB_APP_URL}?action=get_customers`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success) {
            allCustomers = json.data;
            renderCustomers(allCustomers);
        }
    } catch (err) {
        document.getElementById('tableLoading').innerHTML = '<span style="color:red;">連線失敗，請檢查 GAS 部署權限</span>';
        console.error('Fetch Error:', err);
    }
}

async function saveCustomer() {
    const rowIndex = document.getElementById('rowIndex').value;
    const action = rowIndex ? 'update_customer' : 'add_customer';

    const payload = {
        action: action,
        rowIndex: rowIndex ? parseInt(rowIndex) : null,
        companyName: document.getElementById('companyName').value,
        taxId: document.getElementById('taxId').value,
        contact: document.getElementById('contact').value,
        nickname: document.getElementById('nickname').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        invoiceInfo: document.getElementById('invoiceInfo').value
    };

    Swal.fire({ title: '儲存中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            Swal.fire({ icon: 'success', title: '成功', text: '資料已同步至試算表', timer: 1500 });
            closeModal();
            fetchCustomers();
        } else {
            Swal.fire('失敗', json.error || '儲存失敗', 'error');
        }
    } catch (err) {
        Swal.fire('錯誤', '連線異常，請確認 GAS 是否正確部署為 Web App', 'error');
    }
}

async function deleteCustomer(rowIndex) {
    const result = await Swal.fire({
        title: '確定刪除？',
        text: '警告：此操作將從雲端試算表中移除該筆資料！',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: '處理中...', didOpen: () => Swal.showLoading() });
        try {
            const res = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'delete_customer', rowIndex: rowIndex })
            });
            const json = await res.json();
            if (json.success) {
                Swal.fire({ icon: 'success', title: '已刪除', timer: 1000 });
                closeModal();
                fetchCustomers();
            }
        } catch (err) {
            Swal.fire('錯誤', '刪除失敗', 'error');
        }
    }
}

function filterCustomers(query) {
    const q = query.toLowerCase();
    const filtered = allCustomers.filter(c => 
        (c.companyName || '').toLowerCase().includes(q) || 
        (c.taxId || '').toLowerCase().includes(q) || 
        (c.contact || '').toLowerCase().includes(q) ||
        (c.nickname || '').toLowerCase().includes(q)
    );
    renderCustomers(filtered);
}

// ==========================================
// Modal Control
// ==========================================
function openModal(title, data = null) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('customerForm').reset();
    document.getElementById('rowIndex').value = '';
    document.getElementById('deleteBtn').style.display = 'none';

    if (data) {
        document.getElementById('rowIndex').value = data.rowIndex;
        document.getElementById('companyName').value = data.companyName;
        document.getElementById('taxId').value = data.taxId;
        document.getElementById('contact').value = data.contact;
        document.getElementById('nickname').value = data.nickname;
        document.getElementById('phone').value = data.phone;
        document.getElementById('email').value = data.email;
        document.getElementById('address').value = data.address;
        document.getElementById('invoiceInfo').value = data.invoiceInfo;
        document.getElementById('deleteBtn').style.display = 'block';
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function editCustomer(rowIndex) {
    const customer = allCustomers.find(c => c.rowIndex === rowIndex);
    if (customer) {
        openModal('編輯客戶資料', customer);
    }
}

// ==========================================
// Column Resizing Logic (Persistence)
// ==========================================
function initResizableColumns() {
    const table = document.getElementById('customerTable');
    const cols = table.querySelectorAll('th');
    
    // Load saved widths
    const savedWidths = JSON.parse(localStorage.getItem('studioPro_colWidths')) || {};

    cols.forEach((col, index) => {
        const colId = col.dataset.col;
        if (savedWidths[colId]) {
            col.style.width = savedWidths[colId] + 'px';
        }

        const resizer = col.querySelector('.resizer');
        if (!resizer) return;

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const startX = e.pageX;
            const startWidth = col.offsetWidth;
            
            document.body.classList.add('resizing');

            const onMouseMove = (moveEvent) => {
                const currentWidth = startWidth + (moveEvent.pageX - startX);
                if (currentWidth > 50) {
                    col.style.width = currentWidth + 'px';
                }
            };

            const onMouseUp = () => {
                document.body.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Save to localStorage
                const currentWidths = JSON.parse(localStorage.getItem('studioPro_colWidths')) || {};
                currentWidths[colId] = col.offsetWidth;
                localStorage.setItem('studioPro_colWidths', JSON.stringify(currentWidths));
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}
