import torch
import torch.nn as nn

# 1. Define a simple architecture (This expects the 512-length array from our server)
class DummyCarbonModel(nn.Module):
    def __init__(self):
        super().__init__()
        # Simple Multi-Layer Perceptron (MLP) for testing
        self.fc1 = nn.Linear(512, 128)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(128, 1)
        self.sigmoid = nn.Sigmoid() # Squishes the output to a score between 0.0 and 1.0

    def forward(self, x):
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        return self.sigmoid(x)

print("Forging the neural network...")
model = DummyCarbonModel()

# 2. Create a dummy input tensor that perfectly matches what server.py will send
# Shape: (1 Batch, 512 Characters)
dummy_input = torch.randn(1, 512)

# 3. Export the brain to ONNX format
torch.onnx.export(
    model, 
    (dummy_input,), 
    "model.onnx", 
    export_params=True,
    input_names=["input"],   # server.py looks for the first input name
    output_names=["output"]
)

print("✅ Success! 'model.onnx' has been created in your directory.")