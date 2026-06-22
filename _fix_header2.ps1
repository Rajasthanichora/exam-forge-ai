$path = 'E:\exam-forge-ai-main\components\Header.tsx'
$lines = Get-Content $path
# Fix iconBtn style - find and replace
for($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "iconBtn:") {
        $lines[$i] = '  iconBtn: {'
        $lines[$i+1] = '    padding: Spacing.sm,'
        $lines[$i+2] = '  },'
        break
    }
}
# Remove any old iconBtn-related lines beyond the correct 3
Set-Content -Path $path -Value $lines
Write-Host "Header iconBtn fixed"
