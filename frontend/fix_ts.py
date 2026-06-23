import os, glob

files = glob.glob('**/*.tsx', recursive=True)
for f in files:
    if 'node_modules' in f: continue
    with open(f, 'r', encoding='utf-8') as file: content = file.read()
    
    new_content = content.replace('shadows.soft', 'shadows.premium').replace('name="chair"', 'name="bookmark"')
    new_content = new_content.replace("router.replace('/(student_tabs)')", "router.replace('/(student_tabs)/dashboard' as any)")
    new_content = new_content.replace("router.push('/(tabs)/settings')", "router.push('/(tabs)/settings' as any)")
    
    if f.endswith('app\\(tabs)\\feedback.tsx') or f.endswith('app/(tabs)/feedback.tsx'):
        new_content = new_content.replace("'../src/theme/theme'", "'../../src/theme/theme'")
        new_content = new_content.replace("'../src/services/api'", "'../../src/services/api'")
        
    if f.endswith('app\\(student_tabs)\\dashboard.tsx') or f.endswith('app/(student_tabs)/dashboard.tsx'):
        new_content = new_content.replace('style={[styles.card, { padding: spacing.m, marginBottom: spacing.s }]}', 'style={[styles.card, { padding: spacing.m, marginBottom: spacing.s }] as any}')
        
    if f.endswith('src\\screens\\DashboardScreen.tsx') or f.endswith('src/screens/DashboardScreen.tsx'):
        new_content = new_content.replace('style={[styles.quickAction, isLibrary && { borderColor: \'#8b5cf6\', borderWidth: 1 }]}', 'style={[styles.quickAction, isLibrary && { borderColor: \'#8b5cf6\', borderWidth: 1 }] as any}')

    if f.endswith('app\\index.tsx') or f.endswith('app/index.tsx'):
        new_content = new_content.replace("router.replace('/(student_tabs)');", "router.replace('/(student_tabs)/dashboard' as any);")
        
    if content != new_content:
        with open(f, 'w', encoding='utf-8') as file: file.write(new_content)
        print('Updated', f)
