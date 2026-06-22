$path = 'E:\exam-forge-ai-main\app\ai-chat.tsx'
$content = Get-Content $path -Raw

# Check a sample area around what was modified
$matches = [regex]::Matches($content, '</View>')
Write-Host "Number of </View> found: $($matches.Count)"

# Let me check lines around the conv items area (around line 740)
$lines = Get-Content $path
Write-Host "=== Lines 740-770 ==="
for($i=740; $i -le 770 -and $i -lt $lines.Count; $i++) { Write-Host "[$i] $($lines[$i])" }
