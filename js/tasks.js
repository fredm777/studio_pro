// Tasks Management - Sub-view Pattern with Inline Editing
// ==========================================

window.allTasks = window.allTasks || [];
window.currentFilteredTasks = window.currentFilteredTasks || [];
window.taskStatusFilters = { complete: true, incomplete: true };

window.fetchTasks = async function () {
    console.log(">> Fetching Tasks...");
    
    // 1. Load from cache first for instant UI
    const cached = getCache('tasks');
    if (cached) {
        window.allTasks = cached.map(t => initializeTaskWeight(t));
        if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
        else renderTasksList();
    }

    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'get_tasks',
                username: (window.currentUser ? window.currentUser.username : '')
            })
        });
        
        const json = await res.json();
        console.log(">> Tasks Fetch Response:", json); 
        
        if (json.success) {
            // Support multiple data keys
            const taskData = json.tasks || json.data;
            
            if (taskData && Array.isArray(taskData)) {
                window.allTasks = taskData.map(t => initializeTaskWeight(t));
                setCache('tasks', window.allTasks);
                console.log(`>> Tasks Loaded: ${window.allTasks.length} items.`);
            } else {
                console.warn(">> Tasks Success but data missing/empty:", json);
            }
            
            if (typeof window.updateTaskProjectFilter === 'function') window.updateTaskProjectFilter();
            if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
        } else {
            console.error(">> Tasks Fetch Failed:", json.error);
            if (json.error) Toast.fire({ icon: 'error', title: '任務讀取失敗', text: json.error });
        }
    } catch (e) {
        console.error("Fetch Tasks Error:", e);
        // Do not alert on every network flick, but log it
    } finally { 
        setSyncStatus(false); 
    }
}

/**
 * Auto-initialize tasks with weights and IDs
 */
function initializeTaskWeight(t) {
    // 1. Normalize ID
    if (!t.taskId) {
        t.taskId = t.id || 'T-' + (t.rowIndex || (Date.now() + Math.random().toString(36).substr(2, 5)));
    }
    
    // 2. Normalize Project Association
    t.projectId = String(t.projectId || t.project_id || t.projectID || "");
    
    // 3. Normalize Boolean Completion State (Handle Strings like "TRUE" or 1)
    const rawCompleted = t.isCompleted || t.completed || t.is_completed;
    t.isCompleted = (rawCompleted === true || rawCompleted === 'TRUE' || rawCompleted === 'true' || rawCompleted === 1 || rawCompleted === '1');
    
    // 4. Normalize Weights and Dates
    t.orderWeight = parseFloat(t.orderWeight || t.order_weight || 0);
    if (!t.orderWeight) {
        const now = new Date();
        t.orderWeight = now.getTime() + (parseInt(t.rowIndex) || 0) * 1000;
        if (!t.taskDate) t.taskDate = now.toISOString().split('T')[0];
        if (!t.taskTime) t.taskTime = "09:00";
    }
    
    return t;
}

window.updateTaskProjectFilter = function () {
    const filterSelect = document.getElementById('taskProjectFilter');
    if (!filterSelect) return;
    const currVal = filterSelect.value;
    
    let html = '<option value="">所有專案</option>'; // Match phrasing for consistency
    const projs = window.allProjects || [];
    const custs = window.allCustomers || [];

    projs.forEach(p => {
        const cust = custs.find(c => String(c.customerId) === String(p.customerId));
        const custName = cust ? (cust.nickname || cust.companyName) : '';
        const truncName = (p.projectName && p.projectName.length > 8) ? p.projectName.substring(0, 8) + "..." : p.projectName;
        html += `<option value="${p.projectId}">${truncName} ${custName ? '(' + custName + ')' : ''}</option>`;
    });

    filterSelect.innerHTML = html;
    if (currVal) filterSelect.value = currVal;
}

window.toggleStatusFilter = function (type) {
    window.taskStatusFilters[type] = !window.taskStatusFilters[type];
    const btnId = type === 'complete' ? 'filterComplete' : 'filterIncomplete';
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.toggle('active', window.taskStatusFilters[type]);
    window.filterTasksByProject();
}

window.filterTasksByProject = function () {
    const filterSelect = document.getElementById('taskProjectFilter');
    const pid = filterSelect ? filterSelect.value : '';
    let filtered = window.allTasks || [];

    // If pid is not empty, filter by project ID. 
    // If pid is empty string (Default/All), bypass project filtering.
    if (pid && String(pid).trim() !== "") {
        filtered = filtered.filter(t => String(t.projectId) === String(pid));
    }
    
    filtered = filtered.filter(t => {
        if (t.isCompleted && !window.taskStatusFilters.complete) return false;
        if (!t.isCompleted && !window.taskStatusFilters.incomplete) return false;
        return true;
    });

    window.currentFilteredTasks = filtered;
    renderTasksList(true);
}

function renderTasksList(draggable = true) {
    const list = document.getElementById('taskList');
    if (!list) return;

    list.innerHTML = '';
    const tasks = window.currentFilteredTasks || [];
    if (tasks.length === 0) {
        list.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 5rem 2rem;">
            <img src="assets/icons/inbox.svg" style="width: 48px; opacity: 0.2; margin-bottom: 1rem;">
            <p>尚無符合條件的任務紀錄</p>
        </li>`;
        return;
    }

    tasks.forEach((t, index) => {
        try {
            const divider = document.createElement('div');
            divider.className = 'task-divider';
            divider.dataset.index = index;
            list.appendChild(divider);

            const li = document.createElement('li');
            li.className = `task-item ${t.isCompleted ? 'is-completed' : ''}`;
            li.style.cssText = 'display: flex; align-items: center; padding: 10px 0; gap: 12px;';
            if (draggable) li.draggable = true;
            li.dataset.taskId = t.taskId;
            li.dataset.rowIndex = t.rowIndex;
            li.dataset.orderWeight = t.orderWeight;

            // Safe ID comparison
            const project = (window.allProjects || []).find(p => String(p.projectId) === String(t.projectId));
            const customer = project ? (window.allCustomers || []).find(c => String(c.customerId) === String(project.customerId)) : null;
            
            const custDisplay = customer ? (customer.nickname || customer.companyName) : '客戶簡稱...';
            
            // Safe Time Slicing
            let timeStr = String(t.taskTime || "");
            if (timeStr.includes(":") && timeStr.length > 5) timeStr = timeStr.slice(0, 5);
            
            const dtValue = (t.taskDate && t.taskTime) ? `${t.taskDate}T${timeStr}` : '';
            
            const iconColor = "#D5D9DF";
            const checkIcon = t.isCompleted ? 
                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` : 
                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;

            const dateContent = dtValue ? 
                `<input type="datetime-local" class="task-inline-input" value="${dtValue}" onchange="updateTaskFromInline(this, 'datetime', '${t.taskId}')">` :
                `<div class="date-placeholder-row" onclick="this.innerHTML='<input type=\\'datetime-local\\' class=\\'task-inline-input\\' onblur=\\'updateTaskFromInline(this, \\'datetime\\', \\'${t.taskId}\\')\\' autofocus>'; this.querySelector('input').focus();">
                    <img src="assets/icons/search.svg" style="width: 18px; opacity: 0.35;">
                 </div>`;

        li.innerHTML = `
            <div class="drag-handle" style="width: 24px; display: flex; justify-content: center; opacity: 0.12; cursor: grab;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6D82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
            <div style="width: 140px; position: relative;" class="autocomplete-container">
                <input class="task-inline-input customer-search" value="${custDisplay}" 
                       onfocus="showTaskCustomerSearch(this, '${t.taskId}')" 
                       oninput="filterTaskCustomerSearch(this)"
                       placeholder="客戶簡稱...">
            </div>
            <div style="width: 180px;">
                ${dateContent}
            </div>
            <div style="flex: 1;">
                <input class="task-inline-input" value="${t.taskName || ''}" 
                       onblur="updateTaskFromInline(this, 'name', '${t.taskId}')" 
                       placeholder="任務內容...">
            </div>
            <div style="display: flex; gap: 6px; align-items: center; padding-right: 8px;">
                <button class="action-btn-icon" onclick="toggleTaskCompletion('${t.taskId}')" title="完成/取消">
                    ${checkIcon}
                </button>
                <button class="action-btn-icon" onclick="duplicateTask('${t.taskId}')" title="複製項目">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <button class="action-btn-icon" onclick="deleteTask('${t.taskId}')" title="刪除任務">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
            list.appendChild(li);
        } catch (err) {
            console.error(">> Error rendering individual task:", err, t);
        }
    });

    const endDiv = document.createElement('div');
    endDiv.className = 'task-divider';
    list.appendChild(endDiv);

    if (draggable) initDragAndDrop(list);
}

// --- Drag and Drop Logic ---
function initDragAndDrop(listElement) {
    let draggedItem = null;
    const items = listElement.querySelectorAll('.task-item');

    items.forEach(item => {
        item.addEventListener('dragstart', function() {
            draggedItem = this;
            setTimeout(() => this.style.opacity = '0.4', 0);
        });
        item.addEventListener('dragend', function() {
            this.style.opacity = '1';
            draggedItem = null;
            document.querySelectorAll('.task-divider').forEach(d => d.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            document.querySelectorAll('.task-divider').forEach(d => d.classList.remove('drag-over'));
            
            if (e.clientY < midpoint) {
                const prevDiv = this.previousElementSibling;
                if (prevDiv && prevDiv.classList.contains('task-divider')) prevDiv.classList.add('drag-over');
            } else {
                const nextDiv = this.nextElementSibling;
                if (nextDiv && nextDiv.classList.contains('task-divider')) nextDiv.classList.add('drag-over');
            }
        });
        item.addEventListener('drop', function(e) {
            if (!draggedItem || this === draggedItem) return;
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + (rect.height / 2);
            if (e.clientY < midpoint) {
                listElement.insertBefore(draggedItem.previousElementSibling, this);
                listElement.insertBefore(draggedItem, this);
            } else {
                listElement.insertBefore(draggedItem, this.nextElementSibling.nextElementSibling);
                listElement.insertBefore(draggedItem.previousElementSibling, draggedItem);
            }
            calculateNewWeight(draggedItem);
        });
    });
}

async function calculateNewWeight(item) {
    const prev = item.previousElementSibling;
    const next = item.nextElementSibling;
    let newWeight;
    const OFFSET = 30 * 60 * 1000;

    if (!prev && !next) newWeight = Date.now();
    else if (!prev) newWeight = parseFloat(next.dataset.orderWeight) - OFFSET;
    else if (!next) newWeight = parseFloat(prev.dataset.orderWeight) + OFFSET;
    else newWeight = (parseFloat(prev.dataset.orderWeight) + parseFloat(next.dataset.orderWeight)) / 2;

    item.dataset.orderWeight = newWeight;
    const task = window.allTasks.find(t => t.taskId == item.dataset.taskId);
    if (task) {
        task.orderWeight = newWeight;
        window.allTasks.sort((a, b) => a.orderWeight - b.orderWeight);
        window.filterTasksByProject();
        setSyncStatus(true);
        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST', mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'save_task', task })
            });
            setCache('tasks', window.allTasks);
        } catch (e) { console.error(e); } finally { setSyncStatus(false); }
    }
}

// --- Inline Workflow ---

window.addNewTaskInline = function() {
    console.log(">> Adding Task Inline...");
    const now = new Date();
    const ts = Date.now();
    const uniqueId = `T-${ts}-${Math.floor(Math.random() * 1000)}`;
    const newTask = {
        taskId: uniqueId,
        projectId: '', 
        taskName: '',
        isCompleted: 'FALSE',
        orderWeight: ts, 
        taskDate: now.toISOString().split('T')[0],
        taskTime: now.toTimeString().split(' ')[0].substring(0, 5),
        rowIndex: null
    };
    window.allTasks.unshift(newTask);
    window.currentFilteredTasks = [...window.allTasks];
    renderTasksList(true);
    setTimeout(() => {
        const first = document.querySelector('#taskList .task-item');
        if (first) {
            const inp = first.querySelector('.customer-search');
            if (inp) inp.focus();
        }
    }, 150);
}

if (!window.saveLocks) window.saveLocks = new Map();

window.updateTaskFromInline = async function (input, type, taskId) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task) return;

    // Strict Lock: If this task is already being saved (especially for creation), wait.
    if (window.saveLocks.get(taskId)) {
        console.log(`>> Save in progress for ${taskId}, retrying in 500ms...`);
        setTimeout(() => window.updateTaskFromInline(input, type, taskId), 500);
        return;
    }
    
    let changed = false;
    const val = input.value.trim();

    if (type === 'name') {
        if (task.taskName !== val) { task.taskName = val; changed = true; }
    } else if (type === 'datetime') {
        if (!val) {
             // If date is cleared, refresh to show placeholder
             renderTasksList(true);
             return;
        }
        const [d, t] = val.split('T');
        if (task.taskDate !== d || task.taskTime !== t) { task.taskDate = d; task.taskTime = t; changed = true; }
    }

    if (changed) {
        window.saveLocks.set(taskId, true); // Lock via global Map
        setSyncStatus(true);
        try {
            const res = await fetch(GAS_WEB_APP_URL, {
                method: 'POST', mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'save_task', task })
            });
            const json = await res.json();
            if (json.success && json.data) {
                task.rowIndex = json.data.rowIndex; // Essential to prevent duplicates
                setCache('tasks', window.allTasks);
                console.log(`>> Task ${taskId} saved to row ${task.rowIndex}`);
            }
        } catch (e) {
            console.error("Save Task Error:", e);
        } finally { 
            window.saveLocks.delete(taskId); // Unlock
            setSyncStatus(false); 
            renderTasksList(true); 
        }
    } else { 
        renderTasksList(true); 
    }
}

window.showTaskCustomerSearch = function(input, taskId) {
    document.querySelectorAll('.task-autocomplete-dropdown').forEach(d => d.remove());
    const container = input.closest('.autocomplete-container');
    const dropdown = document.createElement('div');
    dropdown.className = 'task-autocomplete-dropdown';
    container.appendChild(dropdown);
    filterTaskCustomerSearch(input);

    const closeListener = (e) => {
        if (!container.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('click', closeListener);
        }
    };
    setTimeout(() => document.addEventListener('click', closeListener), 10);
}

window.filterTaskCustomerSearch = function(input) {
    const dropdown = input.nextElementSibling;
    if (!dropdown || !dropdown.classList.contains('task-autocomplete-dropdown')) return;
    const query = input.value.toLowerCase().trim();
    const projs = window.allProjects || [];
    const custs = window.allCustomers || [];

    const data = projs.map(p => {
        const c = custs.find(curr => curr.customerId === p.customerId);
        return {
            projectId: p.projectId,
            projectName: p.projectName,
            customerName: c ? (c.nickname || c.companyName) : '未知客戶',
            fullSearch: `${p.projectName} ${c ? (c.nickname + ' ' + c.companyName + ' ' + c.phone) : ''}`.toLowerCase()
        };
    });

    const filtered = query ? 
        data.filter(i => i.fullSearch.includes(query)).slice(0, 10) : data.slice(0, 8);

    dropdown.innerHTML = filtered.map(item => `
        <div class="task-autocomplete-item" onclick="selectTaskProjectForInline('${input.closest('.task-item').dataset.taskId}', '${item.projectId}', '${item.customerName}')">
            <div style="font-weight: 600;">${item.customerName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.projectName}</div>
        </div>
    `).join('') || '<div class="task-autocomplete-item" style="color: var(--text-muted); cursor: default;">查無項目</div>';
}

window.selectTaskProjectForInline = async function(taskId, projectId, customerName) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task) return;

    if (window.saveLocks.get(taskId)) {
        console.log(`>> Project Selection: Save in progress, waiting...`);
        setTimeout(() => window.selectTaskProjectForInline(taskId, projectId, customerName), 500);
        return;
    }
    
    task.projectId = projectId;
    window.saveLocks.set(taskId, true); // Lock
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task })
        });
        const json = await res.json();
        if (json.success && json.data) {
            task.rowIndex = json.data.rowIndex;
            setCache('tasks', window.allTasks);
        }
    } catch (e) { 
        console.error("Select Project Error:", e); 
    } finally { 
        window.saveLocks.delete(taskId); // Unlock
        setSyncStatus(false); 
        renderTasksList(true);
    }
}

window.toggleTaskCompletion = async function (taskId) {
    const t = window.allTasks.find(x => x.taskId == taskId);
    if (!t) return;
    t.isCompleted = !t.isCompleted;
    renderTasksList(true);
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task: t })
        });
        const json = await res.json();
        if (json.success && json.data) {
            t.rowIndex = json.data.rowIndex;
            setCache('tasks', window.allTasks);
        }
    } catch (e) { console.error(e); } finally { setSyncStatus(false); }
}

window.deleteTask = function (taskId) {
    const task = window.allTasks.find(x => x.taskId == taskId);
    if (!task) return;
    Swal.fire({
        title: '確定要刪除這筆任務？',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消'
    }).then(async (result) => {
        if (result.isConfirmed) {
            setSyncStatus(true);
            try {
                if (task.rowIndex === null) {
                    window.allTasks = window.allTasks.filter(x => x.taskId != taskId);
                    renderTasksList(true);
                    return;
                }
                const res = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST', mode: 'cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'delete_task', rowIndex: parseInt(task.rowIndex) })
                });
                const json = await res.json();
                if (json.success) {
                    window.allTasks = window.allTasks.filter(x => x.taskId != taskId);
                    renderTasksList(true);
                    setCache('tasks', window.allTasks);
                }
            } catch (e) { console.error(e); } finally { setSyncStatus(false); }
        }
    });
}

window.duplicateTask = async function(taskId) {
    const source = window.allTasks.find(t => t.taskId == taskId);
    if (!source) return;
    const newTask = JSON.parse(JSON.stringify(source));
    newTask.taskId = 'T-' + Date.now();
    newTask.rowIndex = null;
    newTask.orderWeight = source.orderWeight + 1000;
    window.allTasks.push(newTask);
    window.allTasks.sort((a, b) => a.orderWeight - b.orderWeight);
    renderTasksList(true);
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'save_task', task: newTask })
        });
        const json = await res.json();
        if (json.success && json.data) {
            newTask.rowIndex = json.data.rowIndex;
            setCache('tasks', window.allTasks);
        }
        renderTasksList(true);
    } catch (e) { console.error(e); } finally { setSyncStatus(false); }
}
