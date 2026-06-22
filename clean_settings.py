import re

with open('e:/exam-forge-ai-main/app/settings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove import
content = re.sub(r'import\s+\{\s*useSoundEffects.*?\s*sounds[\'\"];?\r?\n', '', content)

# Remove hook usage
content = re.sub(r'\s*const\s+\{\s*isEnabled.*?useSoundEffects\(\);\r?\n', '\n', content)
content = re.sub(r'\s*const\s+setSoundEnabled\s*=\s*toggleSoundEffects;\r?\n', '\n', content)

# Remove Sound Effects UI Block
pattern = r'\s*<View style=\{\[styles\.settingRow, \{ borderTopColor: C\.border \}\]\}>\s*<View style=\{\{ flex: 1 \}\}>\s*<Text style=\{\[styles\.settingLabel, \{ color: C\.foreground \}\]\}>Sound Effects</Text>[\s\S]*?</TouchableOpacity>\s*</View>'
content = re.sub(pattern, '', content)

with open('e:/exam-forge-ai-main/app/settings.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Cleaned settings.tsx')
