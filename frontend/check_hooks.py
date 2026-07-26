import os, glob, re

def check_hooks():
    files = glob.glob('d:/Newevent/whataspsp/frontend/src/**/*.tsx', recursive=True) + \
            glob.glob('d:/Newevent/whataspsp/frontend/app/**/*.tsx', recursive=True)
    
    hook_regex = re.compile(r'\b(use[A-Z]\w*)\s*\(')
    return_regex = re.compile(r'^\s*if\s*\(.*\)\s*return')
    
    for f_path in files:
        if 'node_modules' in f_path:
            continue
        with open(f_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        seen_return = False
        return_line = -1
        for idx, line in enumerate(lines):
            # check if line has an early return in component body
            if "return (" in line or "return <" in line:
                seen_return = True
                return_line = idx + 1
            elif re.search(r'^\s*if\s*\(.*?\)\s*return\s+([^{]+);', line):
                seen_return = True
                return_line = idx + 1
                
            match = hook_regex.search(line)
            if match and seen_return:
                # exclude custom hook definitions or helper functions outside components
                if "const " in line or "=" in line or line.strip().startswith("use"):
                    print(f"[WARNING] Hook after return in {f_path}:{idx+1} -> '{match.group(1)}' (Return was at line {return_line})")
                    print(f"   Line {idx+1}: {line.strip()}")

if __name__ == '__main__':
    check_hooks()
