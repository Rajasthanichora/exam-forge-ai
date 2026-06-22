$path = 'E:\exam-forge-ai-main\components\TestResults.tsx'
$content = Get-Content $path -Raw
# Revert stat icon boxes
$content = $content -replace '<View style=\{\{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: stat\.color \+ "15" \}\}>', ''
$content = $content -replace '<Ionicons name=\{stat\.icon\}(.*?)size=\{22\}(.*?)\/>', '<Ionicons name={stat.icon} size={20} color={stat.color} />'
Set-Content -Path $path -Value $content
Write-Host "TestResults reverted"
