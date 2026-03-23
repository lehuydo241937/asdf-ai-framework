// Command Registry
const commands = [
    { cmd: '/gen', desc: 'Generate and push code to target', icon: 'sparkles' },
    { cmd: '/fix', desc: 'Auto-fix target from error logs', icon: 'wrench' },
    { cmd: '/tree', desc: 'Explore target structure', icon: 'folder-tree' },
    { cmd: '/preview', desc: 'Generate target preview URL', icon: 'external-link' },
    { cmd: '/build', desc: 'Run build on target repo', icon: 'box' }
];

// UI Hooks
const input = document.getElementById('input');
const targetRepoIn = document.getElementById('target-repo');
const suggestions = document.getElementById('suggestions');
const list = document.getElementById('suggestions-list');
const log = document.getElementById('log');
const sendBtn = document.getElementById('send-btn');
const configBtn = document.getElementById('config-btn');
const configOverlay = document.getElementById('config-overlay');
const closeConfig = document.getElementById('close-config');
const saveBtn = document.getElementById('save-config');
const tokenIn = document.getElementById('gh-token');
const selfRepoIn = document.getElementById('self-repo');
const statusDot = document.getElementById('status-dot');
const statusMsg = document.getElementById('status-msg');
const repoBadge = document.getElementById('repo-badge');

let selectedIdx = -1;
let filteredCmds = [];
let isPolling = false;

// Config Management
const loadConfig = () => {
    tokenIn.value = localStorage.getItem('asdf_token') || '';
    selfRepoIn.value = localStorage.getItem('asdf_self_repo') || '';
    targetRepoIn.value = localStorage.getItem('asdf_target_repo') || '';
    if (localStorage.getItem('asdf_self_repo')) {
        repoBadge.innerText = localStorage.getItem('asdf_self_repo');
        repoBadge.classList.remove('hidden');
    }
};

const saveConfig = () => {
    localStorage.setItem('asdf_token', tokenIn.value);
    localStorage.setItem('asdf_self_repo', selfRepoIn.value);
    localStorage.setItem('asdf_target_repo', targetRepoIn.value);
    configOverlay.classList.add('hidden');
    addLog('system', 'Configuration synchronized.');
};

// UI Logging
const addLog = (type, text) => {
    const div = document.createElement('div');
    div.className = `flex ${type === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-300`;
    
    const inner = document.createElement('div');
    inner.className = `max-w-[85%] px-5 py-4 text-sm rounded-[1.5rem] border ${
        type === 'user' 
        ? 'bg-zinc-100 text-zinc-950 border-white/5 rounded-tr-none' 
        : 'bg-zinc-900 border-white/5 text-zinc-400 font-mono text-[10px] leading-relaxed rounded-tl-none' 
    }`;
    
    // Auto-link repos and highlight paths
    inner.innerHTML = text.replace(/\n/g, '<br>').replace(/ {4}/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    div.appendChild(inner);
    log.appendChild(div);
    log.scrollIntoView({ behavior: 'smooth', block: 'end' });
};

// Command Suggestions Logic
const showSuggestions = (filter = '') => {
    filteredCmds = commands.filter(c => c.cmd.includes(filter));
    if (filteredCmds.length === 0) {
        suggestions.classList.add('hidden');
        return;
    }

    list.innerHTML = filteredCmds.map((c, i) => `
        <div class="px-5 py-3 flex items-center gap-4 cursor-pointer transition-colors ${i === selectedIdx ? 'suggestion-active' : 'hover:bg-white/5'}" onclick="handleCommandSelect('${c.cmd}')">
            <div class="w-8 h-8 bg-zinc-800 rounded-xl flex items-center justify-center text-indigo-400">
                <i data-lucide="${c.icon}" class="w-4 h-4"></i>
            </div>
            <div class="flex-1">
                <p class="text-xs font-bold text-white">${c.cmd}</p>
                <p class="text-[9px] text-zinc-500 uppercase tracking-tighter">${c.desc}</p>
            </div>
        </div>
    `).join('');
    
    suggestions.classList.remove('hidden');
    lucide.createIcons();
};

const handleCommandSelect = (cmd) => {
    input.value = cmd + ' ';
    suggestions.classList.add('hidden');
    input.focus();
};

// GitHub Dispatch
const executeDispatch = async () => {
    const cmdText = input.value.trim();
    if (!cmdText) return;

    const token = localStorage.getItem('asdf_token');
    const selfRepo = localStorage.getItem('asdf_self_repo');
    const targetRepo = targetRepoIn.value.trim();

    if (!token || !selfRepo) {
        configOverlay.classList.remove('hidden');
        return;
    }

    addLog('user', cmdText);
    input.value = '';
    sendBtn.disabled = true;

    try {
        const response = await fetch(`https://api.github.com/repos/${selfRepo}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'ai_command',
                client_payload: { 
                    command: cmdText,
                    target_repo: targetRepo
                }
            })
        });

        if (response.ok) {
            addLog('system', `Dispatch authorized. Target: ${targetRepo || '[Self]'}\nInitializing ASDF v2.0 Runner...`);
            if (!isPolling) startPolling();
        } else {
            const error = await response.json();
            addLog('system', `Dispatch Error: ${error.message}`);
            sendBtn.disabled = false;
        }
    } catch (e) {
        addLog('system', `Protocol Failure: ${e.message}`);
        sendBtn.disabled = false;
    }
};

// Real-time Status Polling
const startPolling = () => {
    isPolling = true;
    const token = localStorage.getItem('asdf_token');
    const selfRepo = localStorage.getItem('asdf_self_repo');

    const poll = async () => {
        try {
            const response = await fetch(`https://api.github.com/repos/${selfRepo}/contents/status.json`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3.raw' },
                cache: 'no-store'
            });
            
            if (response.ok) {
                const statusData = await response.json();
                updateStatusUI(statusData);
                
                if (statusData.status === 'success' || statusData.status === 'error') {
                    addLog('system', `Brain Engine Status: [${statusData.status.toUpperCase()}]\nMessage: ${statusData.last_message}`);
                    sendBtn.disabled = false;
                    isPolling = false;
                    clearInterval(pollTimer);
                }
            }
        } catch (e) {}
    };

    const pollTimer = setInterval(poll, 4000);
    poll(); // Initial check
};

const updateStatusUI = (data) => {
    statusMsg.innerText = data.last_message || 'Connected';
    const statusColors = {
        'idle': 'bg-zinc-600',
        'processing': 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]',
        'success': 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]',
        'error': 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]'
    };
    statusDot.className = `w-2.5 h-2.5 rounded-full pulse-dot ${statusColors[data.status] || 'bg-zinc-600'}`;
};

// Event Listeners
input.addEventListener('input', (e) => {
    if (e.target.value.startsWith('/')) {
        showSuggestions(e.target.value.split(' ')[0]);
    } else {
        suggestions.classList.add('hidden');
    }
});

input.addEventListener('keydown', (e) => {
    if (!suggestions.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIdx = (selectedIdx + 1) % filteredCmds.length;
            showSuggestions(input.value.split(' ')[0]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIdx = (selectedIdx - 1 + filteredCmds.length) % filteredCmds.length;
            showSuggestions(input.value.split(' ')[0]);
        } else if (e.key === 'Enter' && selectedIdx !== -1) {
            e.preventDefault();
            handleCommandSelect(filteredCmds[selectedIdx].cmd);
            selectedIdx = -1;
        } else if (e.key === 'Enter') {
            executeDispatch();
        }
    } else if (e.key === 'Enter') {
        executeDispatch();
    }
});

sendBtn.addEventListener('click', executeDispatch);
configBtn.addEventListener('click', () => configOverlay.classList.remove('hidden'));
closeConfig.addEventListener('click', () => configOverlay.classList.add('hidden'));
saveBtn.addEventListener('click', saveConfig);
targetRepoIn.addEventListener('change', () => localStorage.setItem('asdf_target_repo', targetRepoIn.value));

// Bootstrap
loadConfig();
if (!localStorage.getItem('asdf_token') || !localStorage.getItem('asdf_self_repo')) {
    setTimeout(() => configOverlay.classList.remove('hidden'), 500);
}
addLog('system', 'ASDF v2.0 Control Center Initialized.\nMulti-Repo Support Active.');
startPolling();
