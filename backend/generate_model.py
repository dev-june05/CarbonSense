import pandas as pd
import random
import os

def generate_polarized_dataset(num_samples=1000):
    data = []

    # --- 1. CRITICAL OFFENDERS (Label: 0.85 - 0.99) ---
    dirty_patterns = [
        # 1. The Pandas Iterrows Trap
        """
import pandas as pd
df = pd.DataFrame({'a': range({size}), 'b': range({size})})
result = []
for index, row in df.iterrows():
    result.append(row['a'] + row['b'])
        """,
        # 2. Deeply Nested Math Loops
        """
matrix = []
for i in range({size}):
    row = []
    for j in range({size}):
        val = 0
        for k in range(10):
            val += (i * j) / (k + 1)
        row.append(val)
    matrix.append(row)
        """,
        # 3. Massive Manual String Concatenation
        """
text_data = ["data"] * {size}
final_string = ""
for word in text_data:
    final_string += word + "-"
        """,
        # 4. Unnecessary Type Casting in Loops
        """
raw_data = [str(x) for x in range({size})]
processed = []
for item in raw_data:
    if int(item) % 2 == 0:
        processed.append(float(item) * 3.14)
        """
    ]

    # --- 2. OPTIMAL/CLEAN CODE (Label: 0.05 - 0.15) ---
    clean_patterns = [
        # 1. Pandas/Numpy Vectorization
        """
import pandas as pd
import numpy as np
df = pd.DataFrame({'a': range({size}), 'b': range({size})})
result = df['a'] + df['b']
        """,
        # 2. Numpy Matrix Math
        """
import numpy as np
i_vals = np.arange({size})
j_vals = np.arange({size})
matrix = np.outer(i_vals, j_vals) * 2.5
        """,
        # 3. Optimized String Join
        """
text_data = ["data"] * {size}
final_string = "-".join(text_data)
        """,
        # 4. List Comprehensions
        """
raw_data = range({size})
processed = [x * 3.14 for x in raw_data if x % 2 == 0]
        """
    ]

    # Generate the dataset
    print("🧠 Generating Highly Polarized GreenOps Dataset...")
    for _ in range(num_samples // 2):
        # Generate a dirty sample
        size = random.randint(1000, 100000)
        dirty_code = random.choice(dirty_patterns).replace("{size}", str(size)).strip()
        # Add slight noise to the score to prevent overfitting (e.g., 0.88 to 0.98)
        dirty_score = round(random.uniform(0.85, 0.98), 3)
        data.append({"code": dirty_code, "carbon_score": dirty_score})

        # Generate a clean sample
        size = random.randint(1000, 100000)
        clean_code = random.choice(clean_patterns).replace("{size}", str(size)).strip()
        # Add slight noise to the score (e.g., 0.05 to 0.15)
        clean_score = round(random.uniform(0.05, 0.15), 3)
        data.append({"code": clean_code, "carbon_score": clean_score})

    # Shuffle the dataset so the CNN doesn't learn a pattern of Dirty, Clean, Dirty, Clean
    random.shuffle(data)
    
    df = pd.DataFrame(data)
    
    # Save to your dataset folder
    os.makedirs('dataset', exist_ok=True)
    df.to_csv('dataset/polarized_training_data.csv', index=False)
    print(f"✅ Successfully generated {len(df)} polarized samples at dataset/polarized_training_data.csv")

if __name__ == "__main__":
    generate_polarized_dataset(2000) # Generate 2,000 samples