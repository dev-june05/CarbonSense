import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
from datasets import load_dataset
from tqdm import tqdm
import ast

MAX_LENGTH = 512

# --- 1. THE AUTO-LABELER (The Secret Sauce) ---
def generate_carbon_score(code_string):
    """
    Acts as a 'virtual judge' to grade the raw Hugging Face code.
    Scores range from 0.1 (Clean/Efficient) to 1.0 (Dirty/High Carbon).
    """
    score = 0.1  # Base score for existing
    try:
        tree = ast.parse(code_string)
        for node in ast.walk(tree):
            # Penalty for loops
            if isinstance(node, (ast.For, ast.While)):
                score += 0.15
                # Heavy penalty for nested loops O(n^2)
                for child in ast.walk(node):
                    if isinstance(child, (ast.For, ast.While)) and child != node:
                        score += 0.35
            # Penalty for massive hardcoded arrays
            if isinstance(node, (ast.List, ast.Dict)) and len(getattr(node, 'elts', [])) > 50:
                score += 0.1
    except SyntaxError:
        # If the scraped GitHub code is broken, give it a penalty
        score = 0.6
        
    return min(score, 1.0) # Cap at 1.0

# --- 2. LOAD & PROCESS HUGGING FACE DATASET ---
print(">>> 📥 Downloading Hugging Face Dataset (jtatman/python-code-dataset-500k)...")
# Note: The first time you run this, it will take a few minutes to download!
dataset = load_dataset("jtatman/python-code-dataset-500k", split="train")

print(">>> 🗄️ Sampling 10,000 scripts for initial training...")
# We shuffle and select 10k to keep training fast for testing. 
# Once it works, you can increase this to 100k+!
small_ds = dataset.shuffle(seed=42).select(range(10000))

train_texts = []
train_labels = []

print(">>> 🏷️ Auto-Labeling dataset using AST Heuristics...")
for row in tqdm(small_ds, desc="Labeling Code"):
    # The dataset usually stores the code under the 'text' key
    code = dict(row).get('output', '')    
    if not code: continue

    score = generate_carbon_score(code)
    train_texts.append(code)
    train_labels.append(score)

# --- 3. PREPROCESS TENSORS FOR THE CNN ---
def preprocess_batch(texts):
    batch_data = []
    for text in texts:
        encoded = [ord(c) if ord(c) < 256 else 0 for c in text[:MAX_LENGTH]]
        padded = encoded + [0] * (MAX_LENGTH - len(encoded))
        batch_data.append(padded)
    return torch.tensor(batch_data, dtype=torch.float32)

print(">>> 🔢 Converting Text to Tensors...")
X_train = preprocess_batch(train_texts)
y_train = torch.tensor(train_labels, dtype=torch.float32).unsqueeze(1)

dataset = TensorDataset(X_train, y_train)
dataloader = DataLoader(dataset, batch_size=64, shuffle=True)

# --- 4. THE 1D-CNN ARCHITECTURE ---
class CarbonCNN(nn.Module):
    def __init__(self):
        super(CarbonCNN, self).__init__()
        self.conv1 = nn.Conv1d(in_channels=1, out_channels=16, kernel_size=5, padding=2)
        self.relu = nn.ReLU()
        self.pool = nn.MaxPool1d(kernel_size=2)
        
        self.conv2 = nn.Conv1d(in_channels=16, out_channels=32, kernel_size=3, padding=1)
        self.flatten = nn.Flatten()
        
        self.fc1 = nn.Linear(32 * (MAX_LENGTH // 4), 64)
        self.fc2 = nn.Linear(64, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = x.unsqueeze(1) 
        x = self.pool(self.relu(self.conv1(x)))
        x = self.pool(self.relu(self.conv2(x)))
        x = self.flatten(x)
        x = self.relu(self.fc1(x))
        x = self.sigmoid(self.fc2(x))
        return x

model = CarbonCNN()

# --- 5. THE TRAINING LOOP ---
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)
epochs = 5

print(">>> 🚀 Starting Training on Ryzen...")
for epoch in range(epochs):
    model.train()
    running_loss = 0.0
    for batch_X, batch_y in tqdm(dataloader, desc=f"Epoch {epoch+1}/{epochs}"):
        optimizer.zero_grad()
        outputs = model(batch_X)
        loss = criterion(outputs, batch_y)
        loss.backward()
        optimizer.step()
        running_loss += loss.item()
    print(f"Epoch {epoch+1} Loss: {running_loss/len(dataloader):.4f}")

# --- 6. EXPORT TO ONNX ---
print(">>> 💾 Exporting trained model to ONNX...")
model.eval()
dummy_input = torch.zeros(1, MAX_LENGTH) 
torch.onnx.export(
    model, 
    (dummy_input,), 
    "model.onnx", 
    export_params=True,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
)

print(">>> ✅ Real 1D-CNN 'model.onnx' successfully forged!")