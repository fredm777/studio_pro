// Tasks Management - Sub-view Pattern & Smart Midpoint Sorting
// ==========================================

window.allTasks = window.allTasks || [];
window.currentFilteredTasks = window.currentFilteredTasks || [];
window.taskStatusFilters = { complete: true, incomplete: true };

window.fetchTasks = async function() {
    // 1. Load from cache first for instant UI
    const cached = getCache('tasks');
    if (cached) {
        window.allTasks = cached.map(t => initializeTaskWeight(t));
        renderTasksList();
    }

    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_all_tasks' })
        });
        const json = await res.json();
        if (json.success) {
            window.allTasks = (json.data || []).map(t => initializeTaskWeight(t));
            setCache('tasks', window.allTasks);
            if (typeof window.updateTaskProjectFilter === 'function') window.updateTaskProjectFilter();
            if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
        }
    } catch(e) { 
        console.error("Fetch Tasks Error:", e);
        if (window.logError) window.logError("FetchTasks", e);
    } finally { setSyncStatus(false); }
}

/**
 * Auto-initialize tasks without weights and dates
 */
function initializeTaskWeight(t) {
    if (!t.orderWeight) {
        // Fallback: Use current date or rowIndex as starting point
        const now = new Date();
        const baseTime = now.getTime();
        t.orderWeight = baseTime + (t.rowIndex || 0) * 1000;
        if (!t.taskDate) t.taskDate = now.toISOString().split('T')[0];
        if (!t.taskTime) t.taskTime = "09:00";
    }
    return t;
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
}

window.toggleStatusFilter = function(type) {
    window.taskStatusFilters[type] = !window.taskStatusFilters[type];
    
    const btnId = type === 'complete' ? 'filterComplete' : 'filterIncomplete';
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.toggle('active', window.taskStatusFilters[type]);
    }
    
    window.filterTasksByProject();
}

window.filterTasksByProject = function() {
    const filterSelect = document.getElementById('taskProjectFilter');
    const pid = filterSelect ? filterSelect.value : '';
    
    let filtered = window.allTasks || [];
    
    // 1. Project Filter
    if (pid) {
        filtered = filtered.filter(t => t.projectId === pid);
    }
    
    // 2. Status Filter
    filtered = filtered.filter(t => {
        if (t.isCompleted && !window.taskStatusFilters.complete) return false;
        if (!t.isCompleted && !window.taskStatusFilters.incomplete) return false;
        return true;
    });
    
    window.currentFilteredTasks = filtered;
    renderTasksList(true); 
}

function renderTasksList(draggable = false) {
    const list = document.getElementById('taskList');
    const container = document.getElementById('tasksListView');
    if (!list || !container) return;
    
    // Ensure we are in list view
    if (container.classList.contains('active')) {
        list.innerHTML = '';
        
        const tasks = window.currentFilteredTasks || [];
        if (tasks.length === 0) {
            list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 5rem 2rem;">
                <i data-lucide="inbox" style="width: 48px; height: 48px; opacity: 0.2; margin-bottom: 1rem;"></i>
                <p>尚無符合條件的任務紀錄</p>
            </li>`;
            if (window.lucide) lucide.createIcons();
            return;
        }
        
        tasks.forEach(t => {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.padding = '1rem 1.25rem';
            li.style.borderBottom = '1px solid var(--border)';
            li.style.gap = '1rem';
            if (draggable) {
                li.draggable = true;
            }
            
            li.dataset.rowIndex = t.rowIndex;
            li.dataset.taskId = t.taskId;
            li.dataset.orderWeight = t.orderWeight;
            
            const project = (window.allProjects || []).find(p => p.projectId === t.projectId);
            const customer = project ? (window.allCustomers || []).find(c => c.customerId === project.customerId) : null;
            const custName = customer ? (customer.nickname || customer.companyName) : '未知';
            
            const displayTaskName = `${custName}_${t.taskName || ''}`;
            const displayTime = t.taskDate ? `<span style="font-size: 0.75rem; color: var(--text-muted); background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${t.taskDate} ${t.taskTime || ''}</span>` : '';
            
            const checkIcon = t.isCompleted ? 'check-circle-2' : 'circle';
            const checkColor = t.isCompleted ? 'color: #06C755;' : 'color: #cbd5e1;';
            const textStyle = t.isCompleted ? 'text-decoration: line-through; color: var(--text-muted); opacity: 0.7;' : 'color: var(--text-main); font-weight: 500;';
            
            li.innerHTML = `
                <div class="drag-handle" style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; color: #cbd5e1; cursor: grab;">
                    <i data-lucide="grip-vertical" style="width:16px;height:16px;"></i>
                </div>
                <div class="task-check-wrapper" onclick="toggleTaskCompletion(${t.rowIndex})" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:28px; height:28px; ${checkColor}">
                    <i data-lucide="${checkIcon}" style="width:20px;height:20px;"></i>
                </div>
                <div class="task-content-area" style="flex: 1; display:flex; flex-direction:column; gap: 4px; ${textStyle}">
                    <div style="font-size: 0.9375rem;">${displayTaskName}</div>
                    <div style="display:flex; align-items:center; gap: 0.5rem;">
                        ${displayTime}
                    </div>
                </div>
                <button type="button" class="action-btn-sub" onclick="deleteTask(${t.rowIndex})" title="刪除" style="border:none; background:none; color: #94a3b8; cursor:pointer;">
                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
            `;
            
            li.ondblclick = (e) => {
                if (e.target.closest('button') || e.target.closest('.drag-handle')) return;
                showTaskEditorPage(t);
            };
            
            list.appendChild(li);
        });
        
        if (window.lucide) lucide.createIcons();
        if (draggable) initDragAndDrop(list);
    }
}

// --- Smart Midpoint Sorting Logic ---
function initDragAndDrop(listElement) {
    let draggedItem = null;
    listElement.querySelectorAll('.task-item').forEach(item => {
        item.addEventListener('dragstart', function() {
            draggedItem = this;
            setTimeout(() => this.style.opacity = '0.5', 0);
        });
        item.addEventListener('dragend', function() {
            this.style.opacity = '1';
            draggedItem = null;
        });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('dragenter', function(e) {
            e.preventDefault();
            this.classList.add('drag-over-marker');
        });
        item.addEventListener('dragleave', function() {
            this.classList.remove('drag-over-marker');
        });
        item.addEventListener('drop', function(e) {
            this.classList.remove('drag-over-marker');
            if (this === draggedItem) return;

            const allItems = Array.from(listElement.querySelectorAll('.task-item'));
            const draggedIdx = allItems.indexOf(draggedItem);
            const targetIdx = allItems.indexOf(this);
            
            // Move item in DOM
            if (draggedIdx < targetIdx) {
                listElement.insertBefore(draggedItem, this.nextSibling);
            } else {
                listElement.insertBefore(draggedItem, this);
            }
            
            // Re-calculate weights based on neighbors
            calculateNewWeight(draggedItem);
        });
    });
}

/**
 * The Midpoint Logic core
 */
async function calculateNewWeight(item) {
    const prev = item.previousElementSibling;
    const next = item.nextElementSibling;
    
    let newWeight;
    const BOUNDARY_MS = 30 * 60 * 1000; // 30 minutes

    if (!prev && !next) {
        newWeight = Date.now();
    } else if (!prev) {
        // Top of list
        newWeight = parseFloat(next.dataset.orderWeight) - BOUNDARY_MS;
    } else if (!next) {
        // Bottom of list
        newWeight = parseFloat(prev.dataset.orderWeight) + BOUNDARY_MS;
    } else {
        // Midpoint
        newWeight = (parseFloat(prev.dataset.orderWeight) + parseFloat(next.dataset.orderWeight)) / 2;
    }

    item.dataset.orderWeight = newWeight;
    
    // Update the task object and sync to backend
    const task = window.allTasks.find(t => t.rowIndex == item.dataset.rowIndex);
    if (task) {
        task.orderWeight = newWeight;
        
        // Auto-update task date/time based on the weight if needed (Visual feedback)
        const d = new Date(newWeight);
        task.taskDate = d.toISOString().split('T')[0];
        task.taskTime = d.toTimeString().split(' ')[0].substring(0, 5);
        
        // Finalize sorting and refresh
        window.allTasks.sort((a,b) => a.orderWeight - b.orderWeight);
        window.filterTasksByProject();
        
        // Sync
        setSyncStatus(true);
        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST', mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'save_task', task })
            });
            setCache('tasks', window.allTasks);
        } catch (e) {
            console.error("Order sync failed", e);
        } finally {
            setSyncStatus(false);
        }
    }
}

// --- CRUD ---

window.setTaskEditorStatus = function(isCompleted) {
    const el = document.getElementById('taskIsCompleted');
    if (el) el.value = String(isCompleted);
    
    // Update UI
    const iCont = document.getElementById('statusIncomplete');
    const cCont = document.getElementById('statusComplete');
    if (iCont && cCont) {
        if (isCompleted) {
            iCont.classList.remove('active');
            cCont.classList.add('active');
            cCont.querySelector('i').setAttribute('data-lucide', 'square-check');
            iCont.querySelector('i').setAttribute('data-lucide', 'square');
        } else {
            iCont.classList.add('active');
            cCont.classList.remove('active');
            cCont.querySelector('i').setAttribute('data-lucide', 'square');
            iCont.querySelector('i').setAttribute('data-lucide', 'square');
        }
        if (window.lucide) lucide.createIcons();
    }
}

window.showTaskEditorPage = function(task = null) {
    switchSubView('tasks', 'edit');
    
    const form = document.getElementById('taskEditorForm');
    const title = document.getElementById('taskEditorTitle');
    const pSelect = document.getElementById('taskProjectId');
    
    if (!form || !pSelect) return;
    
    // 1. Reset
    form.reset();
    document.getElementById('taskError').innerText = '';
    
    // 2. Populate Project Dropdown (Exclude Completed)
    let html = '<option value="">請選擇進行中的專案...</option>';
    const projs = window.allProjects || [];
    const custs = window.allCustomers || [];
    
    projs.forEach(p => {
        // User Requirement: Exclude completed projects
        if (p.isCompleted === true || String(p.isCompleted).toLowerCase() === 'true') {
            // But if we are EDITING a task belonging to a completed project, we should keep it visible
            if (!task || task.projectId !== p.projectId) return;
        }
        
        const cust = custs.find(c => c.customerId === p.customerId);
        const custNickname = cust ? (cust.nickname || cust.companyName) : '';
        html += `<option value="${p.projectId}">${p.projectName} (${custNickname})</option>`;
    });
    pSelect.innerHTML = html;

    if (task) {
        // Edit Mode
        console.log(">> Populating Task Editor with:", task);
        title.innerText = '編輯任務';
        document.getElementById('taskRowIndex').value = task.rowIndex;
        document.getElementById('taskIdField').value = task.taskId;
        document.getElementById('taskOrderWeight').value = task.orderWeight;
        document.getElementById('taskName').value = task.taskName || '';
        document.getElementById('taskDate').value = task.taskDate || '';
        document.getElementById('taskTime').value = task.taskTime || '';
        pSelect.value = task.projectId;
        
        window.setTaskEditorStatus(task.isCompleted === true || String(task.isCompleted).toLowerCase() === 'true');
    } else {
        // New Mode
        title.innerText = '新增任務';
        document.getElementById('taskRowIndex').value = '';
        document.getElementById('taskIdField').value = 'T-' + Date.now();
        document.getElementById('taskOrderWeight').value = '';
        
        window.setTaskEditorStatus(false);
        
        const now = new Date();
        document.getElementById('taskDate').value = now.toISOString().split('T')[0];
        document.getElementById('taskTime').value = "09:00";
        
        // Auto-select project filter if active
        const filter = document.getElementById('taskProjectFilter');
        if (filter && filter.value) pSelect.value = filter.value;
    }
}

window.submitTaskEditor = async function(event) {
    if (event) event.preventDefault();
    
    try {
        const rowIndex = document.getElementById('taskRowIndex').value;
        const task = {
            taskId: document.getElementById('taskIdField').value,
            projectId: document.getElementById('taskProjectId').value,
            taskName: document.getElementById('taskName').value.trim(),
            isCompleted: document.getElementById('taskIsCompleted').value === 'true',
            orderWeight: parseFloat(document.getElementById('taskOrderWeight').value) || Date.now(),
            taskDate: document.getElementById('taskDate').value,
            taskTime: document.getElementById('taskTime').value,
            rowIndex: rowIndex ? parseInt(rowIndex) : null
        };
        
        if (!task.projectId || !task.taskName) {
            document.getElementById('taskError').innerText = '請完整填寫專案與內容';
            return;
        }
        
        setSyncStatus(true);
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task })
        });
        const json = await res.json();
        if (json.success) {
            Toast.fire({ icon: 'success', title: '任務已儲存' });
            switchSubView('tasks', 'list');
            window.fetchTasks();
        } else {
            document.getElementById('taskError').innerText = json.error || '儲存失敗';
        }
    } catch (e) {
        console.error(e);
        if (window.logError) window.logError("submitTaskEditor", e);
    } finally {
        setSyncStatus(false);
    }
}

window.toggleTaskCompletion = async function(rowIndex) {
    const t = (window.allTasks || []).find(x => x.rowIndex == rowIndex);
    if (!t) return;
    
    t.isCompleted = !t.isCompleted;
    window.filterTasksByProject();
    
    setSyncStatus(true);
    try {
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task: t })
        });
        setCache('tasks', window.allTasks);
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
                    window.filterTasksByProject();
                    setCache('tasks', window.allTasks);
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
