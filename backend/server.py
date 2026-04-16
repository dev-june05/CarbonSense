from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import onnxruntime as ort
import numpy as np
import cpuinfo
import traceback
import ast
import torch
import platform
import subprocess

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tells the server to allow the VS Code Webview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. HARDWARE DETECTION & ROUTING ---
def detect_hardware():
    try:
        info = cpuinfo.get_cpu_info()
        vendor = info.get('vendor_id_raw', '').lower()
        model = info.get('brand_raw', '').lower()
        
        if 'amd' in vendor or 'ryzen' in model or 'epyc' in model:
            return "AMD", True
        elif 'intel' in vendor or 'core' in model or 'xeon' in model:
            return "Intel", True
        else:
            return "Unknown", False
    except Exception as e:
        print(f">>> ⚠️ Hardware detection failed: {e}")
        return "Unknown", False

cpu_brand, use_onnx = detect_hardware()
print(f">>> 🖥️ Hardware Detected: {cpu_brand.upper()}")

# --- NEW: HARDWARE TELEMETRY SNIFFER ---
def get_hardware_specs():
    # 1. Get CPU
    try:
        info = cpuinfo.get_cpu_info()
        cpu_name = info.get('brand_raw', 'Unknown CPU')
    except:
        cpu_name = "Unknown CPU"

    # 2. Get GPU and VRAM (via PyTorch CUDA)
    gpu_name = "Integrated / CPU Only"
    if torch.cuda.is_available():
        try:
            name = torch.cuda.get_device_name(0)
            vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3))
            gpu_name = f"{name} ({vram_gb} GB VRAM)"
        except:
            pass

    # 3. Get Exact Laptop/Motherboard Model (Windows specific)
    device_name = platform.node()
    if platform.system() == "Windows":
        try:
            cmd = "wmic csproduct get name"
            res = subprocess.check_output(cmd, shell=True).decode().strip().split('\n')
            if len(res) > 1:
                device_name = res[1].strip()
        except:
            pass

    if "AMD" in cpu_name.upper():
        vendor = "AMD"
    elif "INTEL" in cpu_name.upper():
        vendor = "INTEL"
    elif "APPLE" in cpu_name.upper():
        vendor = "APPLE"
    else:
        vendor = "GENERIC"

    return {
        "vendor": vendor,
        "device": device_name,
        "cpu": cpu_name,
        "gpu": gpu_name
    }

# Execute sniffing on startup
HW_SPECS = get_hardware_specs()

if HW_SPECS['vendor'] == "AMD":
    engine = "ZenDNN"
elif HW_SPECS['vendor'] == "INTEL":
    engine = "oneDNN"
else:
    engine = "Standard ONNX Runtime & AST Profiler"

print(f"\n>>> 🖥️ Hardware Detected: {HW_SPECS['vendor']}")
print(f"    Device: {HW_SPECS['device']}")
print(f"    CPU:    {HW_SPECS['cpu']}")
print(f"    GPU:    {HW_SPECS['gpu']}")

# Provide endpoint for the VS Code Extension
@app.get("/hardware")
def hardware_info():
    return HW_SPECS

# --- 2. AWAKEN THE BRAIN (If Supported) ---
session = None
if use_onnx:
    try:
        # Note: In a production environment, you would specify the exact providers here.
        # e.g., providers=['DnnlExecutionProvider'] for Intel oneDNN.
        # AMD's ZenDNN is usually natively integrated into their specific ONNX Runtime build.
        session = ort.InferenceSession("model.onnx")
        input_name = session.get_inputs()[0].name
        
        engine_name = "ZenDNN" if cpu_brand == "AMD" else "oneDNN"
        print(f">>> 🧠 ONNX Model Loaded Successfully! Routing via {engine_name}.")
    except Exception as e:
        print(f">>> ❌ Error loading ONNX model. Falling back to AST. Error: {e}")
        use_onnx = False

class CodePayload(BaseModel):
    code: str

def preprocess_code(code: str) -> np.ndarray:
    # Update this to match your actual training tokenizer!
    max_length = 512
    encoded = [ord(c) for c in code[:max_length]]
    padded = encoded + [0] * (max_length - len(encoded))
    return np.array([padded], dtype=np.float32)

# --- 3. THE AST FALLBACK (Old Reliable) ---
def fallback_ast_linter(code: str):
    print(">>> 🔄 Routing via AST Fallback Logic...")
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.For):
                for child in ast.walk(node):
                    if isinstance(child, ast.For) and child != node:
                        return {
                            "status": "Dirty", 
                            "score": 0.80, 
                            "issues": [{"line": getattr(child, 'lineno', 1), "message": "AST Fallback: Potential O(n^2) nested loop detected."}]
                        }
        return {"status": "Clean", "score": 0.10, "issues": []}
    except Exception as e:
        return {"status": "Error", "score": 0.0, "issues": [{"line": 1, "message": "Syntax Error in code"}]}

# --- 4. THE MASTER SCANNER ---
@app.post("/scan")
async def scan_code(payload: CodePayload):
    code = payload.code

    # Route 1: Hardware-Accelerated ONNX Inference
    if use_onnx and session is not None:
        try:
            input_data = preprocess_code(code)
            outputs = session.run(None, {input_name: input_data})
            output_array = np.array(outputs[0])
            score = float(output_array[0][0]) if len(output_array.shape) > 1 else float(output_array[0])            
            if score > 0.50:
                issues = []
                lines = code.split('\n')
                for i, line in enumerate(lines):
                    if "for " in line or "while " in line: 
                        issues.append({
                            "line": i + 1,
                            "message": f"High Carbon Footprint Predicted! (AI Score: {score:.2f} via {cpu_brand})"
                        })
                if not issues:
                     issues.append({"line": 1, "message": f"Inefficient architecture detected (Score: {score:.2f})"})
                return {"status": "Dirty", "score": score, "issues": issues}
            else:
                return {"status": "Clean", "score": score, "issues": []}
                
        except Exception as e:
            print(f">>> ⚠️ ONNX Inference failed. Falling back to AST. Error: {e}")
            return fallback_ast_linter(code) # Soft fail into AST
            
    # Route 2: AST Fallback (If CPU is unknown or ONNX crashed)
    else:
        return fallback_ast_linter(code)
    
from codecarbon import OfflineEmissionsTracker
import tempfile
import subprocess
import os

@app.post("/burn")
async def run_burn_test(payload: CodePayload):
    code = payload.code
    
    # 1. Create a temporary Python file to execute
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    try:
        # 2. Fire up the CodeCarbon Tracker
        # We use Offline mode because we only care about local CPU/RAM power, not cloud APIs
        tracker = OfflineEmissionsTracker(country_iso_code="IND", log_level="error")
        tracker.start()

        # 3. Execute the user's code in a subprocess
        # (Capturing the output so it doesn't mess up our server logs)
        process = subprocess.run(
            ["python", temp_file_path],
            capture_output=True,
            text=True,
            timeout=10 # Stop it if it runs forever!
        )

        # 4. Stop tracking and get the physics data
        raw_emissions = tracker.stop()
        emissions = float(raw_emissions) if raw_emissions is not None else 0.0        
        # CodeCarbon returns energy in kWh
        energy_kwh = tracker.final_emissions_data.energy_consumed

        # Clean up the temp file
        os.remove(temp_file_path)

        if process.returncode != 0:
            return {"status": "Execution Error", "energy_kwh": 0, "emissions_kg": 0, "error": process.stderr}

        return {
            "status": "Burn Complete",
            "energy_kwh": energy_kwh,
            "emissions_kg": emissions,
            "output": process.stdout
        }

    except subprocess.TimeoutExpired:
        os.remove(temp_file_path)
        return {"status": "Timeout", "energy_kwh": 0, "emissions_kg": 0, "error": "Code took too long to run."}
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        print(traceback.format_exc())
        return {"status": "Error", "energy_kwh": 0, "emissions_kg": 0, "error": str(e)}