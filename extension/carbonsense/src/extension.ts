import * as vscode from 'vscode';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('carbonLinter');
const greenSquiggle = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline wavy #48bb78 2px'
});
let currentPanel: vscode.WebviewPanel | undefined = undefined;

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
                { enableScripts: true }
            );

            currentPanel.webview.html = getWebviewContent();
            
            currentPanel.webview.onDidReceiveMessage(
                async message => {
                    // --- ROUTE 1: BURN TEST ---
                    if (message.command === 'runBurn') {
                        const editor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'python');
                        
                        if (!editor) {
                            currentPanel?.webview.postMessage({ type: 'burnData', data: { status: 'Error' } });
                            return;
                        }
                        
                        const text = editor.document.getText();
                        try {
                            const response = await fetch('http://127.0.0.1:5005/burn', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: text })
                            });
                            const result = await response.json();
                            currentPanel?.webview.postMessage({ type: 'burnData', data: result });
                        } catch (error) {
                            currentPanel?.webview.postMessage({ type: 'burnData', data: { status: 'Error' } });
                        }
                    }

                    // --- ROUTE 2: GEMINI AI REMEDIATION ---
                    if (message.command === 'runRemediate') {
                        const editor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'python');
                        if (!editor){
                            return;}
                        
                        const text = editor.document.getText();
                        try {
                            const response = await fetch('http://127.0.0.1:5005/remediate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: text })
                            });
                            const result = await response.json();
                            currentPanel?.webview.postMessage({ type: 'remediateData', data: result });
                        } catch (error) {
                            currentPanel?.webview.postMessage({ type: 'remediateData', data: { status: 'Error', suggestion: 'Failed to connect to backend.' } });
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
        const response = await fetch('http://127.0.0.1:5005/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: text })
        });

        const result: any = await response.json();

        if (currentPanel) {
            currentPanel.webview.postMessage({ type: 'updateData', data: result });
        }

        if (result.status === 'Dirty' && result.issues) {
            result.issues.forEach((issue: any) => {
                const lineIndex = Math.max(0, issue.line - 1); 
                const line = document.lineAt(lineIndex);
                
                const diagnostic = new vscode.Diagnostic(
                    line.range,
                    issue.message,
                    vscode.DiagnosticSeverity.Information 
                );
                diagnostic.code = "High Carbon Intensity";
                diagnostics.push(diagnostic);

                greenHighlights.push({ range: line.range });
            });
        }
        diagnosticCollection.set(document.uri, diagnostics);
        vscode.window.activeTextEditor?.setDecorations(greenSquiggle, greenHighlights);

    } catch (error) {
        console.error('Failed to reach the CarbonSense backend:', error);
    }
}

// 3. The UI HTML
function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CarbonSense | GreenOps Telemetry</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&family=Inter:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,1,0&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #0e0e0e;
            --surface: #131313;
            --primary: #008a32;
            --primary-glow: #00c853;
            --text-main: #e5e2e1;
            --text-muted: #879391;
            --border: rgba(135, 147, 145, 0.1);
            --red: #ef4444;
            --gemini: #60a5fa;
            --font-head: 'Manrope', sans-serif;
            --font-body: 'Inter', sans-serif;
            --font-mono: Consolas, monospace;
        }

        body { 
            font-family: var(--font-body); 
            background-color: var(--bg-base); 
            color: var(--text-main); 
            margin: 0; 
            padding: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background-image: radial-gradient(circle, rgba(0, 138, 50, 0.05) 1px, transparent 1px);
            background-size: 24px 24px;
        }

        .top-nav { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: #161616; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50;}
        .nav-brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-head); font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: -0.5px; font-size: 1.1em;}
        .runtime-status { font-size: 0.6em; color: var(--primary); font-weight: 700; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 8px;}
        .pulse-dot { width: 6px; height: 6px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 8px rgba(0, 138, 50, 0.8); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .container { flex-grow: 1; width: 100%; max-width: 900px; margin: 0 auto; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
        .header-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .title h1 { margin: 0; font-family: var(--font-head); font-size: 1.3em; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; }
        .title p { margin: 2px 0 0 0; font-size: 0.65em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; }

        /* Buttons */
        .btn-burn { 
            background: linear-gradient(135deg, #008a32 0%, #004d26 100%); 
            color: white; border: 1px solid rgba(0, 138, 50, 0.2); 
            padding: 10px 16px; border-radius: 4px; font-family: var(--font-head); font-weight: 800; 
            font-size: 0.7em; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; 
            display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(0, 138, 50, 0.15); transition: 0.2s;
        }
        .btn-burn:hover:not(:disabled) { box-shadow: 0 4px 15px rgba(0, 200, 83, 0.4); }
        .btn-burn:disabled { background: #201f1f; color: var(--text-muted); box-shadow: none; border-color: var(--border); cursor: not-allowed;}

        /* Gemini Button */
        .btn-remediate {
            background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%);
            color: var(--gemini); border: 1px solid rgba(96, 165, 250, 0.2); 
            padding: 10px 16px; border-radius: 4px; font-family: var(--font-head); font-weight: 800; 
            font-size: 0.7em; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; 
            display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(30, 58, 138, 0.2); transition: 0.2s;
        }
        .btn-remediate:hover:not(:disabled) { box-shadow: 0 4px 15px rgba(96, 165, 250, 0.4); border-color: rgba(147, 197, 253, 0.5);}
        .btn-remediate:disabled { opacity: 0.7; cursor: wait; }

        /* Cards & Grid */
        .card { background: linear-gradient(180deg, #2a2a2a 0%, #201f1f 100%); border: 1px solid var(--border); border-radius: 8px; padding: 16px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex-grow: 1; }
        
        .metric-label { font-size: 0.6em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
        .metric-value { font-family: var(--font-head); font-size: 1.6em; font-weight: 800; display: flex; align-items: baseline; gap: 4px; }
        .metric-value.teal { color: var(--primary-glow); text-shadow: 0 0 10px rgba(0, 200, 83, 0.3); }
        .metric-value.red { color: var(--red); text-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
        .metric-unit { font-size: 0.4em; color: var(--text-muted); }

        .progress-track { height: 4px; background: #353534; border-radius: 4px; margin-top: 8px; overflow: hidden; width: 100%; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #008a32 0%, #00c853 100%); box-shadow: 0 0 6px rgba(0, 138, 50, 0.6); transition: width 0.3s ease; }
        
        .terminal { background: #0b0b0b; border: 1px solid rgba(0, 138, 50, 0.1); border-radius: 8px; padding: 16px; font-family: var(--font-mono); font-size: 0.7em; flex-grow: 1; overflow-y: auto; }
        .term-header { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(0, 138, 50, 0.1); padding-bottom: 8px; margin-bottom: 12px; color: var(--primary); font-weight: 700; letter-spacing: 2px; }
        .term-line { color: var(--text-muted); margin-bottom: 6px; display: flex; gap: 8px; }
        .term-time { color: rgba(0, 138, 50, 0.4); }
        .term-active { color: var(--text-main); }
        .term-success { color: var(--primary-glow); }
        
        .blink { animation: blinker 1s linear infinite; }
        @keyframes blinker { 50% { opacity: 0; } }

        .chart-container { position: relative; width: 100%; flex-grow: 1; min-height: 180px; margin-top: 10px; }
        .material-symbols-outlined { font-size: 1.2em; vertical-align: middle; }
    </style>
</head>
<body>

    <header class="top-nav">
        <div class="nav-brand">
            <span class="material-symbols-outlined">energy_program_saving</span> CARBONSENSE
        </div>
        <div class="runtime-status">
            L-RUNTIME: <span id="valTime">IDLE</span> <div class="pulse-dot"></div>
        </div>
    </header>

    <div class="container">
        <div class="header-row">
            <div class="title" style="display: flex; flex-direction: column; gap: 2px;">
                <h1 id="ui-device" style="font-size: 1.2em; color: var(--primary-glow); margin: 0; padding-bottom: 2px;">Detecting Hardware...</h1>
                <p id="ui-cpu" style="margin: 0; font-size: 0.7em; color: var(--text-main); font-family: var(--font-mono);">Awaiting CPU Telemetry</p>
                <p id="ui-gpu" style="margin: 0; font-size: 0.6em; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase;">Awaiting GPU Telemetry</p>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="remediateBtn" class="btn-remediate" style="display: none;">
                    ✨ AI REMEDIATION
                </button>
                <button id="burnBtn" class="btn-burn">
                    <span class="material-symbols-outlined">bolt</span> BURN TEST
                </button>
            </div>
        </div>

        <div class="grid-3">
            <div class="card">
                <span class="metric-label">AI Efficiency Score</span>
                <div class="metric-value teal" id="scoreText">-- <span class="metric-unit">IDX</span></div>
                <div class="progress-track"><div class="progress-fill" id="scoreBar" style="width: 0%"></div></div>
            </div>
            <div class="card">
                <span class="metric-label">Prediction Status</span>
                <div class="metric-value" id="statusText" style="font-size: 1.2em; margin-top: 5px;">Awaiting</div>
            </div>
            <div class="card">
                <span class="metric-label">Syntax Issues</span>
                <div class="metric-value teal" id="valIssues">0 <span class="metric-unit">FOUND</span></div>
            </div>
        </div>

        <div class="card" id="projectionCard" style="border: 1px solid rgba(135, 147, 145, 0.2); transition: all 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span class="metric-label" id="projectionLabel">Cloud-Scale Projection (10k runs/mo)</span>
                    <div style="font-family: var(--font-head); font-size: 1.4em; font-weight: 800; color: var(--text-main)" id="valProjection">
                        Awaiting Telemetry...
                    </div>
                </div>
                <span class="material-symbols-outlined" id="projectionIcon" style="font-size: 2.2em; color: var(--text-muted);">public</span>
            </div>
            <p style="font-size: 0.7em; color: var(--text-muted); margin: 8px 0 0 0;" id="valProjectionSub">
                Run the Hardware Burn Test to calculate the enterprise carbon blast radius.
            </p>
        </div>

        <div class="grid-2">
            <div class="card">
                <div style="display: flex; justify-content: space-between;">
                    <span class="metric-label">Energy Draw (mWh)</span>
                    <span class="metric-label" style="color: var(--primary)">Trending</span>
                </div>
                <div class="chart-container">
                    <canvas id="energyChart"></canvas>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
                <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="material-symbols-outlined" style="color: var(--primary); background: rgba(0, 138, 50, 0.1); padding: 8px; border-radius: 4px;">developer_board</span>
                        <div>
                            <span class="metric-label" style="margin: 0;">Hardware Backend</span>
                            <span id="valHardware" style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em;">INTEL / oneDNN</span>
                        </div>
                    </div>
                </div>

                <div class="terminal" id="terminalBox">
                    <div class="term-header">
                        <span class="material-symbols-outlined" style="font-size: 1em;">terminal</span> AST_AUDIT_LOG
                    </div>
                    <div class="term-line"><span class="term-time">SYS&gt;</span> <span>ONNX Model Loaded.</span></div>
                    <div class="term-line"><span class="term-time">SYS&gt;</span> <span>Hardware telemetry online.</span></div>
                    <div class="term-line" style="align-items: flex-start;"><span class="term-time" id="logTime">WAIT&gt;</span> <span class="term-active" id="logText">Awaiting file save...<span class="blink">_</span></span></div>
                </div>
            </div>
        </div>
        
        <div class="grid-3">
            <div class="card" style="padding: 16px 10px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;">
                <span class="material-symbols-outlined" style="color: var(--primary); font-size: 1.6em;">settings_ethernet</span>
                <span class="metric-label" style="margin:0; margin-top: 4px;">Total Energy</span>
                <div style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em;" id="valEnergy">-- mWh</div>
            </div>
            <div class="card" style="padding: 16px 10px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;">
                <span class="material-symbols-outlined" style="color: #ffb59a; font-size: 1.6em;">heat_pump</span>
                <span class="metric-label" style="margin:0; margin-top: 4px;">Carbon Emitted</span>
                <div style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em;" id="valCo2">-- mg</div>
            </div>
            <div class="card" style="padding: 16px 10px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;">
                <span class="material-symbols-outlined" style="color: var(--primary); font-size: 1.6em;">hub</span>
                <span class="metric-label" style="margin:0; margin-top: 4px;">Network Latency</span>
                <div style="font-family: var(--font-head); font-weight: 800; font-size: 1.1em;">0.02ms LOCAL</div>
            </div>
        </div>

    </div>

    <script>
        const vscode = acquireVsCodeApi();

        fetch('http://127.0.0.1:5005/hardware')
            .then(response => response.json())
            .then(hw => {
                document.getElementById('ui-device').textContent = hw.device;
                document.getElementById('ui-cpu').textContent = hw.cpu;
                document.getElementById('ui-gpu').textContent = hw.gpu;
                const backendStr = hw.vendor + ' / ONNX';
                document.getElementById('valHardware').textContent = backendStr;
            })
            .catch(err => console.error("Could not fetch hardware profile:", err));
        
        const burnBtn = document.getElementById('burnBtn');
        burnBtn.addEventListener('click', () => {
            burnBtn.disabled = true;
            burnBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> BURNING...';
            document.getElementById('valTime').textContent = 'ACTIVE';
            document.getElementById('logText').innerHTML = 'Executing physical power loop... <span class="term-success">RUNNING</span><span class="blink">_</span>';
            vscode.postMessage({ command: 'runBurn' });
        });

        // --- NEW: TRIGGER GEMINI ---
        const remediateBtn = document.getElementById('remediateBtn');
        remediateBtn.addEventListener('click', () => {
            remediateBtn.disabled = true;
            remediateBtn.innerHTML = '✨ ANALYZING...';
            document.getElementById('logTime').innerHTML = '<span style="color: var(--gemini);">SYS&gt;</span>';
            document.getElementById('logText').innerHTML = 'Sending context to gemini-3.1-flash-lite-preview... <span class="blink">_</span>';   
            vscode.postMessage({ command: 'runRemediate' });
        });

        Chart.defaults.color = '#879391';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = '#131313';
        Chart.defaults.plugins.tooltip.titleColor = '#e5e2e1';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(135, 147, 145, 0.2)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;

        const ctxEnergy = document.getElementById('energyChart').getContext('2d');
        const energyChart = new Chart(ctxEnergy, {
            type: 'bar',
            data: {
                labels: ['Energy', 'CO₂'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#008a32', '#d27956'],
                    hoverBackgroundColor: ['#00c853', '#ffb59a'],
                    borderRadius: 2,
                    barPercentage: 0.7
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { 
                    y: { beginAtZero: true, border: {display: false}, grid: { color: 'rgba(135, 147, 145, 0.05)' }, ticks: {maxTicksLimit: 5} }, 
                    x: { border: {display: false}, grid: { display: false } } 
                } 
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            const now = new Date();
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + '&gt;';
            
            if (message.data && message.data.hardware) {
                document.getElementById('valHardware').textContent = message.data.hardware;
            }

            if (message.type === 'updateData') {
                const res = message.data;
                const statusEl = document.getElementById('statusText');
                
                statusEl.textContent = res.status;
                statusEl.className = res.status === 'Dirty' ? 'metric-value red' : 'metric-value teal';
                
                const score = res.score.toFixed(2);
                document.getElementById('scoreText').innerHTML = score + ' <span class="metric-unit">IDX</span>';
                document.getElementById('scoreText').className = res.status === 'Dirty' ? 'metric-value red' : 'metric-value teal';
                
                const scorePercent = (1.0 - res.score) * 100;
                const bar = document.getElementById('scoreBar');
                bar.style.width = scorePercent + '%';
                bar.style.background = res.status === 'Dirty' ? 'linear-gradient(90deg, #991b1b 0%, #ef4444 100%)' : 'linear-gradient(90deg, #008a32 0%, #00c853 100%)';
                bar.style.boxShadow = res.status === 'Dirty' ? '0 0 6px rgba(239, 68, 68, 0.6)' : '0 0 6px rgba(0, 138, 50, 0.6)';

                const issueCount = res.issues ? res.issues.length : 0;
                document.getElementById('valIssues').innerHTML = issueCount + ' <span class="metric-unit">FOUND</span>';
                document.getElementById('valIssues').className = issueCount > 0 ? 'metric-value red' : 'metric-value teal';

                // --- SHOW/HIDE GEMINI BUTTON ---
                if (res.status === 'Dirty') {
                    remediateBtn.style.display = 'flex';
                } else {
                    remediateBtn.style.display = 'none';
                }

                document.getElementById('logTime').innerHTML = timeStr;
                document.getElementById('logText').innerHTML = res.status === 'Dirty' 
                    ? 'AST parsed. <span style="color: #ef4444">Inefficiencies detected.</span><span class="blink">_</span>' 
                    : 'AST parsed. <span class="term-success">Architecture optimal.</span><span class="blink">_</span>';
            }
            
            // --- INJECT GEMINI CODE INTO TERMINAL ---
            if (message.type === 'remediateData') {
                const res = message.data;
                remediateBtn.disabled = false;
                remediateBtn.innerHTML = '✨ AI REMEDIATION';

                // --- INJECT GEMINI CODE INTO MAIN PANEL ---
            if (message.type === 'remediateData') {
                const res = message.data;
                remediateBtn.disabled = false;
                remediateBtn.innerHTML = '✨ AI REMEDIATION';

                if (res.status === 'Success' || res.status === 'Mocked') {
                    // 1. Update the tiny terminal log
                    document.getElementById('logTime').innerHTML = '<span style="color: var(--gemini);">GEMINI&gt;</span>';
                    document.getElementById('logText').innerHTML = 'Optimization complete. <span style="color: var(--gemini);">Viewing code...</span><span class="blink">_</span>';
                    
                    // 2. Safely escape the HTML characters
                    const safeCode = res.suggestion.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    
                    // 3. Swap the Chart for the Code Panel
                    document.getElementById('chartBox').style.display = 'none';
                    document.getElementById('remediationPanel').style.display = 'flex';
                    
                    // 4. Update Titles and Inject Code
                    document.getElementById('chartTitle').textContent = '✨ Gemini Optimized Architecture';
                    document.getElementById('chartTitle').style.color = 'var(--gemini)';
                    document.getElementById('chartSubtitle').style.display = 'none';
                    document.getElementById('remediationCode').innerHTML = safeCode;
                } else {
                    document.getElementById('logText').innerHTML = '<span style="color: #ef4444">Remediation Failed: ' + res.suggestion + '</span><span class="blink">_</span>';
                }
            }

            // --- CLOSE GEMINI PANEL BUTTON ---
            const closeRemediationBtn = document.getElementById('closeRemediationBtn');
            if (closeRemediationBtn) {
                closeRemediationBtn.addEventListener('click', () => {
                    document.getElementById('remediationPanel').style.display = 'none';
                    document.getElementById('chartBox').style.display = 'block';
                    document.getElementById('chartTitle').textContent = 'Energy Draw (mWh)';
                    document.getElementById('chartTitle').style.color = 'var(--text-muted)';
                    document.getElementById('chartSubtitle').style.display = 'block';
                });
            }
            }

            if (message.type === 'burnData') {
                const res = message.data;
                burnBtn.disabled = false;
                burnBtn.innerHTML = '<span class="material-symbols-outlined">bolt</span> BURN TEST';

                if (res.status === 'Burn Complete') {
                    const milliWattHours = (res.energy_kwh * 1000000).toFixed(2);
                    const milliGramsCo2 = (res.emissions_kg * 1000000).toFixed(2);
                    
                    document.getElementById('valEnergy').innerHTML = milliWattHours + ' mWh';
                    document.getElementById('valCo2').innerHTML = milliGramsCo2 + ' mg';
                    document.getElementById('valTime').textContent = 'COMPLETED';

                    energyChart.data.datasets[0].data = [milliWattHours, milliGramsCo2];
                    energyChart.update();

                    document.getElementById('logTime').innerHTML = timeStr;
                    document.getElementById('logText').innerHTML = 'Power loop terminated. <span class="term-success">Data recorded.</span><span class="blink">_</span>';

                    const scaleFactor = 1000000; 
                    const projectedCo2Kg = (res.emissions_kg * scaleFactor).toFixed(2);
                    
                    const projCard = document.getElementById('projectionCard');
                    const projText = document.getElementById('valProjection');
                    const projSub = document.getElementById('valProjectionSub');
                    const projIcon = document.getElementById('projectionIcon');

                    projText.textContent = projectedCo2Kg + ' kg CO₂ / month';
                    
                    const carMiles = (projectedCo2Kg * 2.5).toFixed(0);
                    projSub.textContent = 'Equivalent to driving a gasoline car ' + carMiles + ' miles.';

                    if (projectedCo2Kg > 5.0) { 
                        projCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                        projCard.style.background = 'linear-gradient(180deg, rgba(239, 68, 68, 0.05) 0%, rgba(32, 31, 31, 1) 100%)';
                        projText.style.color = '#ef4444';
                        projIcon.style.color = '#ef4444';
                        document.getElementById('projectionLabel').style.color = '#ef4444';
                    } else { 
                        projCard.style.borderColor = 'rgba(0, 200, 83, 0.4)';
                        projCard.style.background = 'linear-gradient(180deg, rgba(0, 200, 83, 0.05) 0%, rgba(32, 31, 31, 1) 100%)';
                        projText.style.color = '#00c853';
                        projIcon.style.color = '#00c853';
                        document.getElementById('projectionLabel').style.color = '#00c853';
                    }
                } else {
                    document.getElementById('valTime').textContent = 'FAILED';
                    document.getElementById('logText').innerHTML = '<span style="color: #ef4444">Telemetry loop failed.</span><span class="blink">_</span>';
                }
            }
        });
    </script>
</body>
</html>`;
}

export function deactivate() {
    diagnosticCollection.clear();
}