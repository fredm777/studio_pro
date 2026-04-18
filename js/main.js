function initEventListeners() {
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el[event] = handler;
    };

    safeBind('loginForm', 'onsubmit', handleLogin);
    safeBind('registerForm', 'onsubmit', handleRegister);
    
    // Live Validation for Registration
    const regUserInput = document.getElementById('regUser');
    const regEmailInput = document.getElementById('regEmail');
    if (regUserInput) regUserInput.onblur = () => checkAvailability('username', regUserInput.value);
    if (regEmailInput) regEmailInput.onblur = () => checkAvailability('email', regEmailInput.value);

    safeBind('verifyForm', 'onsubmit', handleVerify);
    safeBind('logoutBtn', 'onclick', window.logout);
    safeBind('bindLineBtn', 'onclick', window.startLiffBinding);
    safeBind('lineLoginBtn', 'onclick', window.loginViaLine);
    safeBind('googleLoginBtn', 'onclick', window.loginViaGoogle);
    safeBind('bindGoogleBtn', 'onclick', window.bindGoogle);

    const socialToggle = document.getElementById('socialToggle');
    if (socialToggle) {
        socialToggle.onclick = () => {
            const options = document.getElementById('socialOptions');
            if (options) {
                const isHidden = !options.style.display || options.style.display === 'none';
                options.style.display = isHidden ? 'flex' : 'none';
            }
        };
    }
    
    safeBind('addCustomerBtn', 'onclick', () => showCustomerEditor('新增客戶資料'));
    const custForm = document.getElementById('customerForm');
    if (custForm) custForm.onsubmit = (e) => { e.preventDefault(); saveCustomer(); };
    
    safeBind('userInfoTrigger', 'onclick', window.openProfileModal);
    safeBind('profileForm', 'onsubmit', window.handleProfileUpdateSubmit);
    safeBind('memberForm', 'onsubmit', handleMemberUpdateSubmit);
    safeBind('globalSettingsForm', 'onsubmit', handleSettingsSubmit);
    safeBind('quotationForm', 'onsubmit', handleQuotationSubmit);
    
    // Initialize specific components
    initQuotationAutocomplete();
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const activeTab = document.querySelector('.tab-link.active');
            if (!activeTab) return;
            const tab = activeTab.dataset.tab;
            if (tab === 'customers') filterCustomers(e.target.value);
            else if (tab === 'projects') filterProjects(e.target.value);
            else filterMembers(e.target.value);
        };
    }
    
    // Note: ModalOverlay specific listeners removed as it's now a sub-view

    // Profile Modal outside-click
    const pModal = document.getElementById('profileModal');
    if (pModal) {
        pModal.onclick = (e) => {
            if (e.target === pModal) closeProfileModal();
        };
    }
    
    safeBind('forgotForm', 'onsubmit', handleForgotSubmit);

    // Customer Pagination
    const itemsInput = document.getElementById('itemsPerPageInput');
    if (itemsInput) {
        itemsInput.value = window.itemsPerPage;
        itemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 20;
            window.itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', window.itemsPerPage);
            window.currentPage = 1;
            window.renderCustomers();
        };
        itemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(itemsInput.value) || 20;
            if (e.deltaY < 0) val += 5; else val -= 5;
            if (val < 1) val = 1;
            if (val > 200) val = 200;
            itemsInput.value = val;
            window.itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', window.itemsPerPage);
            window.currentPage = 1;
            window.renderCustomers();
        };
    }

    // Project Pagination
    const projItemsInput = document.getElementById('projItemsPerPageInput');
    if (projItemsInput) {
        projItemsInput.value = window.projectItemsPerPage;
        projItemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 20;
            window.projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', window.projectItemsPerPage);
            window.projectPage = 1;
            window.renderProjects();
        };
        projItemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(projItemsInput.value) || 20;
            if (e.deltaY < 0) val += 5; else val -= 5;
            if (val < 1) val = 1;
            if (val > 200) val = 200;
            projItemsInput.value = val;
            window.projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', window.projectItemsPerPage);
            window.projectPage = 1;
            window.renderProjects();
        };
    }

    safeBind('prevPageBtn', 'onclick', () => window.changePage(-1));
    safeBind('nextPageBtn', 'onclick', () => window.changePage(1));
    safeBind('projPrevPageBtn', 'onclick', () => window.changePage(-1));
    safeBind('projNextPageBtn', 'onclick', () => window.changePage(1));

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 1. Close Modals
            const activeModals = document.querySelectorAll('.modal-overlay.active');
            if (activeModals.length > 0) {
                activeModals.forEach(m => m.classList.remove('active'));
                return;
            }

            // 2. Back to List if in Edit mode
            const activeTab = document.querySelector('.tab-link.active');
            if (activeTab) {
                const tabId = activeTab.dataset.tab;
                const editView = document.getElementById(`${tabId}EditView`);
                if (editView && editView.classList.contains('active')) {
                    switchSubView(tabId, 'list');
                }
            }
        }
    });

    // Password Visibility Logic
    document.querySelectorAll('.password-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const toggle = wrapper.querySelector('.toggle-password');
        if (input && toggle) {
            if (input.value.length > 0) toggle.classList.add('visible');
            input.addEventListener('input', () => {
                if (input.value.length > 0) toggle.classList.add('visible');
                else toggle.classList.remove('visible');
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log(">> System Init: v1.9 Release Starting...");
    try { initEventListeners(); } catch(e) { console.error("Event Init Error:", e); }
    try { initTabs(); } catch(e) { console.error("Tab Init Error:", e); }
    if (window.lucide) { lucide.createIcons(); }

    const initApp = async () => {
        setSyncStatus(true);
        const hasLiffParams = window.location.search.includes('liffClientId') || window.location.search.includes('code') || window.location.search.includes('liff.state');
        
        if (hasLiffParams) {
            console.log(">> LINE Redirect detected, awaiting processing...");
            await handleLiffRedirect();
        }
        
        if (!currentUser && document.querySelectorAll('.auth-stage.active').length === 0) {
            checkAuth();
        }
        setSyncStatus(false);
    };

    initApp();
    initResizableTable();
    initBackgroundParallax();
    setTimeout(checkModalIntegrity, 2000);
});
