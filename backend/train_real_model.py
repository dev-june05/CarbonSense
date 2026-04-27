import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd
from tqdm import tqdm

MAX_LENGTH = 512

# --- 1. LOAD & PROCESS POLARIZED DATASET ---
print(">>> 📥 Loading Polarized GreenOps Dataset...")
# Read the CSV we just generated
df = pd.read_csv('dataset/polarized_training_data.csv')

# Extract the code and the explicit scores
train_texts = df['code'].astype(str).tolist()
train_labels = df['carbon_score'].astype(float).tolist()

print(f">>> 🗄️ Loaded {len(train_texts)} highly polarized code samples.")

# --- 2. PREPROCESS TENSORS FOR THE CNN ---
def preprocess_batch(texts):
    batch_data = []
    for text in texts:
        # Convert characters to ASCII integers, pad with 0s to MAX_LENGTH
        # NORMALIZATION FIX: Divide by 255.0 to keep inputs between 0 and 1
        encoded = [(ord(c) / 255.0) if ord(c) < 256 else 0.0 for c in text[:MAX_LENGTH]]
        padded = encoded + [0] * (MAX_LENGTH - len(encoded))
        batch_data.append(padded)
    return torch.tensor(batch_data, dtype=torch.float32)

print(">>> 🔢 Converting Text to Tensors...")
X_train = preprocess_batch(train_texts)
y_train = torch.tensor(train_labels, dtype=torch.float32).unsqueeze(1)

dataset = TensorDataset(X_train, y_train)
dataloader = DataLoader(dataset, batch_size=64, shuffle=True)

# --- 3. THE 1D-CNN ARCHITECTURE ---
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

# --- 4. THE TRAINING LOOP ---
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)
epochs = 8 # Bumped up slightly for better convergence on the smaller dataset

print(">>> 🚀 Starting Training on Polarized Data...")
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

# --- 5. EXPORT TO ONNX ---
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

print(">>> ✅ Highly Polarized 1D-CNN 'model.onnx' successfully forged!")