// Command Data
const commands = [
    { cmd: '/gen', desc: 'Generate or modify code', icon: 'zap' },
    { cmd: '/fix', desc: 'Fix errors from logs', icon: 'wrench' },
    { cmd: '/build', desc: 'Run build scripts', icon: 'package' },
    { cmd: '/tree', desc: 'View folder structure', icon: 'folder-tree' },
    { cmd: '/preview', desc: 'Get demo link', icon: 'external-link' },
    { cmd: '/clear', desc: 'Clear AI context', icon: 'trash-2' },
    { cmd: '/deploy', desc: 'Merge to main', icon: 'rocket' }
];

// UI Elements
const cmdInput = document.getElementById('cmdInput');
const suggestions = document.getElementById('suggestions');
const suggestionsList = document.getElementById('suggestionsList');
const chatArea = document.getElementById('chatArea');
const sendBtn = document.getElementById('sendBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const modalOverlay = document.getElementById('modalOverlay');
const saveSettings = document.getElementById('saveSettings');
const ghTokenInput = document.getElementById('ghToken');
const ghRepoInput = document.getElementById('ghRepo');

// State
let selectedIdx = -1;
let filteredCommands = [];
let isProcessing = false;

// Load Settings
const loadSettings = () => {
    ghTokenInput.value = localStorage.getItem('asdf_gh_token') || '';
    ghRepoInput.value = localStorage.getItem('asdf_gh_repo') || '';
};

const saveConfig = () => {
    localStorage.setItem('asdf_gh_token', ghTokenInput.value);
    localStorage.setItem('asdf_gh_repo', ghRepoInput.value);
    settingsModal.classList.add('hidden');
    addMessage('system', 'Settings saved successfully');
};

// Utilities
const addMessage = (type, text) => {
    const div = document.createElement('div');
    div.className = `flex ${type === 'user' ? 'justify-end' : 'justify-start'} w-full`;
    
    const inner = document.createElement('div');
    inner.className = `message-bubble p-4 rounded-2xl ${
        type === 'user' 
        ? 'bg-indigo-600 rounded-tr-none text-white' 
        : type === 'system' 
        ? 'bg-slate-800 rounded-tl-none text-slate-300 border border-white/5'
        : 'bg-emerald-600 rounded-tl-none text-white'
    }`;
    
    inner.innerHTML = text.replace(/\n/g, '<br>');
    div.appendChild(inner);
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
    
    // Refresh icons if any (though currently none in messages)
    if (window.lucide) lucide.createIcons();
};

const showSuggestions = (filter = '') => {
    filteredCommands = commands.filter(c => c.cmd.includes(filter));
    if (filteredCommands.length === 0) {
        suggestions.style.display = 'none';
        return;
    }

    suggestionsList.innerHTML = filteredCommands.map((c, i) => `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 cursor-pointer transition-colors ${i === selectedIdx ? 'bg-white/10 border-l-4 border-indigo-500' : ''}" onclick="selectCommand('${c.cmd}')">
            <div class="p-2 bg-indigo-500/20 rounded-lg"><i data-lucide="${c.icon}" class="w-4 h-4 text-indigo-400"></i></div>
            <div class="flex-1">
                <div class="text-sm font-bold text-white">${c.cmd}</div>
                <div class="text-[10px] text-slate-400">${c.desc}</div>
            </div>
        </div>
    `).join('');
    
    suggestions.style.display = 'block';
    lucide.createIcons();
};

const selectCommand = (cmd) => {
    cmdInput.value = cmd + ' ';
    suggestions.style.display = 'none';
    cmdInput.focus();
};

const sendCommand = async () => {
    const text = cmdInput.value.trim();
    if (!text || isProcessing) return;

    const token = localStorage.getItem('asdf_gh_token');
    const repo = localStorage.getItem('asdf_gh_repo');

    if (!token || !repo) {
        settingsModal.classList.remove('hidden');
        return;
    }

    addMessage('user', text);
    cmdInput.value = '';
    isProcessing = true;
    sendBtn.disabled = true;

    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'ai_command',
                client_payload: { command: text }
            })
        });

        if (response.ok) {
            addMessage('system', 'Brain activated! Waiting for AI process...');
            pollStatus();
        } else {
            const err = await response.json();
            addMessage('system', `Error: ${err.message || 'Failed to trigger workflow'}`);
            isProcessing = false;
            sendBtn.disabled = false;
        }
    } catch (e) {
        addMessage('system', `Network Error: ${e.message}`);
        isProcessing = false;
        sendBtn.disabled = false;
    }
};

const pollStatus = async () => {
    const repo = localStorage.getItem('asdf_gh_repo');
    const token = localStorage.getItem('asdf_gh_token');
    
    const interval = setInterval(async () => {
        try {
            // Using raw content to get latest status.json
            const response = await fetch(`https://api.github.com/repos/${repo}/contents/status.json`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3.raw' },
                cache: 'no-store'
            });
            
            if (response.ok) {
                const data = await response.json();
                updateUIStatus(data.status);
                
                if (data.status === 'success' || data.status === 'error') {
                    if (data.status === 'success') addMessage('ai', `✓ Brain Tasks Completed Successfully!`);
                    else addMessage('system', `⚠ AI Error occurred. Check logs.`);
                    
                    isProcessing = false;
                    sendBtn.disabled = false;
                    clearInterval(interval);
                }
            }
        } catch (e) {
            console.error('Polling error', e);
        }
    }, 5000);
};

const updateUIStatus = (status) => {
    const colors = {
        'running': 'bg-blue-400',
        'success': 'bg-emerald-400',
        'error': 'bg-rose-400',
        'idle': 'bg-slate-500'
    };
    statusDot.className = `w-2 h-2 rounded-full ${colors[status] || 'bg-slate-500'}`;
    statusText.innerText = status;
};

// Event Listeners
cmdInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.startsWith('/')) {
        showSuggestions(val.split(' ')[0]);
    } else {
        suggestions.style.display = 'none';
    }
});

cmdInput.addEventListener('keydown', (e) => {
    if (suggestions.style.display === 'block') {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIdx = (selectedIdx + 1) % filteredCommands.length;
            showSuggestions(cmdInput.value.split(' ')[0]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIdx = (selectedIdx - 1 + filteredCommands.length) % filteredCommands.length;
            showSuggestions(cmdInput.value.split(' ')[0]);
        } else if (e.key === 'Enter' && selectedIdx !== -1) {
            e.preventDefault();
            selectCommand(filteredCommands[selectedIdx].cmd);
        }
    } else if (e.key === 'Enter') {
        sendCommand();
    }
});

sendBtn.addEventListener('click', sendCommand);
settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
modalOverlay.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettings.addEventListener('click', saveConfig);

// Setup
loadSettings();
if (!localStorage.getItem('asdf_gh_token')) {
    setTimeout(() => settingsModal.classList.remove('hidden'), 500);
}
addMessage('system', 'Welcome to ASDF Framework. Configure your Repo and Token to start.');
updateUIStatus('idle');
