// Studio Pro Dashboard Logic v1.9 (RELEASE)
// ==========================================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwX9xG_snc8EmBttBBOW3M8bNOUxZojeXjfag22pGgGnb5EcfgphhJ3klR8JPv8cAObFQ/exec';
const LIFF_ID = '2009659478-RZ3Q85ZU'; 

window.allCustomers = [];
window.currentFilteredCustomers = [];
window.currentPage = 1;
window.itemsPerPage = parseInt(localStorage.getItem('st_pro_items_per_page')) || 20;

window.allMembers = [];
window.currentUser = null;
window.registeredUsername = ''; 
window.verifyContext = 'register';

// --- Toast Mixin for Non-blocking Notifications ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

let navHintTimer = null;
function showNavHint(msg) {
    const saveBtn = document.querySelector('.save-btn');
    const originalBtnText = saveBtn ? saveBtn.innerText : '儲存變更';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = '同步中...';
    }

    try {
        const hintEl = document.getElementById('navHint');
        if (!hintEl) return;
        hintEl.innerText = msg;
        hintEl.classList.add('active');
        if (navHintTimer) clearTimeout(navHintTimer);
        navHintTimer = setTimeout(() => {
            hintEl.classList.remove('active');
        }, 4000);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = originalBtnText;
        }
    }
}

// --- Performance & Sync Helpers ---

window.closeAllModals = () => {
    try {
        console.log(">> Closing all active modals...");
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    } catch (e) { console.error("closeAllModals error:", e); }
};

window.logError = (ctx, err) => {
    console.error(`[${ctx}]`, err);
    Swal.fire({
        icon: 'error',
        title: '系統錯誤',
        text: `在 ${ctx} 發生錯誤: ${err.message || err}`,
        footer: '請截圖並聯繫開發人員'
    });
};

function setSyncStatus(active) {
    const bar = document.getElementById('syncProgressBar');
    const badge = document.getElementById('syncBadge');
    if (active) {
        if (bar) {
            bar.style.width = '30%';
            bar.classList.add('active');
        }
        if (badge) badge.classList.add('active');
        // Simulate progress
        setTimeout(() => { 
            if (bar && bar.classList.contains('active')) bar.style.width = '70%'; 
        }, 500);
    } else {
        if (bar) bar.style.width = '100%';
        setTimeout(() => {
            if (bar) {
                bar.classList.remove('active');
                bar.style.width = '0%';
            }
            if (badge) badge.classList.remove('active');
        }, 300);
    }
}

// --- Hybrid Caching Helpers ---
function getCache(key) {
    const cached = localStorage.getItem(`st_pro_cache_${key}`);
    return cached ? JSON.parse(cached) : null;
}
function setCache(key, data) {
    localStorage.setItem(`st_pro_cache_${key}`, JSON.stringify(data));
}
