import re

file_path = r"c:\Users\thayz\OneDrive\Desktop\MeiiShop\lib\views\inventory\purchase_list_screen.dart"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

patterns = [r'\bElevatedButton\b', r'\bDropdownButton\b', r'\bIcons\.[a-zA-Z0-9_]+']

for idx, line in enumerate(lines, 1):
    for p in patterns:
        if re.search(p, line):
            print(f"{idx}: {line.strip()}")
