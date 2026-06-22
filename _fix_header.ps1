$path = 'E:\exam-forge-ai-main\components\Header.tsx'
$lines = Get-Content $path
# Replace lines 27-32 (the dot wrapper) with original single subtitle line
$lines[27] = '            <Text style={[styles.subtitle, { color: C.mutedForeground }]}>'
$lines[28] = '              {sectionName || "Smart Test Generator"}'
$lines[29] = '            </Text>'
# Remove lines 30-32 (the closing of the wrapper)
$keep = @()
for($i=0; $i -lt $lines.Count; $i++) {
    if ($i -ge 30 -and $i -le 32) { continue }
    $keep += $lines[$i]
}
Set-Content -Path $path -Value $keep
Write-Host "Header.tsx reverted successfully"
