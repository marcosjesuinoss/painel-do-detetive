$ErrorActionPreference = "Stop"

$replacementChar = [char]0xFFFD
$mojibakeRegex = '[\u00C3\u00C2\u00E2](?=[\u0080-\u00BF])|\u00EF\u00B8\u008F|\u00EF\u00BF\u00BD'

$files = Get-ChildItem -Recurse -File -Include *.html,*.js,*.css,*.json,*.svg |
  Where-Object { $_.FullName -notmatch "\\backup\\" }

$issues = @()

foreach ($file in $files) {
  $content = Get-Content -Raw -Encoding utf8 $file.FullName

  if ($content.Contains($replacementChar) -or [regex]::IsMatch($content, $mojibakeRegex)) {
    $issues += $file.FullName
  }
}

if ($issues.Count -gt 0) {
  Write-Output "Possible encoding issues found:"
  $issues | ForEach-Object { Write-Output "- $_" }
  exit 1
}

Write-Output "OK: no encoding issues detected."
