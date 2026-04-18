function initTabs() {
    document.querySelectorAll('.tab-link').forEach(t => {
        t.onclick = () => {
            const tabId = t.dataset.tab;
            document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const section = document.getElementById(tabId);
            if (section) {
                section.classList.add('active');
                // Always reset to list view when switching main tabs
                switchSubView(tabId, 'list');
            }
            
            // Contextual Button Toggle (Align Actions to Sub-Nav)
            const customerActions = document.getElementById('customerActions');
            const searchInput = document.getElementById('searchInput');
            const addCustBtn = document.getElementById('addCustomerBtn');
            const addProjBtn = document.getElementById('addProjectBtn');
            const taskFilters = document.getElementById('taskFilters');
            
            if (customerActions) {
                customerActions.style.display = (tabId === 'customers' || tabId === 'projects' || tabId === 'tasks') ? 'flex' : 'none';
                
                // Hide search in Tasks as requested
                if (searchInput) {
                    searchInput.style.display = (tabId === 'tasks') ? 'none' : 'block';
                }
                
                // Toggle specific buttons
                if (addCustBtn) addCustBtn.style.display = (tabId === 'customers') ? 'block' : 'none';
                if (addProjBtn) addProjBtn.classList.toggle('hidden', tabId !== 'projects');
                if (taskFilters) taskFilters.classList.toggle('hidden', tabId !== 'tasks');
            }
            
            // Clear search when switching
            if (searchInput) searchInput.value = '';
            
            if (tabId === 'permissions') {
                fetchMembers();
            } else if (tabId === 'settings') {
                if (typeof fetchSettings === 'function') fetchSettings();
            } else if (tabId === 'tasks') {
                if (typeof fetchTasks === 'function') fetchTasks();
                // Ensure projects are loaded for the filter dropdown
                if (!window.allProjects || window.allProjects.length === 0) {
                    if (typeof fetchProjects === 'function') fetchProjects();
                }
            } else if (tabId === 'projects') {
                fetchProjects();
            } else {
                renderCustomers();
            }
            
            // Re-init resizers and icons for new tab content
            initResizableTable();
            if (window.replaceIcons) window.replaceIcons();
        };
    });
}

window.switchToTab = function(tabId, sectionId = null) {
    const btn = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
    if (btn) {
        btn.click();
        if (sectionId) {
            setTimeout(() => {
                const target = document.getElementById(sectionId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Highlight the section briefly
                    target.style.transition = 'background-color 0.5s';
                    const originalBg = target.style.backgroundColor;
                    target.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                    setTimeout(() => target.style.backgroundColor = originalBg, 2000);
                }
            }, 200);
        }
    }
};

window.routeFromProfile = function(targetTab, targetSubView) {
    if (typeof closeModal === 'function') closeModal('profileModal');
    
    // Switch main tab
    const btn = document.querySelector(`.tab-link[data-tab="${targetTab}"]`);
    if (btn) {
        btn.click();
    } else {
        // Fallback for hidden/removed tabs (Settings, Permissions)
        document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        const section = document.getElementById(targetTab);
        if (section) section.classList.add('active');
        
        const customerActions = document.getElementById('customerActions');
        if (customerActions) customerActions.style.display = 'none';
        
        if (targetTab === 'settings' && typeof fetchSettings === 'function') fetchSettings();
        if (targetTab === 'permissions' && typeof fetchMembers === 'function') fetchMembers();
    }
    
    setTimeout(() => {
        if (targetTab === 'settings') {
            document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
            const targetEl = document.getElementById(targetSubView);
            if (targetEl) targetEl.classList.add('active');
        } else if (targetTab === 'permissions') {
             // permissions defaults to the list view initially, but ensure it's forced if needed
             if (typeof switchSubView === 'function') switchSubView('permissions', 'list');
        }
    }, 150);
}

function initResizableTable() {
    document.querySelectorAll('th').forEach(th => {
        if (th.querySelector('.resizer')) return;
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);

        let x = 0;
        let w = 0;

        const onMouseMove = (e) => {
            const dx = e.pageX - x;
            const newWidth = Math.max(100, w + dx);
            th.style.width = `${newWidth}px`;
            th.style.minWidth = `${newWidth}px`; // Important for table-layout
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', (e) => {
            x = e.pageX;
            const styles = window.getComputedStyle(th);
            w = parseInt(styles.width, 10);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.classList.add('resizing');
        });

        // Double Click to Auto-Fit
        resizer.addEventListener('dblclick', () => {
            const colIndex = Array.from(th.parentNode.children).indexOf(th);
            const table = th.closest('table');
            const rows = table.querySelectorAll('tr');
            
            // Create a temporary span to measure text width accurately
            const tester = document.createElement('span');
            tester.style.visibility = 'hidden';
            tester.style.position = 'absolute';
            tester.style.whiteSpace = 'nowrap';
            tester.style.font = window.getComputedStyle(th).font;
            document.body.appendChild(tester);

            let maxWidth = 0;
            rows.forEach(row => {
                const cell = row.children[colIndex];
                if (cell) {
                    tester.innerText = cell.innerText;
                    const cellWidth = tester.offsetWidth + 32; // Include padding
                    if (cellWidth > maxWidth) maxWidth = cellWidth;
                }
            });

            document.body.removeChild(tester);
            th.style.width = `${maxWidth}px`;
            th.style.minWidth = `${maxWidth}px`;
        });
    });
}

function initBackgroundParallax() {
    const overlay = document.getElementById('authOverlay');
    if (!overlay) return;
    
    console.log(">> Initializing Premium Parallax Background...");
    
    overlay.addEventListener('mousemove', (e) => {
        const { clientX: x, clientY: y } = e;
        const { innerWidth: w, innerHeight: h } = window;
        
        // Calculate normalized position (-1 to 1)
        const nx = (x / w) * 2 - 1;
        const ny = (y / h) * 2 - 1;
        
        // Update CSS variables for smooth movement
        overlay.style.setProperty('--mx', nx.toFixed(3));
        overlay.style.setProperty('--my', ny.toFixed(3));
    });
}

function checkModalIntegrity() {
    // Only profileModal remains as a permanent modal in DOM
    const criticalModals = ['profileModal'];
    const missing = criticalModals.filter(id => !document.getElementById(id));
    
    if (missing.length > 0) {
        console.error(">> [DOM CRITICAL ERROR] Modals missing from DOM:", missing);
    } else {
        console.log(">> Modal Integrity Check: Profile modal present.");
    }
}

// --- Print Utilities ---
window.addEventListener('beforeprint', () => {
    // Auto-expand all textareas inside the quotation print area so they don't get cropped
    document.querySelectorAll('#quotePrintArea textarea').forEach(el => {
        el.style.height = 'auto'; 
        el.style.height = el.scrollHeight + 'px';
    });
});
