// Command Registry
const commands = [
    { cmd: '/gen', desc: 'Generate/modify code', icon: 'zap' },
    { cmd: '/fix', desc: 'Fix errors from log', icon: 'wrench' },
    { cmd: '/build', desc: 'Check build integrity', icon: 'package' },
    { cmd: '/tree', desc: 'View source tree', icon: 'folder-tree' },
    { cmd: '/preview', desc: 'Get preview URL', icon: 'external-link' }
];

// Elements
const input = document.getElementById('input');
const suggestions = document.getElementById('suggestions');
const list = document.getElementById('suggestions-list');
const log = document.getElementById('chat-log');
const send = document.getElementById('send');
const settings = document.getElementById('settings-toggle');
const modal = document.getElementById('settings-modal');
const close = document.getElementById('close-modal');
const save = document.getElementById('save-config');
const tokenIn = document.getElementById('gh-token');
const repoIn = document.getElementById('gh-repo');

let currentIdx = -1;
let filtered = [];

// Load config
const loadConfig = () => {
    tokenIn.value = localStorage.getItem('asdf_token') || '';
    repoIn.value = localStorage.getItem('asdf_repo') || '';
};

const saveConfig = () => {
    localStorage.setItem('asdf_token', tokenIn.value);
    localStorage.setItem('asdf_repo', repoIn.value);
    modal.classList.add('hidden');
    addMsg('system', 'Configuration saved.');
};

// Messaging
const addMsg = (type, text) => {
    const div = document.createElement('div');
    div.className = `flex ${type === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-300`;
    
    const inner = document.createElement('div');
    inner.className = `max-w-[85%] p-4 text-sm rounded-3xl ${
        type === 'user' 
        ? 'bg-zinc-100 text-zinc-950 rounded-tr-none' 
        : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none font-mono text-[11px] leading-relaxed' 
    }`;
    
    inner.innerHTML = text.replace(/\n/g, '<br>').replace(/ {4}/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    div.appendChild(inner);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
};

// Suggestions
const showSug = (filter = '') => {
    filtered = commands.filter(c => c.cmd.includes(filter));
    if (filtered.length === 0) {
        suggestions.classList.add('hidden');
        return;
    }

    list.innerHTML = filtered.map((c, i) => `
        <div class="p-3 command-node flex items-center gap-3 cursor-pointer ${i === currentIdx ? 'suggestion-active' : ''}" onclick="selectCmd('${c.cmd}')">
            <div class="p-2 bg-zinc-800 rounded-lg text-indigo-400">
                <i data-lucide="${c.icon}" class="w-4 h-4"></i>
            </div>
            <div class="flex-1">
                <p class="text-sm font-bold">${c.cmd}</p>
                <p class="text-[10px] text-zinc-500">${c.desc}</p>
            </div>
        </div>
    `).join('');
    
    suggestions.classList.remove('hidden');
    lucide.createIcons();
};

const selectCmd = (cmd) => {
    input.value = cmd + ' ';
    suggestions.classList.add('hidden');
    input.focus();
};

// Dispatch
const dispatch = async () => {
    const text = input.value.trim();
    if (!text) return;

    const token = localStorage.getItem('asdf_token');
    const repo = localStorage.getItem('asdf_repo');
    if (!token || !repo) {
        modal.classList.remove('hidden');
        return;
    }

    addMsg('user', text);
    input.value = '';
    send.disabled = true;

    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
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

        if (res.ok) {
            addMsg('system', 'Signal sent. Brain is computing...');
            pollStatus();
        } else {
            const err = await res.json();
            addMsg('system', `Dispatch failed: ${err.message}`);
            send.disabled = false;
        }
    } catch (e) {
        addMsg('system', `Error: ${e.message}`);
        send.disabled = false;
    }
};

const pollStatus = async () => {
    const repo = localStorage.getItem('asdf_repo');
    const token = localStorage.getItem('asdf_token');
    
    const check = async () => {
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/status.json`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3.raw' },
                cache: 'no-store'
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success') {
                    addMsg('system', 'Brain task complete. Ready.');
                    send.disabled = false;
                    return true;
                } else if (data.status === 'error') {
                    addMsg('system', 'Brain encountered an error during task.');
                    send.disabled = false;
                    return true;
                }
            }
        } catch (e) {}
        return false;
    };

    const poller = setInterval(async () => {
        const done = await check();
        if (done) clearInterval(poller);
    }, 5000);
};

// Events
input.addEventListener('input', (e) => {
    if (e.target.value.startsWith('/')) showSug(e.target.value.split(' ')[0]);
    else suggestions.classList.add('hidden');
});

input.addEventListener('keydown', (e) => {
    if (!suggestions.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentIdx = (currentIdx + 1) % filtered.length;
            showSug(input.value.split(' ')[0]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentIdx = (currentIdx - 1 + filtered.length) % filtered.length;
            showSug(input.value.split(' ')[0]);
        } else if (e.key === 'Enter' && currentIdx !== -1) {
            e.preventDefault();
            selectCmd(filtered[currentIdx].cmd);
            currentIdx = -1;
        } else if (e.key === 'Enter') {
            dispatch();
        }
    } else if (e.key === 'Enter') {
        dispatch();
    }
});

send.addEventListener('click', dispatch);
settings.addEventListener('click', () => modal.classList.remove('hidden'));
close.addEventListener('click', () => modal.classList.add('hidden'));
save.addEventListener('click', saveConfig);

// Init
loadConfig();
if (!localStorage.getItem('asdf_token')) {
    setTimeout(() => modal.classList.remove('hidden'), 500);
}
addMsg('system', 'ASDF Terminal Version 1.1 Ready.\nConfigure connection to begin.');
