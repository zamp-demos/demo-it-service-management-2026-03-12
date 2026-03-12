try { require('dotenv').config(); } catch(e) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.VITE_MODEL || 'gemini-2.5-flash';

const PUBLIC_DATA_DIR = path.join(__dirname, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const BASE_PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'base_processes.json');
const SIGNALS_FILE = path.join(__dirname, 'interaction-signals.json');
const KB_FILE = path.join(__dirname, 'src/data/knowledgeBase.md');
const FEEDBACK_QUEUE_PATH = path.join(PUBLIC_DATA_DIR, 'feedbackQueue.json');
const KB_VERSIONS_PATH = path.join(PUBLIC_DATA_DIR, 'kbVersions.json');
const SNAPSHOTS_DIR = path.join(PUBLIC_DATA_DIR, 'snapshots');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

let state = { sent: false, confirmed: false, signals: {} };
let runningProcesses = new Map();

// Startup initialization
if (!fs.existsSync(PROCESSES_FILE)) {
    try {
        const base = fs.readFileSync(BASE_PROCESSES_FILE, 'utf8');
        fs.writeFileSync(PROCESSES_FILE, base);
    } catch(e) {
        fs.writeFileSync(PROCESSES_FILE, '[]');
    }
}
if (!fs.existsSync(SIGNALS_FILE)) fs.writeFileSync(SIGNALS_FILE, '{}');
if (!fs.existsSync(FEEDBACK_QUEUE_PATH)) fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
if (!fs.existsSync(KB_VERSIONS_PATH)) fs.writeFileSync(KB_VERSIONS_PATH, '[]');
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

function serveStatic(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html', '.js': 'application/javascript', '.jsx': 'application/javascript',
        '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf',
        '.webm': 'video/webm', '.md': 'text/markdown', '.cjs': 'application/javascript'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    if (fs.existsSync(filePath)) {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404, corsHeaders);
        res.end('Not found');
    }
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const cleanPath = url.pathname;

    // GET /reset
    if (req.method === 'GET' && cleanPath === '/reset') {
        state = { sent: false, confirmed: false, signals: {} };
        console.log('Demo Reset Triggered');

        fs.writeFileSync(SIGNALS_FILE, JSON.stringify({}, null, 4));

        runningProcesses.forEach((proc) => {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch(e) {}
        });
        runningProcesses.clear();

        exec('pkill -9 -f "node(.*)simulation_scripts" || true', (err) => {
            setTimeout(() => {
                // No cases — reset to empty
                const base = fs.existsSync(BASE_PROCESSES_FILE)
                    ? fs.readFileSync(BASE_PROCESSES_FILE, 'utf8')
                    : '[]';
                fs.writeFileSync(PROCESSES_FILE, base);
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
                fs.writeFileSync(KB_VERSIONS_PATH, '[]');

                // No simulation scripts to launch yet
                console.log('Reset complete — no cases loaded');
            }, 1000);
        });

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // GET /email-status
    if (req.method === 'GET' && cleanPath === '/email-status') {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sent: state.sent }));
        return;
    }

    // POST /email-status
    if (req.method === 'POST' && cleanPath === '/email-status') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try { const p = JSON.parse(body); state.sent = p.sent; } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // GET /signal-status
    if (req.method === 'GET' && cleanPath === '/signal-status') {
        try {
            const signals = JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8'));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify(signals));
        } catch(e) {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end('{}');
        }
        return;
    }

    // POST /signal
    if (req.method === 'POST' && cleanPath === '/signal') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const p = JSON.parse(body);
                const signals = fs.existsSync(SIGNALS_FILE) ? JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8')) : {};
                signals[p.signal] = true;
                fs.writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 4));
            } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // POST /api/update-status
    if (req.method === 'POST' && cleanPath === '/api/update-status') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const p = JSON.parse(body);
                const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
                const idx = processes.findIndex(x => x.id === String(p.id));
                if (idx !== -1) {
                    processes[idx].status = p.status;
                    processes[idx].currentStatus = p.currentStatus;
                    fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4));
                }
            } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // POST /api/chat
    if (req.method === 'POST' && cleanPath === '/api/chat') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                let responseText;

                if (parsed.messages && parsed.systemPrompt) {
                    // Work-with-Pace contract
                    const chat = model.startChat({
                        history: parsed.messages.slice(0, -1).map(m => ({
                            role: m.role === 'user' ? 'user' : 'model',
                            parts: [{ text: m.content }]
                        })),
                        systemInstruction: parsed.systemPrompt
                    });
                    const last = parsed.messages[parsed.messages.length - 1];
                    const result = await chat.sendMessage(last.content);
                    responseText = result.response.text();
                } else {
                    // KB chat contract
                    const systemPrompt = `You are a helpful assistant for IT Service Management at Meridian Bank. Use this knowledge base to answer questions:\n\n${parsed.knowledgeBase}`;
                    const history = (parsed.history || []).slice(0, -1).map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    }));
                    const chat = model.startChat({ history, systemInstruction: systemPrompt });
                    const result = await chat.sendMessage(parsed.message);
                    responseText = result.response.text();
                }

                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response: responseText }));
            } catch(e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // POST /api/feedback/questions
    if (req.method === 'POST' && cleanPath === '/api/feedback/questions') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedback, knowledgeBase } = JSON.parse(body);
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                const prompt = `You are helping improve an IT Service Management knowledge base for Meridian Bank.\n\nA user submitted this feedback: "${feedback}"\n\nKnowledge Base content:\n${knowledgeBase}\n\nGenerate exactly 3 clarifying questions to better understand what they want to change. Return as JSON array: ["Q1?", "Q2?", "Q3?"]`;
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                const match = text.match(/\[.*\]/s);
                const questions = match ? JSON.parse(match[0]) : ['Can you clarify?', 'What section?', 'Why?'];
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ questions }));
            } catch(e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // POST /api/feedback/summarize
    if (req.method === 'POST' && cleanPath === '/api/feedback/summarize') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedback, questions, answers, knowledgeBase } = JSON.parse(body);
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                const qaText = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || ''}`).join('\n\n');
                const prompt = `Summarize this feedback into a concise change proposal for the IT Service Management knowledge base.\n\nFeedback: ${feedback}\n\nQ&A:\n${qaText}\n\nProvide a 2-3 sentence summary of what should be changed and why.`;
                const result = await model.generateContent(prompt);
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ summary: result.response.text() }));
            } catch(e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Feedback queue endpoints
    if (cleanPath === '/api/feedback/queue') {
        if (req.method === 'GET') {
            try {
                const q = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ queue: q }));
            } catch(e) {
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ queue: [] }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', () => {
                try {
                    const item = JSON.parse(body);
                    const q = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                    q.push({ ...item, status: 'pending', timestamp: new Date().toISOString() });
                    fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(q, null, 4));
                } catch(e) {}
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            });
            return;
        }
    }

    // DELETE /api/feedback/queue/:id
    if (req.method === 'DELETE' && cleanPath.startsWith('/api/feedback/queue/')) {
        const id = cleanPath.split('/').pop();
        try {
            const q = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            const filtered = q.filter(item => item.id !== id);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(filtered, null, 4));
        } catch(e) {}
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // POST /api/feedback/apply
    if (req.method === 'POST' && cleanPath === '/api/feedback/apply') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedbackId } = JSON.parse(body);
                const q = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                const item = q.find(x => x.id === feedbackId);
                if (!item) throw new Error('Feedback item not found');

                const currentKB = fs.readFileSync(KB_FILE, 'utf8');
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                const prompt = `Update this IT Service Management knowledge base based on the following feedback proposal.\n\nCurrent KB:\n${currentKB}\n\nChange proposal: ${item.summary}\n\nReturn the complete updated knowledge base content only, no preamble.`;
                const result = await model.generateContent(prompt);
                const updatedKB = result.response.text();

                // Save snapshot
                const timestamp = new Date().toISOString();
                const snapId = `v${Date.now()}`;
                const snapFile = `kb_${snapId}.md`;
                const prevFile = `kb_prev_${snapId}.md`;
                fs.writeFileSync(path.join(SNAPSHOTS_DIR, snapFile), updatedKB);
                fs.writeFileSync(path.join(SNAPSHOTS_DIR, prevFile), currentKB);
                fs.writeFileSync(KB_FILE, updatedKB);

                const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
                versions.push({ id: snapId, timestamp, snapshotFile: snapFile, previousFile: prevFile, changes: [item.summary] });
                fs.writeFileSync(KB_VERSIONS_PATH, JSON.stringify(versions, null, 4));

                const updated_q = q.map(x => x.id === feedbackId ? { ...x, status: 'applied' } : x);
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(updated_q, null, 4));

                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, content: updatedKB }));
            } catch(e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // GET /api/kb/content
    if (req.method === 'GET' && cleanPath === '/api/kb/content') {
        try {
            const versionId = url.searchParams.get('versionId');
            let content;
            if (versionId) {
                const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
                const ver = versions.find(v => v.id === versionId);
                if (ver) {
                    content = fs.readFileSync(path.join(SNAPSHOTS_DIR, ver.snapshotFile), 'utf8');
                } else {
                    content = fs.readFileSync(KB_FILE, 'utf8');
                }
            } else {
                content = fs.readFileSync(KB_FILE, 'utf8');
            }
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content }));
        } catch(e) {
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // GET /api/kb/versions
    if (req.method === 'GET' && cleanPath === '/api/kb/versions') {
        try {
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ versions }));
        } catch(e) {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ versions: [] }));
        }
        return;
    }

    // GET /api/kb/snapshot/:filename
    if (req.method === 'GET' && cleanPath.startsWith('/api/kb/snapshot/')) {
        const filename = cleanPath.split('/').pop();
        const snapPath = path.join(SNAPSHOTS_DIR, filename);
        if (fs.existsSync(snapPath)) {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/markdown' });
            res.end(fs.readFileSync(snapPath, 'utf8'));
        } else {
            res.writeHead(404, corsHeaders);
            res.end('Not found');
        }
        return;
    }

    // GET /debug-paths
    if (req.method === 'GET' && cleanPath === '/debug-paths') {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ __dirname, PUBLIC_DATA_DIR, PROCESSES_FILE }));
        return;
    }

    // Static file serving
    const publicDir = path.join(__dirname, 'public');
    let filePath = path.join(publicDir, cleanPath === '/' ? 'index.html' : cleanPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        serveStatic(res, filePath);
    } else {
        serveStatic(res, path.join(publicDir, 'index.html'));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`IT Service Management demo server running on port ${PORT}`);
});
