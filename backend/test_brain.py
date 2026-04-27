import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("model.onnx")
input_name = session.get_inputs()[0].name

def get_score(code):
    encoded = [(ord(c) / 255.0) if ord(c) < 256 else 0.0 for c in code[:512]]
    padded = encoded + [0.0] * (512 - len(encoded))
    input_data = np.array([padded], dtype=np.float32)
    
    outputs = session.run(None, {input_name: input_data})
    return float(outputs[0][0][0]) if len(outputs[0].shape) > 1 else float(outputs[0][0])

clean_code = """
import numpy as np
data = np.arange(10000)
result = data * 2.5
"""

dirty_demo_code = """
import pandas as pd
df = pd.DataFrame({'a': range(10000), 'b': range(10000)})
result = []
for index, row in df.iterrows():
    result.append(row['a'] + row['b'])
"""

print(f"Clean Code Score: {get_score(clean_code):.3f} (Should be < 0.2)")
print(f"Dirty Code Score: {get_score(dirty_demo_code):.3f} (Should be > 0.8)")