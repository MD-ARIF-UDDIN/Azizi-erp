Write-Host "=== 1. Checking Remote Supabase (yojqvmvmkfhshsjvhmgr.supabase.co) ==="
try {
    $dns = Resolve-DnsName -Name "yojqvmvmkfhshsjvhmgr.supabase.co" -ErrorAction Stop
    Write-Host "[DNS OK] IP:" ($dns.IPAddress -join ", ")
} catch {
    Write-Host "[DNS FAILED]" $_.Exception.Message
}

try {
    $response = Invoke-WebRequest -Uri "https://yojqvmvmkfhshsjvhmgr.supabase.co/rest/v1/" -Headers @{ "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4" } -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[HTTP OK] Status Code:" $response.StatusCode
} catch {
    Write-Host "[HTTP FAILED]" $_.Exception.Message
}

Write-Host "`n=== 2. Checking Local Ports (PostgreSQL / Supabase / Dev Server) ==="
$ports = @(5432, 54321, 54322, 5173, 3000)
$listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
if ($listening) {
    $listening | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize | Out-String | Write-Host
} else {
    Write-Host "No standard database ports (5432, 54321, 54322) or web ports listening locally."
}

Write-Host "=== 3. Checking Docker Containers ==="
try {
    $dockerOut = docker ps 2>&1
    Write-Host $dockerOut
} catch {
    Write-Host "Docker is not running or not installed."
}
