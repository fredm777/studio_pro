function initEventListeners() {
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el[event] = handler;
    };

    safeBind('loginForm', 'onsubmit', window.handleLogin);
    safeBind('registerForm', 'onsubmit', window.handleRegister);

    // Live Validation for Registration
    const regUserInput = document.getElementById('regUser');
    const regEmailInput = document.getElementById('regEmail');
    if (regUserInput) regUserInput.onblur = () => window.checkAvailability('username', regUserInput.value);
    if (regEmailInput) regEmailInput.onblur = () => window.checkAvailability('email', regEmailInput.value);

    safeBind('verifyForm', 'onsubmit', window.handleVerify);
    safeBind('logoutBtn', 'onclick', window.logout);
    safeBind('bindLineBtn', 'onclick', window.startLiffBinding);
    safeBind('lineLoginBtn', 'onclick', window.loginViaLine);
    safeBind('googleLoginBtn', 'onclick', window.loginViaGoogle);
    safeBind('bindGoogleBtn', 'onclick', window.bindGoogle);

    const socialToggle = document.getElementById('socialToggle');
    if (socialToggle) {
        socialToggle.onclick = () => {
            console.log(">> socialToggle Clicked");
            const options = document.getElementById('socialOptions');
            if (options) {
                const isCurrentlyHidden = window.getComputedStyle(options).display === 'none';
                options.style.display = isCurrentlyHidden ? 'flex' : 'none';
                console.log(">> socialOptions display set to:", options.style.display);
            }
        };
    }

    safeBind('addCustomerBtn', 'onclick', () => showCustomerEditor('新增客戶資料'));
    safeBind('addProjectBtn', 'onclick', () => showQuotationEditor('建立新報價單'));
    safeBind('addTaskBtn', 'onclick', () => window.addTaskInline());
    const custForm = document.getElementById('customerForm');
    if (custForm) custForm.onsubmit = (e) => { e.preventDefault(); window.saveCustomer(); };

    safeBind('userInfoTrigger', 'onclick', window.openProfileModal);
    safeBind('profileForm', 'onsubmit', window.handleProfileUpdateSubmit);
    safeBind('memberForm', 'onsubmit', window.handleMemberUpdateSubmit);
    safeBind('globalSettingsForm', 'onsubmit', window.handleSettingsSubmit);
    safeBind('quotationForm', 'onsubmit', window.handleQuotationSubmit);

    // Initialize specific components
    initQuotationAutocomplete();

    // --- Global Add Button Logic Removed (Now handled by localized card-add-buttons) ---

    // Section-specific Search Logic
    const customerSearch = document.getElementById('customerSearchInput');
    if (customerSearch) {
        customerSearch.oninput = (e) => {
            if (typeof filterCustomers === 'function') filterCustomers(e.target.value);
        };
    }

    const projectSearch = document.getElementById('projectSearchInput');
    if (projectSearch) {
        projectSearch.oninput = (e) => {
            if (typeof filterProjects === 'function') filterProjects(e.target.value);
        };
    }

    // --- Combined Global Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        const key = e.key;

        // 1. Navigation Shortcuts (Cmd/Ctrl + 1-6)
        if (isCmdOrCtrl && ['1', '2', '3', '4', '5', '6'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`>> Shortcut Detected: Cmd/Ctrl + ${key}`);
            if (key === '1') window.switchToTab('customers');
            if (key === '2') window.switchToTab('projects');
            if (key === '3') window.switchToTab('tasks');
            if (key === '4') window.routeFromProfile('settings', 'bankSettingsView');
            if (key === '5') window.routeFromProfile('settings', 'workflowSettingsView');
            if (key === '6') window.routeFromProfile('permissions', 'permissionsListView');
            return;
        }

        // 2. Save Shortcut (Cmd/Ctrl + S)
        if (isCmdOrCtrl && key.toLowerCase() === 's') {
            const editView = document.getElementById('projectsEditView');
            if (editView && editView.classList.contains('active')) {
                e.preventDefault();
                e.stopPropagation();
                console.log(">> Shortcut Detected: Cmd/Ctrl + S (Save)");
                if (typeof window.handleQuotationSubmit === 'function') {
                    window.handleQuotationSubmit(null, false);
                }
            }
        }

        // 3. Escape Key (Close Modals & Edit Views)
        if (key === 'Escape') {
            const activeModals = document.querySelectorAll('.modal-overlay.active');
            if (activeModals.length > 0) {
                console.log(">> ESC: Closing active modals");
                activeModals.forEach(m => m.classList.remove('active'));
                return;
            }

            const activeEditViews = document.querySelectorAll('.sub-view-stack.active[id$="EditView"]');
            if (activeEditViews.length > 0) {
                activeEditViews.forEach(ev => {
                    const tabId = ev.id.replace('EditView', '');
                    console.log(`>> ESC: Returning from EditView for ${tabId}`);
                    if (typeof window.switchSubView === 'function') {
                        window.switchSubView(tabId, 'list');
                    }
                });
                return;
            }

            const activeTab = document.querySelector('.tab-link.active');
            if (activeTab) {
                const tabId = activeTab.dataset.tab;
                const editView = document.getElementById(`${tabId}EditView`);
                if (editView && editView.classList.contains('active')) {
                    if (typeof window.switchSubView === 'function') {
                        window.switchSubView(tabId, 'list');
                    }
                }
            }
        }
    });

    // --- Browser Navigation Guard ---
    window.onbeforeunload = function() {
        if (window.isQuotationModified) {
            return "報價單內容已修改，確定要離開嗎？";
        }
    };

    // Profile Modal outside-click
    const pModal = document.getElementById('profileModal');
    if (pModal) {
        pModal.onclick = (e) => {
            if (e.target === pModal) closeProfileModal();
        };
    }

    safeBind('forgotForm', 'onsubmit', window.handleForgotSubmit);

    // Customer Pagination
    const itemsInput = document.getElementById('itemsPerPageInput');
    if (itemsInput) {
        itemsInput.value = window.itemsPerPage;
        itemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 7;
            window.itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', window.itemsPerPage);
            window.currentPage = 1;
            window.renderCustomers();
        };
        itemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(itemsInput.value) || 7;
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
            const val = parseInt(e.target.value) || 7;
            window.projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', window.projectItemsPerPage);
            window.projectPage = 1;
            window.renderProjects();
        };
        projItemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(projItemsInput.value) || 7;
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
        // 1. Handle Modal Overlays (like Profile Modal)
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            return;
        }

        // 2. Handle Sub-View Stack "Background" clicks (outside the edit card)
        // If clicking directly on a sub-view-stack that is active, it means we clicked the margin/background
        if (e.target.classList.contains('sub-view-stack') && e.target.classList.contains('active')) {
            const tabId = e.target.id.replace('EditView', '').replace('ListView', '');
            if (e.target.id.includes('EditView')) {
                console.log(">> Clicked outside edit card, returning to list...");
                if (typeof window.switchSubView === 'function') {
                    window.switchSubView(tabId, 'list');
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

// Icon Cache to prevent redundant fetches
const iconCache = new Map();

// Custom SVG Loader for Studio Pro Branding Icons
window.replaceIcons = async function () {
    const icons = document.querySelectorAll('[data-lucide]');
    const nameMapping = {
        'trash-2': 'trash',
        'trash': 'trash',
        'check': 'checked',
        'square-check': 'checked',
        'square': 'unchecked',
        'x': 'close',
        'eye-off': 'eye off',
        'eye': 'eye',
        'grip-vertical': 'drag',
        'drag': 'drag',
        'plus': 'plus',
        'pencil': 'pencil',
        'google': 'Google',
        'line': 'LINE',
        'search': 'search',
        'settings': 'settings',
        'credit-card': 'account',
        'file-text': 'process',
        'star': 'star',
        'users': 'users',
        'layers': 'projects',
        'briefcase': 'projects',
        'projects': 'projects',
        'list-todo': 'tasks',
        'tasks': 'tasks',
        'calendar': 'calendar',
        'clock': 'clock',
        'printer': 'printer',
        'circle-slash': 'unbound',
        'bound': 'bound',
        'unbound': 'unbound'
    };

    for (const icon of icons) {
        // Skip elements that were already successfully replaced (now they are SVG containers)
        if (icon.getAttribute('data-brand-loaded') === 'true') continue;

        let name = icon.getAttribute('data-lucide');
        if (!name) continue;

        const mappedName = nameMapping[name] || name;
        const iconPath = `assets/icons/${mappedName}.svg`;

        try {
            let svgText;
            if (iconCache.has(mappedName)) {
                svgText = iconCache.get(mappedName);
            } else {
                const response = await fetch(iconPath);
                if (response.ok) {
                    svgText = await response.text();
                    iconCache.set(mappedName, svgText);
                }
            }

            if (svgText) {
                // Non-destructive replacement: keeps original element but replaces its content
                // Or: keep data-lucide and add a marker
                icon.innerHTML = svgText;
                icon.style.display = 'inline-flex';
                icon.style.alignItems = 'center';
                icon.style.justifyContent = 'center';
                icon.style.width = icon.style.width || '18px';
                icon.style.height = icon.style.height || '18px';
                icon.setAttribute('data-brand-loaded', 'true');

                const svgEl = icon.querySelector('svg');
                if (svgEl) {
                    svgEl.style.width = '100%';
                    svgEl.style.height = '100%';
                    svgEl.style.display = 'block';
                }
            } else {
                // Fallback to Lucide
                if (window.lucide) lucide.createIcons();
            }
        } catch (err) {
            console.error(`Error loading icon ${name}:`, err);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log(">> System Init: v1.9 Release Starting...");
    try { initEventListeners(); } catch (e) { console.error("Event Init Error:", e); }
    try { initTabs(); } catch (e) { console.error("Tab Init Error:", e); }

    // Initial Icon Replacement
    window.replaceIcons();

    const initApp = async () => {
        setSyncStatus(true);
        const hasLiffParams = window.location.search.includes('liffClientId') || window.location.search.includes('code') || window.location.search.includes('liff.state');

        if (hasLiffParams) {
            console.log(">> LINE Redirect detected, awaiting processing...");
            await handleLiffRedirect();
        }

        if (!window.currentUser && document.querySelectorAll('.auth-stage.active').length === 0) {
            checkAuth();
        }
        setSyncStatus(false);
    };

    initApp();
    initResizableTable();
    initBackgroundParallax();
    setTimeout(checkModalIntegrity, 2000);
});
