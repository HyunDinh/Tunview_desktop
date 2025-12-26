const httpPage = document.getElementById('page-http');
const httpTreeRoot = document.getElementById('http-tree-root');
const detailTitle = document.getElementById('detail-title');
const httpDetailContent = document.getElementById('http-detail-content');
const httpSaveBtn = document.getElementById('http-save-btn');
const selectedCountEl = document.getElementById('selected-count');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const terminalOutput = document.getElementById('terminal-output');
const httpSplitter = document.getElementById('http-splitter');
const httpView = httpPage.querySelector('.http-view');
const httpRun = httpPage.querySelector('.http-run');
const selectAllBtn = document.getElementById('select-all-btn');
let currentTestcases = null;
let currentSelectedGroup = null;
let currentSelectedCase = null;
let isRunning = false;
let allTreeCheckboxes = [];
let isResizing = false;
let pageHttpBoundingRect;
let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  durations: [],
  groupResults: {},
};

// TREE
async function loadHttpTree() {
  try {
    const workspaceInfo = await window.ipcAPI.invoke('get-workspace-info');
    if (!workspaceInfo || !workspaceInfo.success) {
      showNotification('Please open a workspace first.', 'warning');
      return;
    }
    currentTestcases = null;

    currentTestcases = await window.ipcAPI.invoke('read-zip-file', window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE);
    if (!currentTestcases || Object.keys(currentTestcases).length === 0) {
      httpTreeRoot.innerHTML = "<li><span class='tree-node'>No testcases found</span></li>";
      updateSelectedCount(0);
      return;
    }
    const treeStructure = buildHttpTree(currentTestcases);
    httpTreeRoot.innerHTML = renderHttpTree(treeStructure, 'module');
    allTreeCheckboxes = httpTreeRoot.querySelectorAll('.tree-checkbox');
    addHttpTreeEvents();
    updateSelectedCount(0);
    resetTerminal();
  } catch (err) {
    showNotification('Error loading testcases: ' + err.message, 'error');
    httpTreeRoot.innerHTML = "<li><span class='tree-node'>Error loading testcases</span></li>";
    updateSelectedCount(0);
  }
}
function buildHttpTree(testcases) {
  const root = {};
  Object.entries(testcases).forEach(([moduleName, groups]) => {
    const moduleNode = {type: 'folder', name: moduleName, children: {}};
    groups.forEach(groupObj => {
      const groupName = groupObj.group;
      const groupNode = {
        type: 'folder',
        name: groupName,
        data: groupObj,
        module: moduleName,
        children: {},
      };
      groupObj.cases.forEach((caseObj, idx) => {
        const caseName = caseObj.name || `Case ${idx + 1}`;
        groupNode.children[caseName] = {
          type: 'file',
          data: caseObj,
          module: moduleName,
          group: groupName,
        };
      });
      moduleNode.children[groupName] = groupNode;
    });
    root[moduleName] = moduleNode;
  });
  return root;
}
function renderHttpTree(node, level = 'module') {
  let html = '';
  Object.entries(node).forEach(([name, data]) => {
    const isFolder = data.type === 'folder';
    const nodeClass = isFolder ? 'folder' : 'file';
    const icon = level === 'module' ? '🏛️ ' : isFolder ? '📁 ' : '📄 ';
    const childrenHtml = isFolder && data.children ? `<ul class="tree-children hidden">${renderHttpTree(data.children, isFolder ? 'group' : 'case')}</ul>` : '';
    const checkboxHtml = `<input type="checkbox" class="tree-checkbox" />`;

    let dragAttr = '';
    if (level === 'module') {
      dragAttr = 'draggable="true" class="draggable-module"';
    } else if (level === 'group' && isFolder) {
      dragAttr = 'draggable="true" class="draggable-group"';
    } else if (!isFolder) {
      dragAttr = 'draggable="true" class="draggable-case"';
    }

    html += `
            <li ${dragAttr}>
                <span class="tree-node ${nodeClass}"
                    data-type="${data.type}"
                    data-module="${level === 'module' ? name : data.module || ''}" 
                    data-group="${isFolder && level === 'group' ? name : data.group || ''}"
                    data-path="${name}"
                    ${!isFolder ? `data-case-module="${data.module}" data-case-group="${data.group}"` : ''}> 
                    ${checkboxHtml}${icon}${name}
                </span>
                ${childrenHtml}
            </li>
        `;
  });
  return html;
}
function addHttpTreeEvents() {
  httpTreeRoot.querySelectorAll('.tree-node.folder').forEach(node => {
    node.addEventListener('click', e => {
      e.stopPropagation();
      const isExpanded = node.classList.contains('expanded');
      const childrenUl = node.parentElement.querySelector('.tree-children');
      if (childrenUl) {
        childrenUl.classList.toggle('hidden');
        node.classList.toggle('expanded');
      }
    });
  });
  httpTreeRoot.querySelectorAll('.tree-node.folder[data-group]').forEach(node => {
    node.addEventListener('click', async e => {
      e.stopPropagation();
      if (node.classList.contains('selected')) return;
      const groupName = node.dataset.group;
      const moduleName = node.closest('li').querySelector('.tree-node[data-module]')?.dataset.module || node.closest('[data-module]').dataset.module;
      const groupData = findGroupData(currentTestcases, moduleName, groupName);
      if (groupData) {
        currentSelectedGroup = groupData;
        currentSelectedCase = null;
        renderCasesTable(groupData.cases);
        detailTitle.textContent = `Cases in "${groupName}" (${groupData.cases.length} cases)`;
        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
      }
    });
  });
  httpTreeRoot.querySelectorAll('.tree-node.file').forEach(node => {
    node.addEventListener('click', async e => {
      e.stopPropagation();
      const caseName = node.dataset.path;
      const moduleName = node.dataset.caseModule;
      const groupName = node.dataset.caseGroup;
      const groupData = findGroupData(currentTestcases, moduleName, groupName);
      const caseData = groupData?.cases.find((c, idx) => {
        const actualName = c.name || `Case ${idx + 1}`;
        return actualName === caseName;
      });
      if (caseData) {
        currentSelectedCase = caseData;
        currentSelectedGroup = null;
        renderCaseDetail(caseData, caseName);
        detailTitle.textContent = `${caseName}`;

        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
      } else {
        console.error('Debug Info:', {caseName, moduleName, groupName, groupData});
        showNotification(`Case not found: ${caseName}`, 'error');
      }
    });
  });
  httpTreeRoot.querySelectorAll('.tree-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', e => {
      const node = e.target.closest('.tree-node');
      if (node.classList.contains('folder')) {
        toggleChildrenCheckboxes(node.parentElement, e.target.checked);
      }
      updateSelectedCount();
    });
  });
  runBtn.addEventListener('click', () => {
    if (isRunning || getSelectedCount() === 0) return;
    startRun();
  });
  stopBtn.addEventListener('click', () => {
    if (!isRunning) return;
    stopRun();
  });
  selectAllBtn.addEventListener('click', toggleSelectAll);
  const draggables = httpTreeRoot.querySelectorAll('.draggable-module');
  let draggedItem = null;
  draggables.forEach(item => {
    item.addEventListener('dragstart', e => {
      draggedItem = item;
      item.classList.add('dragging');
      item.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', async () => {
      item.classList.remove('dragging');
      item.style.opacity = '1';
      if (draggedItem) {
        await syncModuleOrderToJSON();
      }
      draggedItem = null;
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      const target = e.target.closest('.draggable-module');
      if (target && target !== draggedItem) {
        const rect = target.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        httpTreeRoot.insertBefore(draggedItem, next ? target.nextSibling : target);
      }
    });
  });
  const groupDraggables = httpTreeRoot.querySelectorAll('.draggable-group');
  let draggedGroup = null;
  groupDraggables.forEach(group => {
    group.addEventListener('dragstart', e => {
      draggedGroup = group;
      group.style.opacity = '0.4';
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
    });
    group.addEventListener('dragend', async e => {
      e.stopPropagation();
      group.style.opacity = '1';
      if (draggedGroup) {
        await syncModuleOrderToJSON();
      }
      draggedGroup = null;
    });
    group.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target.closest('.draggable-group');
      if (target && target !== draggedGroup && target.parentElement === draggedGroup.parentElement) {
        const rect = target.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        target.parentElement.insertBefore(draggedGroup, next ? target.nextSibling : target);
      }
    });
  });
  const caseDraggables = httpTreeRoot.querySelectorAll('.draggable-case');
  let draggedCase = null;
  caseDraggables.forEach(caseLi => {
    caseLi.addEventListener('dragstart', e => {
      draggedCase = caseLi;
      caseLi.style.opacity = '0.4';
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
    });
    caseLi.addEventListener('dragend', async e => {
      e.stopPropagation();
      caseLi.style.opacity = '1';
      if (draggedCase) {
        await syncModuleOrderToJSON();
      }
      draggedCase = null;
    });
    caseLi.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target.closest('.draggable-case');
      if (target && target !== draggedCase && target.parentElement === draggedCase.parentElement) {
        const rect = target.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        target.parentElement.insertBefore(draggedCase, next ? target.nextSibling : target);
      }
    });
  });
}
function updateSelectedCount(count = null) {
  const actualCount = count !== null ? count : getSelectedCount();
  selectedCountEl.textContent = `Selected: ${actualCount} testcases`;
  runBtn.disabled = actualCount === 0;
}




// RUNNER
function toggleChildrenCheckboxes(parentLi, checked) {
  const childrenCheckboxes = parentLi.querySelectorAll('.tree-checkbox');
  childrenCheckboxes.forEach(childCheckbox => {
    if (childCheckbox !== parentLi.querySelector('.tree-checkbox')) {
      childCheckbox.checked = checked;
      const childNode = childCheckbox.closest('.tree-node');
      if (childNode.classList.contains('folder')) {
        toggleChildrenCheckboxes(childNode.parentElement, checked);
      }
    }
  });
  updateSelectedCount();
}
function getSelectedCount() {
  return httpTreeRoot.querySelectorAll('.tree-node.file .tree-checkbox:checked').length;
}

async function startRun() {
  const selectedTestcases = getSelectedTestcaseConfigs();
  if (selectedTestcases.length === 0) return;
  testStats = {
    total: selectedTestcases.length,
    passed: 0,
    failed: 0,
    durations: [],
    groupResults: {},
  };
  let globalConfig = null;
  try {
    globalConfig = await window.ipcAPI.invoke('get-test-config');
  } catch (e) {
    addToTerminal(`Error fetching global config: ${e.message}`, 'FATAL');
    return;
  }
  if (!globalConfig) {
    addToTerminal(`Global config is empty. Cannot run.`, 'FATAL');
    return;
  }
  isRunning = true;
  runBtn.disabled = true;
  stopBtn.disabled = false;
  resetTerminal();
  const activeEnv = globalConfig.activeEnv || 'N/A';
  addToTerminal(`Starting run for ${selectedTestcases.length} selected testcases... (Env: ${activeEnv})`, 'PROMPT');

  try {
    await window.ipcAPI.invoke('run-http-testcases', selectedTestcases, globalConfig);
  } catch (error) {
    addToTerminal(`Global Run Error: ${error.message}`, 'FATAL');
    stopRun();
  }
}
function stopRun() {
  window.ipcAPI.invoke('stop-http-testcases');
  isRunning = false;
  runBtn.disabled = getSelectedCount() === 0;
  stopBtn.disabled = true;
  addToTerminal(`Run process finished or stopped.`, 'PROMPT');
}
function getSelectedTestcaseConfigs() {
  const selectedCases = [];
  httpTreeRoot.querySelectorAll('.tree-node.file .tree-checkbox:checked').forEach(checkbox => {
    const node = checkbox.closest('.tree-node');

    const caseName = node.dataset.path;
    const moduleName = node.dataset.caseModule;
    const groupName = node.dataset.caseGroup;

    const groupData = findGroupData(currentTestcases, moduleName, groupName);
    const caseData = groupData?.cases.find(c => (c.name || `Case ${groupData.cases.indexOf(c) + 1}`) === caseName);

    if (caseData) {
      selectedCases.push({
        ...caseData,
        parentFolder: moduleName || 'General',
      });
    }
  });
  return selectedCases;
}
function addToTerminal(line, level = 'default') {
  if (level === 'PROMPT' || level === 'default' || level === 'INFO' || level === 'ERROR' || level === 'FATAL') {
    const div = document.createElement('div');
    div.className = `terminal-line log-${level}`;
    if (level === 'PROMPT') {
      div.textContent = `> ${line}`;
    } else if (level === 'INFO' && line.startsWith('Executing case')) {
      div.classList.add('log-progress');
      div.textContent = line;
    } else {
      div.textContent = line;
    }
    terminalOutput.appendChild(div);
  }
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
function renderRunEnd(msg) {
  const caseName = msg.caseName;
  const status = msg.status;
  const payload = msg.payload || {};
  const folderDisplayName = msg.moduleName || 'General';
  const validationResults = payload.validate_results || [];
  const rawResponseBody = payload.httpResponse?.body;
  const failedCaseInputDetails = payload.failedCaseInputDetails;
  const failedCaseResponseDetails = payload.failedCaseResponseDetails;
  const tid = payload.test_id || msg.testId;
  if (status === 'SUCCESS') {
    testStats.passed++;
  } else {
    testStats.failed++;
  }
  if (payload.httpResponse && payload.httpResponse.duration) {
    testStats.durations.push(payload.httpResponse.duration);
  }
  if (!testStats.groupResults[folderDisplayName]) {
    testStats.groupResults[folderDisplayName] = {total: 0, passed: 0, failed: 0};
  }
  testStats.groupResults[folderDisplayName].total++;
  if (status === 'SUCCESS') {
    testStats.groupResults[folderDisplayName].passed++;
  } else {
    testStats.groupResults[folderDisplayName].failed++;
  }
  const summaryDiv = document.createElement('div');
  summaryDiv.className = `log-run-end status-${status}`;
  summaryDiv.textContent = `> [RUNNER] ${caseName} completed. Status: ${status}`;

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'log-details-content';
  const navContainer = document.createElement('div');
  navContainer.style.padding = '5px 10px';
  navContainer.style.borderBottom = '1px solid #333';
  const navBtn = document.createElement('button');
  navBtn.className = 'nav-to-case-btn';
  navBtn.innerHTML = `📍 Navigate to this case (ID: ${tid || 'N/A'})`;
  navBtn.style.cursor = tid ? 'pointer' : 'not-allowed';
  navBtn.onclick = e => {
    e.stopPropagation();
    if (tid) {
      navigateToCase(tid);
    } else {
      showNotification('Cannot find Test ID for this case', 'warning');
    }
  };
  navContainer.appendChild(navBtn);
  detailsDiv.appendChild(navContainer);
  if (validationResults.length > 0) {
    validationResults.forEach(val => {
      const item = document.createElement('div');
      item.className = 'log-validation-item';
      const statusText = val.status || 'N/A';
      const isPassed = statusText === 'Passed' || statusText === 'SUCCESS';
      const icon = isPassed ? '✅' : '❌';
      item.innerHTML = `
        <span class="validation-icon ${isPassed ? 'passed' : 'failed'}">${icon}</span>
        <span class="validation-message">[${statusText}]: ${val.message}</span>
      `;
      detailsDiv.appendChild(item);
    });
  }
  if (status === 'FAILURE' && (failedCaseInputDetails || failedCaseResponseDetails)) {
    const failedSection = document.createElement('div');
    failedSection.className = 'response-body-section failed-details-section';
    failedSection.innerHTML = `
      <h4 class="response-body-header" style="color: #ff9999;">FAILURE DETAILS</h4>
      <pre class="response-body-pre">${(failedCaseInputDetails || '') + (failedCaseResponseDetails || '')}</pre>
    `;
    detailsDiv.appendChild(failedSection);
  } else if (rawResponseBody) {
    const responseSection = document.createElement('div');
    responseSection.className = 'response-body-section';
    let displayBody = rawResponseBody;
    try {
      const parsedBody = JSON.parse(rawResponseBody);
      displayBody = JSON.stringify(parsedBody, null, 2);
    } catch (e) {}

    responseSection.innerHTML = `
      <h4 class="response-body-header">HTTP Response Body</h4>
      <pre class="response-body-pre">${displayBody}</pre>
    `;
    detailsDiv.appendChild(responseSection);
  }

  summaryDiv.addEventListener('click', () => {
    summaryDiv.classList.toggle('open');
    detailsDiv.classList.toggle('show');
  });
  terminalOutput.appendChild(summaryDiv);
  terminalOutput.appendChild(detailsDiv);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
function resetTerminal() {
  terminalOutput.innerHTML = '<div class="terminal-prompt">> Ready to run selected testcases...</div>';
}
function findGroupData(testcases, moduleName, groupName) {
  const groups = testcases[moduleName] || [];
  return groups.find(g => g.group === groupName);
}
window.ipcAPI.on('http-run-update', msg => {
  switch (msg.type) {
    case 'LOG':
      let level = msg.level || 'INFO';
      let content = `[LOG] [${level}] ${msg.content}`;
      if (msg.content && msg.content.startsWith('Executing case') && level === 'INFO') {
        addToTerminal(msg.content, 'INFO');
      } else if (level === 'FATAL' || level === 'ERROR') {
        addToTerminal(content, level);
      } else {
        addToTerminal(content, 'default');
      }
      break;
    case 'RUN_END':
      renderRunEnd(msg);
      break;
    case 'RUN_COMPLETE':
      addToTerminal(`> ${msg.content}`, 'PROMPT');
      renderFinalDashboard();
      stopRun();
      if (typeof showNotification === 'function') {
        showNotification('HTTP Test Scenario Finished!', 'success');
      }
      break;
    case 'RUN_START':
      break;
    case 'RESULT_CASE':
      break;
    default:
      addToTerminal(`[UNKNOWN TYPE] ${JSON.stringify(msg)}`, 'default');
  }
});
function toggleSelectAll() {
  const allFileCheckboxes = httpTreeRoot.querySelectorAll('.tree-node.file .tree-checkbox');
  const currentSelected = getSelectedCount();
  const totalCases = allFileCheckboxes.length;
  const shouldSelect = currentSelected < totalCases;
  allTreeCheckboxes.forEach(checkbox => {
    checkbox.checked = shouldSelect;
  });
  selectAllBtn.textContent = shouldSelect ? 'Deselect All' : 'Select All';
  updateSelectedCount();
}
function renderFinalDashboard() {
  const oldDash = terminalOutput.querySelector('.test-dashboard-container');
  if (oldDash) oldDash.remove();

  const dashboardDiv = document.createElement('div');
  dashboardDiv.className = 'test-dashboard-container';

  let folderRowsHtml = '';
  const resultsEntries = Object.entries(testStats.groupResults);

  if (resultsEntries.length === 0) {
    folderRowsHtml = `<div class="coverage-row"><span class="group-name">No data available</span></div>`;
  } else {
    resultsEntries.forEach(([name, stats]) => {
      const percent = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
      folderRowsHtml += `
            <div class="coverage-row">
                <span class="group-name">📁 ${name}</span>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                    <span class="progress-text">${percent}% Coverage</span>
                </div>
                <div class="group-stats">
                    <span class="total">Total ${stats.total}</span>
                    <span class="passed">Passed ${stats.passed}</span>
                    <span class="failed">Failed ${stats.failed}</span>
                </div>
            </div>`;
    });
  }

  dashboardDiv.innerHTML = `
        <div class="dashboard-coverage-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #fff; font-size: 14px;">Module Coverage</h3>
                <button id="export-report-btn" class="run-btn" style="background-color: #28a745; padding: 5px 12px; font-size: 11px;">
                  📥 Export Report
                </button>
            </div>
            ${folderRowsHtml}
        </div>
        <div class="dashboard-summary-cards">
            <div class="card total-card">
                <div class="label">Total Tests</div>
                <div class="value">${testStats.passed + testStats.failed}</div>
            </div>
            <div class="card passed-card">
                <div class="label">Passed Tests</div>
                <div class="value">${testStats.passed}</div>
            </div>
            <div class="card failed-card">
                <div class="label">Failed Tests</div>
                <div class="value">${testStats.failed}</div>
            </div>
            <div class="card time-card">
                <div class="label">Avg Response Time</div>
                <div class="value">${calculateAvgTime()}ms</div>
            </div>
        </div>
    `;

  terminalOutput.appendChild(dashboardDiv);
  document.getElementById('export-report-btn').addEventListener('click', exportToHtml);

  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
function calculateAvgTime() {
  if (!testStats.durations || testStats.durations.length === 0) return 0;
  const sum = testStats.durations.reduce((a, b) => a + b, 0);
  return Math.round(sum / testStats.durations.length);
}
async function exportToHtml() {
  try {
    const wsNameElement = document.getElementById('workspace-btn');
    const wsName = wsNameElement ? wsNameElement.innerText.replace('▾', '').trim() : 'Unknown Workspace';
    const now = new Date();
    const timestamp = now.toLocaleString();

    // Tạo tên file: [workspaceName_scenario_currentDateTime.html]
    const fileTimestamp = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2) + '_' + ('0' + now.getHours()).slice(-2) + ('0' + now.getMinutes()).slice(-2);
    const fileName = `${wsName}_scenario_${fileTimestamp}.html`;

    // Clone nội dung terminal và xóa các nút bấm không cần thiết
    const terminalClone = terminalOutput.cloneNode(true);
    terminalClone.querySelectorAll('button, .select-all-fake').forEach(el => el.remove());

    const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Report: ${wsName}</title>
    <style>
        :root {
    --bg-main: #0f172a;
    --bg-card: #1e293b;
    --text-main: #f1f5f9;
    --text-dim: #94a3b8;
    --success: #22c55e;
    --fail: #ef4444;
    --warn: #f59e0b;
    --info: #3b82f6;
    --accent: #6366f1;
    --border: #334155;
}

body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background-color: white;
    color: var(--text-main);
    margin: 0; padding: 20px; line-height: 1.5;
}

.container {
    max-width: 75vw;
    margin: 0 auto;
    background: black;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

/* --- 1. DASHBOARD & CARDS --- */
.test-dashboard-container {
    margin-bottom: 30px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.dashboard-summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.card {
    padding: 20px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    text-align: center;
}

.card .label { color: var(--text-dim); font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
.card .value { font-size: 24px; font-weight: bold; }
.passed-card .value { color: var(--success); }
.failed-card .value { color: var(--fail); }

/* --- 2. PROGRESS BARS (Module Coverage) --- */
.coverage-row {
    background: rgba(0,0,0,0.2);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 15px;
}

.group-name { flex: 1; font-weight: 500; font-size: 14px; }

.progress-bar-container {
    flex: 2;
    height: 10px;
    background: #334155;
    border-radius: 5px;
    position: relative;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--success));
    transition: width 0.5s ease;
}

/* --- 3. TERMINAL LINES & LOG LEVELS --- */
.report-body {
    background: #000;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    border: 1px solid var(--border);
}

.terminal-line { margin: 4px 0; border-left: 3px solid transparent; padding-left: 10px; }
.log-INFO { border-left-color: var(--info); color: #e2e8f0; }
.log-ERROR, .log-FATAL { border-left-color: var(--fail); color: #fda4af; }
.log-PROMPT { color: var(--accent); font-weight: bold; margin: 30px 0; }

/* --- 4. RUN END (DROPDOWN) --- */
.log-run-end {
    margin-top: 10px;
    padding: 12px;
    background: #1e293b;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
}

.status-SUCCESS { border-left: 4px solid var(--success); }
.status-FAILURE { border-left: 4px solid var(--fail); }

.log-details-content {
    display: none;
    background: #0f172a;
    border: 1px solid var(--border);
    border-top: none;
    padding: 15px;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
}

.log-details-content.show { display: block; }

/* --- 5. VALIDATION & JSON --- */
.log-validation-item {
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    gap: 10px;
}

.validation-icon.passed { color: var(--success); }
.validation-icon.failed { color: var(--fail); }

.response-body-pre {
    background: #1a1a1a;
    padding: 15px;
    border-radius: 6px;
    color: #a5f3fc;
    overflow-x: auto;
    max-height: 400px;
    border: 1px solid #333;
    font-size: 12px;
}

.nav-to-case-btn {
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    margin-bottom: 10px;
}

/* Hide action buttons in Static Report */
#export-report-btn, .nav-to-case-btn {
    display: none; 
}

.meta-info{
    margin-bottom: 30px;
}

.group-stats{
    width: 30vw;
    display: flex;
    justify-content: space-evenly;
}
    </style>
</head>
<body>
    <div class="container">
        <div class="report-header">
            <div>
                <h1>Tunview Scenario Report</h1>
                <div style="color: var(--info)">Workspace: ${wsName}</div>
            </div>
            <div class="meta-info">
                Executed At: ${timestamp} (MM/DD/YYYY, HH:MM:SS)<br>
                Status: Completed
            </div>
        </div>

        <div class="report-body">
            ${terminalClone.innerHTML}
        </div>
        
        <footer style="margin-top: 50px; text-align: center; color: var(--text-dim); font-size: 12px; padding: 20px; border-top: 1px solid var(--border-color);">
            Generated by Tunview Core Framework &copy; 2025
        </footer>
    </div>

    <script>
        // Xử lý sự kiện click để Dropdown nội dung chi tiết
        document.addEventListener('DOMContentLoaded', () => {
            const summaries = document.querySelectorAll('.log-run-end');
            
            summaries.forEach(summary => {
                summary.addEventListener('click', function() {
                    // Xoay mũi tên
                    this.classList.toggle('active');
                    
                    // Tìm phần tử nội dung ngay kế tiếp
                    const detail = this.nextElementSibling;
                    if (detail && detail.classList.contains('log-details-content')) {
                        detail.classList.toggle('show');
                    }
                });
            });
        });
    </script>
</body>
</html>`;

    // Gọi IPC lưu file
    const result = await window.ipcAPI.invoke('export-report-file', {
      fileName: fileName,
      content: finalHtml,
    });

    if (result.success) showNotification('Report exported successfully!', 'success');
  } catch (err) {
    showNotification('Export failed: ' + err.message, 'error');
  }
}



// DETAIL
function trimFirstLineLeading(text) {
  if (typeof text !== 'string') return text;
  if (!text.includes('\n')) {
    return text.trimStart();
  }
  const lines = text.split('\n');
  if (lines.length > 0) {
    lines[0] = lines[0].trimStart();
  }
  return lines.join('\n');
}
function renderCasesTable(cases) {
  if (!cases || cases.length === 0) {
    httpDetailContent.innerHTML = '<p>No cases in this group.</p>';
    return;
  }
  let tableHtml = `
        <table class="cases-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Method</th>
                    <th>API</th>
                    <th>Body (Preview)</th>
                    <th>Expected Code</th>
                    <th>Auth Token</th>
                    <th>Response Time</th>
                    <th>Full Response</th>
                </tr>
            </thead>
            <tbody>
    `;
  cases.forEach((caseObj, idx) => {
    let bodyPreview = '{}';
    if (caseObj.body) {
      const fullBodyStr = JSON.stringify(caseObj.body, null, 2);
      bodyPreview = trimFirstLineLeading(fullBodyStr).substring(0, 100) + (fullBodyStr.length > 100 ? '...' : '');
    }
    tableHtml += `
            <tr data-case-id="${idx}">
                <td>${caseObj.name || `Case ${idx + 1}`}</td>
                <td>${caseObj.method || 'GET'}</td>
                <td>${caseObj.api || ''}</td>
                <td><pre style="font-size: 11px; margin: 0;">${bodyPreview}</pre></td>
                <td>${caseObj.expected_code || ''}</td>
                <td>${caseObj.auth_token || ''}</td>
                <td>${caseObj.expected_response_time || 'N/A'}</td>
                <td>${caseObj.display_full_response || 'FALSE'}</td>
            </tr>
        `;
  });
  tableHtml += `
            </tbody>
        </table>
    `;
  httpDetailContent.innerHTML = tableHtml;
}
function renderCaseDetail(caseData, caseName) {
  const saveBtn = document.getElementById('http-save-btn');
  if (saveBtn) saveBtn.style.display = 'block';
  const fields = caseData.custom_expected_field ? caseData.custom_expected_field.split('|') : [];
  const datas = caseData.custom_expected_data ? caseData.custom_expected_data.split('|') : [];
  let html = `
    <div class="edit-case-form">
      <div style="display: flex; gap: 10px;">
        <div class="case-field" style="flex: 1;">
          <label>Test ID (Unique):</label>
          <input type="text" id="edit-id" value="${caseData.test_id || ''}" 
                 style="background-color: #1a1a1a; color: #ff9800; font-weight: bold;" 
                 placeholder="e.g. TC_001">
        </div>
        <div class="case-field" style="flex: 2;">
          <label>Case Name:</label>
          <input type="text" id="edit-name" value="${caseData.name || caseName}">
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <div class="case-field" style="flex: 3;">
          <label>API Path:</label>
          <input type="text" id="edit-api" value="${caseData.api || ''}">
        </div>
        <div class="case-field" style="flex: 1;">
          <label>Method:</label>
          <select id="edit-method">
            ${['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => `<option value="${m}" ${caseData.method === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
         <div class="case-field" style="flex: 1;">
          <label>Expected Code:</label>
          <input type="text" id="edit-code" value="${caseData.expected_code || '200'}">
        </div>
        <div class="case-field" style="flex: 1;">
          <label>Auth Type:</label>
          <select id="edit-auth">
            <option value="NONE" ${caseData.auth_token === 'NONE' ? 'selected' : ''}>NONE</option>
            <option value="GET" ${caseData.auth_token === 'GET' ? 'selected' : ''}>GET</option>
            <option value="SET" ${caseData.auth_token === 'SET' ? 'selected' : ''}>SET</option>
          </select>
        </div>
      </div>
      
      <h4 class="section-title">Custom Validations (No "|" allowed)</h4>
      <table id="validation-table-edit" class="cases-table">
        <thead>
          <tr>
            <th style="width: 40%">Field (No Space)</th>
            <th style="width: 50%">Expected Data</th>
            <th style="width: 10%"></th>
          </tr>
        </thead>
        <tbody>
          ${fields
            .map(
              (f, i) => `
            <tr>
              <td><input type="text" class="v-field-edit" value="${f}" placeholder="status"></td>
              <td><input type="text" class="v-data-edit" value="${datas[i] || ''}" placeholder="success"></td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">×</button></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <button type="button" id="add-val-row-edit" class="btn-secondary">+ Add Validation Row</button>
      
      <div class="case-field" style="margin-top:10px">
        <label>Request Body (JSON):</label>
        <textarea id="edit-body" rows="6">${JSON.stringify(caseData.body || {}, null, 2)}</textarea>
      </div>
    </div>
  `;

  document.getElementById('http-detail-content').innerHTML = html;
  document.getElementById('add-val-row-edit').onclick = () => {
    const tbody = document.querySelector('#validation-table-edit tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" class="v-field-edit" placeholder="field_name"></td>
      <td><input type="text" class="v-data-edit" placeholder="value"></td>
      <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">×</button></td>
    `;
    tbody.appendChild(row);
  };
}
function attachValidationInputEvents(inputEl) {
  inputEl.addEventListener('keypress', e => {
    if (e.key === '|') e.preventDefault();
  });
  inputEl.addEventListener('input', e => {
    if (e.target.value.includes('|')) {
      e.target.value = e.target.value.replace(/\|/g, '');
    }
  });
}
function attachNoPipeEvent(row) {
  const inputs = row.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', e => {
      if (e.key === '|') e.preventDefault();
    });
    input.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\|/g, '');
    });
  });
}
function navigateToCase(testId) {
  let targetCase = null;
  let targetModule = '';
  let targetGroupName = '';

  // 1. Tìm thông tin Module/Group dựa trên test_id
  for (const modName in currentTestcases) {
    for (const groupObj of currentTestcases[modName]) {
      const found = groupObj.cases.find(c => String(c.test_id) === String(testId));
      if (found) {
        targetCase = found;
        targetModule = modName;
        targetGroupName = groupObj.group;
        break;
      }
    }
    if (targetCase) break;
  }

  if (!targetCase) {
    showNotification('Case no longer exists in current testcases', 'error');
    return;
  }

  // 2. Tìm các Element trên Tree View
  // Tìm node Module và mở rộng nó
  const modNode = httpTreeRoot.querySelector(`.tree-node[data-module="${targetModule}"][data-type="folder"]`);
  if (modNode && !modNode.classList.contains('expanded')) {
    modNode.click();
  }

  // Đợi một chút để DOM cập nhật (nếu cần), sau đó tìm Group node
  setTimeout(() => {
    const groupNode = httpTreeRoot.querySelector(`.tree-node[data-group="${targetGroupName}"][data-type="folder"]`);
    if (groupNode && !groupNode.classList.contains('expanded')) {
      groupNode.click();
    }

    // 3. Tìm chính xác Case node (file) và click để hiện Detail
    setTimeout(() => {
      const caseNodes = httpTreeRoot.querySelectorAll(`.tree-node.file`);
      const targetNode = Array.from(caseNodes).find(node => {
        // Khớp dựa trên data-path (tên hiển thị) và thông tin group/module
        return node.dataset.caseModule === targetModule && node.dataset.caseGroup === targetGroupName && (node.dataset.path === (targetCase.name || `Case ${targetCase.index + 1}`) || node.innerText.includes(targetCase.name));
      });

      if (targetNode) {
        targetNode.scrollIntoView({behavior: 'smooth', block: 'center'});
        targetNode.click();
        targetNode.style.backgroundColor = '#ff980044';
        setTimeout(() => (targetNode.style.backgroundColor = ''), 2000);
      }
    }, 50);
  }, 50);
}
async function syncModuleOrderToJSON() {
  if (!currentTestcases) return;
  const newOrderedData = {};
  const moduleNodes = httpTreeRoot.querySelectorAll(':scope > .draggable-module');
  moduleNodes.forEach(modLi => {
    const modNode = modLi.querySelector(':scope > .tree-node');
    const moduleName = modNode.dataset.module;
    if (currentTestcases[moduleName]) {
      const newGroupsArray = [];
      const groupNodes = modLi.querySelectorAll(':scope > .tree-children > .draggable-group');
      groupNodes.forEach(groupLi => {
        const groupSpan = groupLi.querySelector(':scope > .tree-node');
        const groupName = groupSpan.dataset.group;
        const originalGroupData = currentTestcases[moduleName].find(g => g.group === groupName);
        if (originalGroupData) {
          const newCasesArray = [];
          const caseNodes = groupLi.querySelectorAll(':scope > .tree-children > .draggable-case > .tree-node');

          caseNodes.forEach(caseSpan => {
            const caseName = caseSpan.dataset.path;
            const originalCaseData = originalGroupData.cases.find((c, idx) => {
              const actualName = c.name || `Case ${idx + 1}`;
              return actualName === caseName;
            });
            if (originalCaseData) {
              newCasesArray.push(originalCaseData);
            }
          });
          newGroupsArray.push({
            ...originalGroupData,
            cases: newCasesArray,
          });
        }
      });
      newOrderedData[moduleName] = newGroupsArray;
    }
  });
  currentTestcases = newOrderedData;
  try {
    const result = await window.ipcAPI.invoke('write-zip-file', {
      fileName: window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE,
      content: currentTestcases,
    });
    if (result && result.success) {
      showNotification('Workspace structure saved successfully.', 'success');
    }
  } catch (err) {
    console.error('Sync failed:', err);
    showNotification('Failed to sync order: ' + err.message, 'error');
  }
}
httpSaveBtn.addEventListener('click', async () => {
  console.log('Save button clicked!');

  if (!currentSelectedCase) {
    showNotification('No case selected!', 'warning');
    return;
  }

  // 1. Lưu lại ID gốc trước khi người dùng kịp sửa trên UI để làm mốc so sánh "chính mình"
  // Nếu chưa có test_id (case mới), ta dùng một giá trị null
  const originalId = currentSelectedCase.test_id;

  const newIdInput = document.getElementById('edit-id').value.trim();
  const newId = isNaN(newIdInput) || newIdInput === '' ? newIdInput : parseInt(newIdInput);

  if (!newId) {
    showNotification('Test ID cannot be empty!', 'error');
    return;
  }

  // 2. Kiểm tra trùng lặp
  let isDuplicate = false;
  let duplicateInfo = '';

  for (const modName in currentTestcases) {
    for (const groupObj of currentTestcases[modName]) {
      for (const c of groupObj.cases) {
        // Chỉ coi là trùng nếu:
        // - ID trong danh sách khớp với ID mới nhập (newId)
        // - VÀ ID đó KHÔNG thuộc về chính case đang sửa (khác originalId)
        if (String(c.test_id) === String(newId) && String(c.test_id) !== String(originalId)) {
          isDuplicate = true;
          duplicateInfo = `Module: ${modName}, Group: ${groupObj.group}`;
          break;
        }
      }
      if (isDuplicate) break;
    }
    if (isDuplicate) break;
  }

  if (isDuplicate) {
    showNotification(`Duplicate Test ID! This ID already exists in [${duplicateInfo}]`, 'error');
    document.getElementById('edit-id').style.border = '2px solid #ff4444';
    return;
  }

  // 3. Thu thập dữ liệu từ giao diện
  const fieldInputs = document.querySelectorAll('.v-field-edit');
  const dataInputs = document.querySelectorAll('.v-data-edit');
  let fieldsArray = [];
  let dataArray = [];

  for (let i = 0; i < fieldInputs.length; i++) {
    const fVal = fieldInputs[i].value.trim();
    const dVal = dataInputs[i].value.trim();
    if (fVal) {
      if (/\s/.test(fVal)) {
        showNotification(`Field "${fVal}" cannot contain spaces!`, 'error');
        return;
      }
      fieldsArray.push(fVal);
      dataArray.push(dVal);
    }
  }

  try {
    // 4. Cập nhật dữ liệu vào object hiện tại
    currentSelectedCase.test_id = newId;
    currentSelectedCase.name = document.getElementById('edit-name').value.trim();
    currentSelectedCase.api = document.getElementById('edit-api').value.trim();
    currentSelectedCase.method = document.getElementById('edit-method').value;
    currentSelectedCase.expected_code = document.getElementById('edit-code').value.trim();
    currentSelectedCase.auth_token = document.getElementById('edit-auth').value;
    currentSelectedCase.custom_expected_field = fieldsArray.join('|');
    currentSelectedCase.custom_expected_data = dataArray.join('|');

    const bodyText = document.getElementById('edit-body').value;
    try {
      currentSelectedCase.body = bodyText ? JSON.parse(bodyText) : {};
    } catch (e) {
      showNotification('Invalid JSON in Request Body!', 'error');
      return;
    }

    // 5. Ghi file ZIP
    const result = await window.ipcAPI.invoke('write-zip-file', {
      fileName: window.PATHS.TVWS_HTTP_SCENARIO_TESTCASE,
      content: currentTestcases,
    });

    if (result && result.success) {
      showNotification('Changes saved successfully!', 'success');
      document.getElementById('edit-id').style.border = '';

      // 6. CẬP NHẬT QUAN TRỌNG:
      // Sau khi loadHttpTree(), toàn bộ currentTestcases được thay mới bằng object mới từ file.
      // Ta cần tìm lại case vừa lưu trong bộ nhớ mới để gán lại cho currentSelectedCase.
      await loadHttpTree();

      let foundNewReference = false;
      for (const mod in currentTestcases) {
        for (const grp of currentTestcases[mod]) {
          const found = grp.cases.find(c => String(c.test_id) === String(newId));
          if (found) {
            currentSelectedCase = found;
            foundNewReference = true;
            break;
          }
        }
        if (foundNewReference) break;
      }
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (err) {
    showNotification('Save failed: ' + err.message, 'error');
  }
});