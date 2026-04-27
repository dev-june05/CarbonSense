# 🌿 CarbonSense

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Predictive SCI Linter & Hardware-Aware GreenOps Telemetry**

CarbonSense is an enterprise-grade VS Code extension that shifts carbon optimization left. It combines real-time AI static analysis with physical hardware burn tests to prevent massively inefficient, carbon-heavy code from ever reaching cloud production environments.

## 🚀 The Two-Tier Architecture

### Tier 1: The AI "Blast Radius" Linter (Instant)
As you type, a locally hosted ONNX 1D-CNN reads your AST (Abstract Syntax Tree). It detects Big Data anti-patterns (like `pandas.iterrows` or deeply nested loops) and instantly predicts the **Cloud-Scale Carbon Blast Radius**—showing you exactly how much CO₂ this script would emit if deployed to a 10,000-run cloud pipeline. 

### Tier 2: Physical Hardware Telemetry (Verified)
Predictions are great, but enterprises need audits. Clicking the **Burn Test** locks your code in a local sandbox and executes it. Using `CodeCarbon`, it measures the physical Joules of electricity pulled from your specific CPU/GPU architecture (Intel/AMD/Apple) and returns a mathematically verified Carbon Receipt.

## 🛠️ Tech Stack
* **Frontend:** VS Code Extension API, TypeScript, Chart.js (Dark Tactical UI)
* **Backend:** FastAPI (Python), Uvicorn
* **AI Engine:** PyTorch, ONNX Runtime (`1D-CNN` trained on 500k+ code samples)
* **Telemetry:** CodeCarbon, Py-Cpuinfo

## ⚙️ Prerequisites
Ensure you have the following installed before starting:
* [Node.js](https://nodejs.org/) (v16 or higher)
* [Python](https://www.python.org/) (3.8 or higher)
* VS Code

## 💻 Installation & Setup

Because CarbonSense bridges a Node.js frontend with a Python ML backend, you must run both environments simultaneously.

### 1. Start the Telemetry Backend
Open a terminal, navigate to the backend folder, and start the AI engine:

```bash
cd backend
python -m venv .venv

# Activate the virtual environment
.venv/Scripts/activate  # On Windows
source .venv/bin/activate    # On Mac/Linux

# Install dependencies and run the server
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 5005
```

### 2. Launch the VS Code Extension
Open a new terminal, compile the extension, and launch the host:

```bash
cd extension/carbonsense
npm install
npm run compile
```
Once compiled, open the extension/carbonsense folder in VS Code and press F5 to launch the Extension Development Host.

### 🌍 The Mission
Wasted compute is wasted electricity. By catching unoptimized data pipelines before they hit massive cloud clusters, CarbonSense actively decarbonizes software engineering. Predict locally, verify physically, save globally.
