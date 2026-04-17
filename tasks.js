// Tasks Management

window.allTasks = window.allTasks || [];
window.currentFilteredTasks = window.currentFilteredTasks || [];

window.fetchTasks = async function() {
    console.log(">> Fetching Tasks...");
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_tasks' })
        });
        const json = await res.json();
        if (json.success) {
            window.allTasks = json.tasks || [];
            if (typeof window.updateTaskProjectFilter === 'function') window.updateTaskProjectFilter();
            if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
        }
    } catch (e) { 
        console.error("Fetch Tasks Error:", e);
        if (window.logError) window.logError("FetchTasks", e);
    } finally { setSyncStatus(false); }
}

window.updateTaskProjectFilter = function() {
    const filterSelect = document.getElementById('taskProjectFilter');
    if (!filterSelect) return;
    
    const currVal = filterSelect.value;
    let html = '<option value="">顯示所有專案之任務</option>';
    
    const projs = window.allProjects || [];
    const custs = window.allCustomers || [];
    
    projs.forEach(p => {
        const cust = custs.find(c => c.customerId === p.customerId);
        const custName = cust ? (cust.nickname || cust.companyName) : '';
        const label = custName ? `${p.projectName} (${custName})` : p.projectName;
        html += `<option value="${p.projectId}">${label}</option>`;
    });
    
    filterSelect.innerHTML = html;
    if (currVal) filterSelect.value = currVal;
    filterSelect.onchange = window.filterTasksByProject;
}

window.filterTasksByProject = function() {
    const filterSelect = document.getElementById('taskProjectFilter');
    const pid = filterSelect ? filterSelect.value : '';
    
    if (pid) {
        window.currentFilteredTasks = (window.allTasks || []).filter(t => t.projectId === pid);
    } else {
        window.currentFilteredTasks = [...(window.allTasks || [])];
    }
    renderTasksList(!!pid);
}

function renderTasksList(draggable = false) {
    const list = document.getElementById('taskList');
    if (!list) return;
    list.innerHTML = '';
    
    const tasks = window.currentFilteredTasks || [];
    if (tasks.length === 0) {
        list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 2rem;">尚無任務紀錄</li>`;
        return;
    }
    
    tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.padding = '1rem';
        li.style.borderBottom = '1px solid var(--border)';
        li.style.gap = '1rem';
        if (draggable) {
            li.draggable = true;
            li.style.cursor = 'grab';
        }
        
        li.dataset.rowIndex = t.rowIndex;
        li.dataset.taskId = t.taskId;
        
        const gripStyle = draggable ? 'color: var(--text-muted); cursor: grab;' : 'color: transparent;';
        const checkIcon = t.isCompleted ? 'check-square' : 'square';
        const textStyle = t.isCompleted ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: var(--text-main); font-weight: 500;';
        const completedBtnStyle = t.isCompleted ? 'color: #06C755;' : 'color: var(--text-muted);';
        
        li.innerHTML = `
            <i data-lucide="grip-vertical" class="drag-handle" style="${gripStyle}"></i>
            <button type="button" onclick="toggleTaskCompletion(${t.rowIndex})" style="background:none; border:none; padding:0; display:flex; align-items:center; cursor:pointer; ${completedBtnStyle}">
                <i data-lucide="${checkIcon}" style="width:20px;height:20px;"></i>
            </button>
            <div style="flex: 1; ${textStyle}">${t.taskName || ''} <span style="font-size: 0.75rem; color: #a0aec0; margin-left: 8px;">(${t.projectId})</span></div>
            <button type="button" class="remove-btn-dense" onclick="deleteTask(${t.rowIndex})" title="刪除"><i data-lucide="trash-2"></i></button>
        `;
        list.appendChild(li);
    });
    
    if (window.lucide) lucide.createIcons();
    if (draggable) initDragAndDrop(list);
}

// --- Drag and Drop Logic ---
function initDragAndDrop(listElement) {
    let draggedItem = null;
    listElement.querySelectorAll('.task-item').forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedItem = this;
            setTimeout(() => this.style.opacity = '0.5', 0);
        });
        item.addEventListener('dragend', function() {
            setTimeout(() => {
                this.style.opacity = '1';
                draggedItem = null;
                saveTasksOrder();
            }, 0);
        });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('dragenter', function(e) {
            e.preventDefault();
            this.style.background = '#f8fafc';
        });
        item.addEventListener('dragleave', function() {
            this.style.background = 'white';
        });
        item.addEventListener('drop', function(e) {
            this.style.background = 'white';
            if (this !== draggedItem) {
                let allItems = Array.from(listElement.querySelectorAll('.task-item'));
                let draggedIdx = allItems.indexOf(draggedItem);
                let targetIdx = allItems.indexOf(this);
                if (draggedIdx < targetIdx) {
                    listElement.insertBefore(draggedItem, this.nextSibling);
                } else {
                    listElement.insertBefore(draggedItem, this);
                }
            }
        });
    });
}

async function saveTasksOrder() {
    const list = document.getElementById('taskList');
    if (!list) return;
    const updates = [];
    list.querySelectorAll('.task-item').forEach((item, index) => {
        updates.push({ rowIndex: parseInt(item.dataset.rowIndex), order: index });
        const t = window.allTasks.find(x => x.rowIndex == item.dataset.rowIndex);
        if (t) t.order = index;
    });
    window.allTasks.sort((a,b) => a.order - b.order);
    setSyncStatus(true);
    try {
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'update_tasks_order', updates })
        });
    } catch (e) {
        console.error("Order update failed:", e);
    } finally {
        setSyncStatus(false);
    }
}

// --- CRUD ---

window.showTaskEditorModal = function(prefillProjectId = '') {
    try {
        console.log(">> showTaskEditorModal initiated...", prefillProjectId);
        
        // 1. Find modal and show it IMMEDIATELY
        const modal = document.getElementById('taskModal');
        if (!modal) {
            Swal.fire('系統錯誤', '找不到 taskModal 元素，請檢查 HTML 結構', 'error');
            return;
        }
        modal.classList.add('active');
        console.log(">> Modal overlay activated.");

        // 2. Clear previous state and show diagnostic alert
        window.alert("JS TRIGGERED - 即將載入任務資料...");
        
        if (typeof window.closeAllModals === 'function') {
            try { 
                // Don't close our own modal we just opened!
                // window.closeAllModals(); 
            } catch(e) { console.warn("closeAllModals skip", e); }
        }
        
        const rowIndexEl = document.getElementById('taskRowIndex');
        const taskIdEl = document.getElementById('taskIdField');
        const taskNameEl = document.getElementById('taskName');
        const pSelect = document.getElementById('taskProjectId');

        if (rowIndexEl) rowIndexEl.value = '';
        if (taskIdEl) taskIdEl.value = 'T-' + new Date().getTime();
        if (taskNameEl) taskNameEl.value = '';
        
        // 3. Populate project list with extreme caution
        if (pSelect) {
            let html = '<option value="">請選擇專案...</option>';
            const projs = window.allProjects || [];
            const custs = window.allCustomers || [];
            
            if (!Array.isArray(projs)) {
                console.error("allProjects is not an array:", projs);
            } else {
                projs.forEach(p => {
                    if (!p || !p.projectId) return;
                    const cust = Array.isArray(custs) ? custs.find(c => c && c.customerId === p.customerId) : null;
                    const custName = cust ? (cust.nickname || cust.companyName) : '';
                    const label = custName ? `${p.projectName} (${custName})` : p.projectName;
                    html += `<option value="${p.projectId}">${label}</option>`;
                });
            }
            pSelect.innerHTML = html;
            
            if (prefillProjectId) {
                pSelect.value = prefillProjectId;
            } else {
                const filter = document.getElementById('taskProjectFilter');
                if (filter && filter.value) pSelect.value = filter.value;
            }
        }
        
        // Final check
        if (window.lucide) lucide.createIcons();
        console.log(">> showTaskEditorModal completed successfully.");

    } catch (e) {
        if (window.logError) window.logError("showTaskEditorModal", e);
        else {
            console.error("Critical showTaskEditorModal Error:", e);
            Swal.fire('執行錯誤', e.message, 'error');
        }
    }
}

window.closeTaskModal = function() {
    const modal = document.getElementById('taskModal');
    if (modal) modal.classList.remove('active');
}

window.submitTaskEditor = async function() {
    try {
        const rowIndex = document.getElementById('taskRowIndex').value;
        const taskId = document.getElementById('taskIdField').value;
        const projectId = document.getElementById('taskProjectId').value;
        const taskName = document.getElementById('taskName').value.trim();
        
        if (!projectId || !taskName) {
            Swal.fire('錯誤', '請選擇專案並填寫任務內容', 'warning');
            return;
        }
        
        let maxOrder = 0;
        const tasks = window.currentFilteredTasks || [];
        if (tasks.length > 0) {
            maxOrder = Math.max(...tasks.map(t => t.order || 0)) + 1;
        }
        
        const task = {
            taskId,
            projectId,
            taskName,
            isCompleted: false,
            order: maxOrder,
            rowIndex: rowIndex ? parseInt(rowIndex) : null
        };
        
        setSyncStatus(true);
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task })
        });
        const json = await res.json();
        if (json.success) {
            Swal.fire({ icon: 'success', title: '任務已儲存', timer: 1000, showConfirmButton: false });
            window.closeTaskModal();
            window.fetchTasks();
        } else {
            Swal.fire('錯誤', json.error || '儲存失敗', 'error');
        }
    } catch (e) {
        if (window.logError) window.logError("submitTaskEditor", e);
        else console.error(e);
    } finally {
        setSyncStatus(false);
    }
}

window.toggleTaskCompletion = async function(rowIndex) {
    const t = (window.allTasks || []).find(x => x.rowIndex == rowIndex);
    if (!t) return;
    
    t.isCompleted = !t.isCompleted;
    
    // Optimistic UI update
    if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
    
    setSyncStatus(true);
    try {
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task: t })
        });
    } catch (e) {
        console.error("Toggle completion error", e);
    } finally {
        setSyncStatus(false);
    }
}

window.deleteTask = function(rowIndex) {
    Swal.fire({
        title: '確定要刪除這筆任務？',
        text: "刪除後無法還原",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消'
    }).then(async (result) => {
        if (result.isConfirmed) {
            setSyncStatus(true);
            try {
                const res = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST', mode: 'cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'delete_task', rowIndex: parseInt(rowIndex) })
                });
                const json = await res.json();
                if (json.success) {
                    window.allTasks = (window.allTasks || []).filter(x => x.rowIndex != rowIndex);
                    if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
                } else {
                    Swal.fire('錯誤', json.error || '刪除失敗', 'error');
                }
            } catch (e) {
                console.error("Delete Task Error:", e);
            } finally {
                setSyncStatus(false);
            }
        }
    });
}
