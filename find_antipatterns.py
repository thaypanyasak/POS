import os
import re

lib_dir = r"c:\Users\thayz\OneDrive\Desktop\MeiiShop\lib"

# Patterns to search in non-comment code
patterns = {
    'Card': re.compile(r'(?<!//)\bCard\s*\('),
    'ElevatedButton': re.compile(r'(?<!//)\bElevatedButton\b'),
    'FloatingActionButton': re.compile(r'(?<!//)\bFloatingActionButton\b'),
    'DropdownButton': re.compile(r'(?<!//)\bDropdownButton(?:FormField)?\b'),
    'Emoji': re.compile(r'[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]'),
    'MaterialIcons': re.compile(r'(?<!//)\bIcons\.[a-zA-Z0-9_]+')
}

results = {k: [] for k in patterns}

for root, dirs, files in os.walk(lib_dir):
    for f in files:
        if f.endswith('.dart'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                lines = fp.readlines()
                for p_name, p_regex in patterns.items():
                    count = 0
                    for line in lines:
                        clean_line = line.strip()
                        if clean_line.startswith('//') or clean_line.startswith('*') or clean_line.startswith('/*'):
                            continue
                        matches = p_regex.findall(line)
                        count += len(matches)
                    if count > 0:
                        rel_path = os.path.relpath(filepath, lib_dir)
                        results[p_name].append((rel_path, count))

for p_name, file_counts in results.items():
    print(f"=== {p_name} ({len(file_counts)} files) ===")
    for rel_path, count in file_counts:
        print(f"  {rel_path}: {count}")
