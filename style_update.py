import os
import re

tabs = [
    "src/components/scheduleTab.tsx",
    "src/components/routesTab.tsx",
    "src/components/busesTab.tsx",
    "src/components/paymentsTab.tsx",
    "src/components/reportsTab.tsx"
]

def update_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}")
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace overly rounded corners
    content = re.sub(r'rounded-\[2rem\]', 'rounded-2xl', content)
    content = re.sub(r'rounded-\[2\.5rem\]', 'rounded-2xl', content)
    content = re.sub(r'rounded-\[1\.5rem\]', 'rounded-2xl', content)
    content = re.sub(r'sm:rounded-\[2rem\]', 'sm:rounded-2xl', content)
    content = re.sub(r'sm:rounded-\[2\.5rem\]', 'sm:rounded-2xl', content)
    content = re.sub(r'rounded-3xl', 'rounded-2xl', content)
    
    # Replace heavy shadows
    content = re.sub(r'shadow-\[.*?\]', 'shadow-sm', content)
    content = re.sub(r'hover:shadow-\[.*?\]', 'hover:shadow-md', content)
    content = re.sub(r'hover:shadow-2xl', 'hover:shadow-md', content)
    
    # Typography softening (optional, but requested clean minimalist UI)
    content = re.sub(r'font-black', 'font-bold', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {filepath}")

for tab in tabs:
    update_file(tab)
