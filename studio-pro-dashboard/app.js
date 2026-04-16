// ==========================================
// Configuration
// ==========================================
const GAS_WEB_APP_URL = 'YOUR_GAS_WEB_APP_URL'; // 更新此處為您的 GAS 網址
const LIFF_ID = 'YOUR_LIFF_ID'; // 更新此處為您的 LIFF ID

let allCustomers = [];
let currentProfile = null;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initEventListeners();
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
        openModal('新增客戶');
    });

    // Form Submit
    document.getElementById('customerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCustomer();
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterCustomers(e.target.value);
    });
}

// ==========================================
// API Operations
// ==========================================
async function fetchCustomers() {
    if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL') {
        renderMockData();
        return;
    }

    try {
        const res = await fetch(`${GAS_WEB_APP_URL}?action=get_customers`);
        const json = await res.json();
        if (json.success) {
            allCustomers = json.data;
            renderCustomers(allCustomers);
        }
    } catch (err) {
        console.error('Fetch Error:', err);
        Swal.fire('錯誤', '無法載入資料', 'error');
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
            Swal.fire('成功', '資料已儲存', 'success');
            closeModal();
            fetchCustomers();
        } else {
            Swal.fire('失敗', json.error || '儲存失敗', 'error');
        }
    } catch (err) {
        Swal.fire('錯誤', '網路連線異常', 'error');
    }
}

async function deleteCustomer(rowIndex) {
    const result = await Swal.fire({
        title: '確認刪除？',
        text: '刪除後將無法還原！',
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
                Swal.fire('已刪除', '', 'success');
                fetchCustomers();
            }
        } catch (err) {
            Swal.fire('錯誤', '刪除失敗', 'error');
        }
    }
}

// ==========================================
// UI Rendering
// ==========================================
function renderCustomers(data) {
    const list = document.getElementById('customerList');
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = '<div class="loading-state"><span>查無符合的資料</span></div>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            ${item.nickname ? `<span class="nickname">${item.nickname}</span>` : ''}
            <h3>${item.companyName}</h3>
            <p><strong>統編:</strong> ${item.taxId || 'N/A'}</p>
            <p><strong>聯絡人:</strong> ${item.contact || 'N/A'}</p>
            <p><strong>電話:</strong> ${item.phone || 'N/A'}</p>
            <div class="actions">
                <button class="action-btn edit" onclick="event.stopPropagation(); editCustomer(${item.rowIndex})">編輯</button>
                <button class="action-btn delete" onclick="event.stopPropagation(); deleteCustomer(${item.rowIndex})">刪除</button>
            </div>
        `;
        card.addEventListener('click', () => editCustomer(item.rowIndex));
        list.appendChild(card);
    });
}

function filterCustomers(query) {
    const q = query.toLowerCase();
    const filtered = allCustomers.filter(c => 
        c.companyName?.toLowerCase().includes(q) || 
        c.taxId?.toLowerCase().includes(q) || 
        c.contact?.toLowerCase().includes(q)
    );
    renderCustomers(filtered);
}

function openModal(title, data = null) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('customerForm').reset();
    document.getElementById('rowIndex').value = '';

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
// Mock Data (For local preview)
// ==========================================
function renderMockData() {
    allCustomers = [
        { rowIndex: 2, companyName: '範例股份有限公司', taxId: '12345678', contact: '張經理', nickname: '範例', phone: '02-1234-5678' },
        { rowIndex: 3, companyName: '模擬工程行', taxId: '87654321', contact: '王老闆', nickname: '模擬', phone: '0912-345-678' }
    ];
    renderCustomers(allCustomers);
}
