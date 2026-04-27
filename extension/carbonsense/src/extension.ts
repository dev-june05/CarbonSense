import * as vscode from 'vscode';
import * as http from 'http';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('carbonLinter');
const greenSquiggle = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline wavy #48bb78 2px'
});
let currentPanel: vscode.WebviewPanel | undefined = undefined;

// Node.js HTTP wrapper to bypass TS/fetch issues
function postData(path: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(payload);
        const options = {
            hostname: '127.0.0.1',
            port: 5005,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(dataString)
            },
            timeout: 30000 
        };
        const req = http.request(options, (res: any) => {
            let responseBody = '';
            res.on('data', (chunk: any) => responseBody += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(responseBody)); }
                catch (e) { resolve({ status: 'Error', suggestion: 'Server sent invalid data.' }); }
            });
        });
        req.on('error', reject);
        req.write(dataString);
        req.end();
    });
}

export function activate(context: vscode.ExtensionContext) {
    console.log('>>> EXTENSION WOKE UP! Code Carbon Linter is active.');

    let openDashboardCmd = vscode.commands.registerCommand('carbonsense.showDashboard', () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Beside);
        } else {
            currentPanel = vscode.window.createWebviewPanel(
                'carbonDashboard',
                'CarbonSense Dashboard',
                vscode.ViewColumn.Beside, 
                { enableScripts: true, retainContextWhenHidden: true }
            );

            currentPanel.webview.html = getWebviewContent();
            
            currentPanel.webview.onDidReceiveMessage(
                async message => {
                    if (message.command === 'runBurn') {
                        const editor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'python');
                        if (!editor) {
                            currentPanel?.webview.postMessage({ type: 'burnData', data: { status: 'Error' } });
                            return;
                        }
                        try {
                            const result = await postData('/burn', { code: editor.document.getText() });
                            currentPanel?.webview.postMessage({ type: 'burnData', data: result });
                        } catch (error) {
                            currentPanel?.webview.postMessage({ type: 'burnData', data: { status: 'Error' } });
                        }
                    }

                    if (message.command === 'runRemediate') {
                        const editor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'python');
                        if (!editor) return;
                        const text = editor.document.getText();
                        try {
                            const result = await postData('/chat', { 
                                code: text,
                                history: [], 
                                message: "The current code architecture has been flagged as carbon-intensive. Analyze the logic, explain exactly WHY it is inefficient, and provide a full vectorized GreenOps remediation plan with the optimized code."
                            });
                            currentPanel?.webview.postMessage({ type: 'remediateData', data: result });
                        } catch (error) {
                            currentPanel?.webview.postMessage({ type: 'remediateData', data: { status: 'Error', response: 'Failed to connect to backend.' } });
                        }
                    }

                    if (message.command === 'sendChat') {
                        const editor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'python');
                        const text = editor ? editor.document.getText() : "";
                        try {
                            const result = await postData('/chat', { 
                                code: text,
                                history: message.history,
                                message: message.text
                            });
                            currentPanel?.webview.postMessage({ type: 'chatResponse', data: result });
                        } catch (error) {
                            currentPanel?.webview.postMessage({ type: 'chatResponse', data: { status: 'Error', response: 'Chat connection failed.' } });
                        }
                    }
                },
                undefined,
                context.subscriptions
            );

            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);
        }
    });

    let saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'python') {
            await lintDocument(document);
        }
    });

    context.subscriptions.push(openDashboardCmd, saveListener, diagnosticCollection);
}

async function lintDocument(document: vscode.TextDocument) {
    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];
    const greenHighlights: vscode.DecorationOptions[] = [];

    try {
        const result: any = await postData('/scan', { code: text });

        if (currentPanel) {
            currentPanel.webview.postMessage({ type: 'updateData', data: result });
        }

        if (result.status === 'Dirty' && result.issues) {
            result.issues.forEach((issue: any) => {
                const lineIndex = Math.min(document.lineCount - 1, Math.max(0, issue.line - 1));
                const line = document.lineAt(lineIndex);
                const diagnostic = new vscode.Diagnostic(line.range, issue.message, vscode.DiagnosticSeverity.Information);
                diagnostic.code = "High Carbon Intensity";
                diagnostics.push(diagnostic);
                greenHighlights.push({ range: line.range });
            });
        }
        diagnosticCollection.set(document.uri, diagnostics);
        vscode.window.activeTextEditor?.setDecorations(greenSquiggle, greenHighlights);
    } catch (error) {
        console.error('Failed to reach backend:', error);
    }
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline'; font-src * data: 'unsafe-inline';">
    
    <title>CarbonSense | GreenOps Telemetry</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&family=Inter:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,1,0&display=swap" rel="stylesheet">
    <style>
        :root {
            /* RESTORED SENSORY FONTS */
            --font-head: 'Manrope', sans-serif;
            --font-body: 'Inter', sans-serif;
            --font-mono: Consolas, monospace;

            --bg-base: #0a0a0b; --surface: #111113; --primary: #008a32; --primary-glow: #00e676;
            --text-main: #f0f1f1; --text-muted: #818c8b; --border: rgba(129, 140, 139, 0.1);
            --red: #ef4444; 
            --accent: #22d3ee; --accent-glow: rgba(34, 211, 238, 0.3);
            --shadow-surface: inset 0 1px 3px rgba(129,140,139,0.05);
        }

        body { font-family: var(--font-body); background-color: var(--bg-base); color: var(--text-main); margin: 0; padding: 0; height: 100vh; display: flex; flex-direction: column; background-image: radial-gradient(circle, rgba(129,140,139, 0.05) 1px, transparent 1px); background-size: 24px 24px; overflow: hidden; font-size: 13px;}
        
        .top-nav { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: #000; border-bottom: 1px solid var(--border); z-index: 50; flex-shrink: 0;}
        .nav-brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-head); font-weight: 800; color: var(--primary-glow); text-transform: uppercase; font-size: 1.1em; letter-spacing: -0.5px;}
        .runtime-status { font-size: 0.6em; color: var(--text-muted); font-weight: 700; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 8px;}
        .pulse-dot { width: 6px; height: 6px; background: var(--primary-glow); border-radius: 50%; box-shadow: 0 0 10px var(--primary-glow); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        .tab-nav { display: flex; border-bottom: 1px solid var(--border); background: var(--surface); padding: 0 20px; flex-shrink: 0; box-shadow: var(--shadow-surface);}
        .tab-btn { background: none; border: none; color: var(--text-muted); padding: 12px 20px; font-family: var(--font-head); font-weight: 800; font-size: 0.75em; letter-spacing: 1px; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; text-transform: uppercase; display: flex; align-items: center; gap: 8px;}
        .tab-btn:hover { color: var(--text-main); }
        .tab-btn.active { color: var(--primary-glow); border-bottom: 2px solid var(--primary-glow); text-shadow: 0 0 10px rgba(0, 230, 118, 0.4); }
        .tab-btn span.material-symbols-outlined { font-size: 1.2em; vertical-align: middle;}

        .tab-content { flex-grow: 1; overflow-y: auto; display: none; padding: 20px 30px; box-sizing: border-box; }
        .tab-content.active { display: flex; flex-direction: column; gap: 20px; max-width: 1000px; margin: 0 auto; width: 100%;}

        .btn-universal { border-radius: 4px; font-family: var(--font-head); font-weight: 800; font-size: 0.7em; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; padding: 10px 18px; border: 1px solid transparent;}
        .btn-burn { background: linear-gradient(135deg, #166534 0%, #15803d 100%); color: white; border-color: rgba(21,128,61,0.3);}
        .btn-burn:hover:not(:disabled) { box-shadow: 0 0 15px rgba(22, 101, 52, 0.6); }
        .btn-burn:disabled { background: #202022; color: var(--text-muted); border-color: var(--border); cursor: not-allowed;}

        .btn-remediate { background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%); color: #fff; border-color: rgba(3,105,161,0.3); text-shadow: 0 0 5px rgba(255,255,255,0.4);}
        .btn-remediate:hover:not(:disabled) { box-shadow: 0 0 15px rgba(14, 116, 144, 0.6); }
        .btn-remediate:disabled { opacity: 0.7; cursor: wait; }

        .card { background: linear-gradient(180deg, #161618 0%, #111113 100%); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; box-shadow: var(--shadow-surface), 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;}
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        
        .metric-label { font-size: 0.6em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px; }
        .metric-value { font-family: var(--font-head); font-size: 1.8em; font-weight: 800; display: flex; align-items: baseline; gap: 4px; line-height: 1;}
        .metric-value.teal { color: var(--primary-glow); text-shadow: 0 0 10px rgba(0,230,118,0.3); }
        .metric-value.red { color: var(--red); text-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
        .metric-value.status-text { font-size: 1.3em; margin-top: 5px; text-transform: uppercase; }
        .metric-unit { font-size: 0.4em; color: var(--text-muted); text-transform: uppercase; font-weight: 600;}

        .progress-track { height: 4px; background: #202022; border-radius: 4px; margin-top: 10px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);}
        .progress-fill { height: 100%; transition: width 0.3s; }
        
        .terminal { background: #070708; border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: var(--font-mono); font-size: 0.75em; flex-grow: 1; overflow-y: auto;}
        .term-header { color: var(--primary-glow); font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid rgba(0,230,118,0.1); padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;}
        .term-line { color: var(--text-muted); margin-bottom: 6px; display: flex; gap: 8px; line-height: 1.4;}

        .chat-container { display: flex; flex-direction: column; flex-grow: 1; overflow-y: auto; gap: 14px; padding-bottom: 10px; }
        .chat-msg { display: flex; flex-direction: column; max-width: 85%; padding: 14px 18px; border-radius: 8px; font-size: 0.9em; line-height: 1.6; transition: all 0.2s;}
        
        .chat-msg pre { background: #000; padding: 14px; border-radius: 6px; overflow-x: auto; font-family: var(--font-mono); border: 1px solid rgba(129,140,139,0.1); margin: 12px 0; font-size: 1.1em;}
        .chat-msg code { font-family: var(--font-mono); color: #fff; background: rgba(129,140,139,0.1); padding: 2px 5px; border-radius: 3px; font-size: 0.95em;}
        .chat-msg pre code { background: none; color: #fff; padding: 0; border: none; font-size: 1em;}

        .msg-user { align-self: flex-end; background: #161618; border: 1px solid var(--border); border-bottom-right-radius: 2px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);}
        .msg-ai { align-self: flex-start; background: rgba(34, 211, 238, 0.05); border: 1px solid rgba(34, 211, 238, 0.15); border-bottom-left-radius: 2px; box-shadow: 0 4px 10px rgba(0,0,0,0.15), inset 0 0 10px rgba(34, 211, 238, 0.02);}
        
        .msg-header { font-size: 0.7em; font-family: var(--font-head); font-weight: 800; color: var(--accent); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; letter-spacing: 1px; text-transform: uppercase;}
        .msg-header span { text-shadow: 0 0 10px var(--accent-glow); }
        .msg-header.user { color: var(--text-muted); justify-content: flex-end;}

        .chat-input-area { display: flex; gap: 10px; padding-top: 15px; border-top: 1px solid var(--border); flex-shrink: 0;}
        .chat-input { flex-grow: 1; background: #070708; border: 1px solid var(--border); color: var(--text-main); padding: 14px; border-radius: 6px; font-family: var(--font-body); font-size: 0.9em; resize: none; outline: none; transition: 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);}
        .chat-input:focus { border-color: rgba(34, 211, 238, 0.4); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), 0 0 10px rgba(34, 211, 238, 0.1); }
        
        .btn-send { background: var(--accent); color: #000; border: none; padding: 0 20px; border-radius: 6px; cursor: pointer; font-family: var(--font-head); font-weight: 800; display: flex; align-items: center; transition: 0.2s;}
        .btn-send:hover { background: #93c5fd; box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);}
        .btn-send:disabled { background: #202022; color: var(--text-muted); cursor: wait; }

        .material-symbols-outlined { font-size: 1.3em; vertical-align: middle; }
    </style>
</head>
<body>

    <header class="top-nav">
        <div class="nav-brand"><span class="material-symbols-outlined">energy_program_saving</span> CARBONSENSE</div>
        <div class="runtime-status">GREENOPS RUNTIME: <span id="valTime">IDLE</span> <div class="pulse-dot"></div></div>
    </header>

    <div class="tab-nav">
        <button class="tab-btn active" id="btn-tab-telemetry"><span class="material-symbols-outlined">analytics</span>TELEMETRY DASHBOARD</button>
        <button class="tab-btn" id="btn-tab-ai"><span class="material-symbols-outlined">auto_awesome</span>AI WORKSPACE</button>
    </div>

    <div id="tab-telemetry" class="tab-content active">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="title">
                <h1 id="ui-device" style="font-size: 1.25em; font-family: var(--font-head); font-weight: 800; color: #fff; margin: 0;">Detecting...</h1>
                <p id="ui-cpu" style="margin: 4px 0 0 0; font-size: 0.75em; color: var(--text-main); font-family: var(--font-mono);">Awaiting Telemetry</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="remediateBtn" class="btn-universal btn-remediate" style="display: none;"><span class="material-symbols-outlined">auto_fix_high</span>✨ AI REMEDIATION</button>
                <button id="burnBtn" class="btn-universal btn-burn"><span class="material-symbols-outlined">bolt</span> BURN TEST</button>
            </div>
        </div>

        <div class="grid-3">
            <div class="card">
                <span class="metric-label">Efficiency Index</span>
                <div class="metric-value teal" id="scoreText">-- <span class="metric-unit">IDX</span></div>
                <div class="progress-track"><div class="progress-fill" id="scoreBar" style="width: 0%"></div></div>
            </div>
            <div class="card">
                <span class="metric-label">Status</span>
                <div class="metric-value status-text" id="statusText">Awaiting</div>
            </div>
            <div class="card">
                <span class="metric-label">Architectural Issues</span>
                <div class="metric-value teal" id="valIssues">0 <span class="metric-unit">FOUND</span></div>
            </div>
        </div>

        <div class="card" style="padding: 12px 16px; flex-direction: row; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(0,138,50,0.08) 0%, rgba(10,10,11,1) 60%);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="material-symbols-outlined" style="color: var(--primary-glow); background: rgba(0, 138, 50, 0.1); padding: 8px; border-radius: 4px;">developer_board</span>
                <div>
                    <span class="metric-label" style="margin: 0;">Inference Backend</span>
                    <span id="valHardware" style="font-family: var(--font-head); font-weight: 800; font-size: 1em;">Detecting...</span>
                </div>
            </div>
            <p id="ui-gpu" style="margin: 0; font-size: 0.7em; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase;">Awaiting GPU</p>
        </div>

        <div class="grid-2" style="flex-grow: 1;">
            <div class="card" style="display: flex; flex-direction: column;">
                <span class="metric-label">Execution Energy Draw (mWh)</span>
                <div style="position: relative; width: 100%; flex-grow: 1; min-height: 180px;"><canvas id="energyChart"></canvas></div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div class="card" id="projectionCard" style="border-color: rgba(129, 140, 139, 0.2); transition: all 0.3s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span class="metric-label" id="projectionLabel">Cloud Projection (10k runs/mo)</span>
                            <div style="font-family: var(--font-head); font-size: 1.4em; font-weight: 800; color: var(--text-main)" id="valProjection">Awaiting Burn...</div>
                        </div>
                        <span class="material-symbols-outlined" id="projectionIcon" style="font-size: 2em; color: var(--text-muted);">public</span>
                    </div>
                </div>
                <div class="terminal">
                    <div class="term-header">AST_AUDIT_LOG</div>
                    <div class="term-line" id="logText">Awaiting file save...</div>
                </div>
            </div>
        </div>

        <div class="grid-3" style="margin-top: 10px; flex-shrink: 0;">
            <div class="card" style="padding: 12px; align-items: center; text-align: center;">
                <span class="metric-label" style="margin:0;">Physical Energy</span>
                <div style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em; color: var(--primary-glow);" id="valEnergy">-- mWh</div>
            </div>
            <div class="card" style="padding: 12px; align-items: center; text-align: center;">
                <span class="metric-label" style="margin:0;">CO₂ Emitted</span>
                <div style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em; color: #d27956;" id="valCo2">-- mg</div>
            </div>
            <div class="card" style="padding: 12px; align-items: center; text-align: center;">
                <span class="metric-label" style="margin:0;">Network Latency</span>
                <div style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em;">0.02ms LOCAL</div>
            </div>
        </div>
    </div>

    <div id="tab-ai" class="tab-content" style="height: calc(100vh - 120px); max-height: none;">
        <div class="chat-container" id="chatBox">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); text-align: center; gap: 12px; opacity: 0.5;">
                <span class="material-symbols-outlined" style="font-size: 4em;">robot_2</span>
                <p>Run <b>✨ AI Remediation</b> from the Telemetry Dashboard<br>to generate an optimized architecture and begin a chat session.</p>
            </div>
        </div>

        <div class="chat-input-area">
            <textarea id="chatInput" class="chat-input" rows="2" placeholder="Ask Gemini about the GreenOps architecture..."></textarea>
            <button id="sendChatBtn" class="btn-send"><span class="material-symbols-outlined">send</span></button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let chatHistory = [];

        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.id === 'btn-tab-telemetry' ? 'tab-telemetry' : 'tab-ai';
                document.getElementById(targetId).classList.add('active');
            });
        });

        fetch('http://127.0.0.1:5005/hardware').then(r => r.json()).then(hw => {
            document.getElementById('ui-device').textContent = hw.device;
            document.getElementById('ui-cpu').textContent = hw.cpu;
            document.getElementById('ui-gpu').textContent = hw.gpu;
            document.getElementById('valHardware').textContent = hw.vendor + ' / ' + hw.engine;
        }).catch(err => console.log('Hardware fetch failed.'));
        
        const burnBtn = document.getElementById('burnBtn');
        burnBtn.addEventListener('click', () => {
            burnBtn.disabled = true; burnBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Burning...';
            vscode.postMessage({ command: 'runBurn' });
        });

        const remediateBtn = document.getElementById('remediateBtn');
        remediateBtn.addEventListener('click', () => {
            remediateBtn.disabled = true; remediateBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Analyzing...';
            document.getElementById('btn-tab-ai').click();
            document.getElementById('chatBox').innerHTML = '<div style="text-align: center; margin-top: 20px; color: var(--accent);">Initializing continuous chat...<br>Gemini is reviewing your architecture.</div>';
            chatHistory = []; 
            vscode.postMessage({ command: 'runRemediate' });
        });

        const sendChatBtn = document.getElementById('sendChatBtn');
        const chatInput = document.getElementById('chatInput');
        
        function sendChatMessage() {
            const text = chatInput.value.trim();
            if (!text) return;
            
            addChatMessage('user', text);
            chatInput.value = '';
            sendChatBtn.disabled = true;

            vscode.postMessage({ command: 'sendChat', text: text, history: chatHistory });
            chatHistory.push({role: 'user', text: text});
            addLoadingBubble();
        }

        sendChatBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        function addChatMessage(role, text) {
            const box = document.getElementById('chatBox');
            const isAI = role === 'model';
            
            let parsedText = text;
            try {
                if (typeof marked !== 'undefined') {
                    parsedText = marked.parse(text);
                } else {
                    parsedText = '<pre style="white-space: pre-wrap; color:#fff">' + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</pre>';
                }
            } catch (e) {
                parsedText = '<pre style="white-space: pre-wrap; color:#fff">' + text + '</pre>';
            }

            const msgDiv = document.createElement('div');
            msgDiv.className = "chat-msg " + (isAI ? "msg-ai" : "msg-user");
            
            let headerHTML = "";
            if (isAI) {
                headerHTML = '<div class="msg-header"><span class="material-symbols-outlined">auto_awesome</span> GREENOPS AI ASSISTANT</div>';
            } else {
                headerHTML = '<div class="msg-header user">DEVELOPER</div>';
            }

            msgDiv.innerHTML = headerHTML + "<div>" + parsedText + "</div>";
            box.appendChild(msgDiv);
            box.scrollTop = box.scrollHeight;
        }

        function addLoadingBubble() {
            const box = document.getElementById('chatBox');
            const msgDiv = document.createElement('div');
            msgDiv.id = 'loadingBubble';
            msgDiv.className = 'chat-msg msg-ai';
            msgDiv.innerHTML = '<div class="msg-header"><span class="material-symbols-outlined">auto_awesome</span> GREENOPS AI</div><div>Analyzing context...</div>';
            box.appendChild(msgDiv);
            box.scrollTop = box.scrollHeight;
        }
        function removeLoadingBubble() {
            const bubble = document.getElementById('loadingBubble');
            if (bubble) bubble.remove();
        }

        const ctxEnergy = document.getElementById('energyChart').getContext('2d');
        const energyChart = new Chart(ctxEnergy, {
            type: 'bar',
            data: { labels: ['Energy Draw', 'CO₂ Output'], datasets: [{ data: [0, 0], backgroundColor: ['#00e676', '#d27956'], hoverBackgroundColor: ['#fff','#fff'] }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        border: {display: false}, 
                        grid: { color: 'rgba(129,140,139,0.05)' } 
                    }, 
                    x: { border: {display: false}, grid: { display: false } } 
                },
                color: '#818c8b',
                font: { family: 'Inter, sans-serif' }
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;

            if (message.type === 'updateData') {
                const res = message.data;
                const statusEl = document.getElementById('statusText');
                const scoreEl = document.getElementById('scoreText');
                const barEl = document.getElementById('scoreBar');
                
                if (res.status === 'Dirty') {
                    remediateBtn.style.display = 'flex';
                    statusEl.textContent = res.status;
                    statusEl.style.color = 'var(--red)';
                    statusEl.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
                    
                    scoreEl.innerHTML = res.score.toFixed(2) + ' <span class="metric-unit">IDX</span>';
                    scoreEl.className = 'metric-value red'; 
                    
                    barEl.style.width = ((1.0 - res.score) * 100) + '%';
                    barEl.style.background = 'linear-gradient(90deg, #991b1b 0%, #ef4444 100%)';
                    barEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
                } else {
                    remediateBtn.style.display = 'none';
                    statusEl.textContent = res.status;
                    statusEl.style.color = 'var(--primary-glow)';
                    statusEl.style.textShadow = '0 0 10px rgba(0, 230, 118, 0.4)';
                    
                    scoreEl.innerHTML = res.score.toFixed(2) + ' <span class="metric-unit">IDX</span>';
                    scoreEl.className = 'metric-value teal'; 
                    
                    barEl.style.width = ((1.0 - res.score) * 100) + '%';
                    barEl.style.background = 'linear-gradient(90deg, #166534 0%, #00e676 100%)';
                    barEl.style.boxShadow = '0 0 10px rgba(0, 230, 118, 0.4)';
                }
                
                const issues = res.issues ? res.issues.length : 0;
                document.getElementById('valIssues').innerHTML = issues + ' <span class="metric-unit">FOUND</span>';
                document.getElementById('valIssues').className = 'metric-value ' + (issues > 0 ? 'red' : 'teal');

                document.getElementById('logText').innerHTML = res.status === 'Dirty' 
                    ? 'AST parsed. <span style="color: #ef4444; font-weight:700;">Inefficiencies detected.</span> AI REMEDIATION ready.' 
                    : 'AST parsed. <span style="color: var(--primary-glow)">Architecture optimal.</span>';
            }
            
            if (message.type === 'remediateData') {
                const res = message.data;
                remediateBtn.disabled = false; remediateBtn.innerHTML = '<span class="material-symbols-outlined">auto_fix_high</span>✨ AI REMEDIATION';
                document.getElementById('chatBox').innerHTML = ''; 
                
                if (res.status === 'Success') {
                    addChatMessage('model', res.response);
                    chatHistory.push({role: 'model', text: res.response});
                } else {
                    addChatMessage('model', "Remediation failed: " + res.response);
                }
            }

            if (message.type === 'chatResponse') {
                const res = message.data;
                sendChatBtn.disabled = false;
                removeLoadingBubble();
                if (res.status === 'Success') {
                    addChatMessage('model', res.response);
                    chatHistory.push({role: 'model', text: res.response});
                } else {
                    addChatMessage('model', "Gemini failed to connect.");
                }
            }

            if (message.type === 'burnData') {
                const res = message.data;
                burnBtn.disabled = false; burnBtn.innerHTML = '<span class="material-symbols-outlined">bolt</span> BURN TEST';
                if (res.status === 'Burn Complete') {
                    const mwh = (res.energy_kwh * 1000000).toFixed(2);
                    const mg = (res.emissions_kg * 1000000).toFixed(2);
                    document.getElementById('valEnergy').textContent = mwh + ' mWh';
                    document.getElementById('valCo2').textContent = mg + ' mg';
                    
                    energyChart.data.datasets[0].data = [mwh, mg];
                    energyChart.update();
                    
                    const projected = (res.emissions_kg * 1000000).toFixed(2);
                    document.getElementById('valProjection').textContent = projected + ' kg CO₂ / mo';
                    const pc = document.getElementById('projectionCard');
                    const pi = document.getElementById('projectionIcon');
                    if (projected > 5.0) {
                        pc.style.borderColor = 'rgba(239, 68, 68, 0.4)'; pi.style.color = 'var(--red)';
                    } else {
                        pc.style.borderColor = 'rgba(0, 230, 118, 0.4)'; pi.style.color = 'var(--primary-glow)';
                    }
                }
            }
        });
    </script>
</body>
</html>`;
}

export function deactivate() { diagnosticCollection.clear(); }