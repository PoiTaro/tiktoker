$ErrorActionPreference = "Stop"

# Create audio dir
if (!(Test-Path "audio")) { New-Item -ItemType Directory -Path "audio" | Out-Null }

# Start VOICEVOX engine
Write-Host "Starting VOICEVOX Engine..."
$proc = Start-Process -FilePath "C:\Program Files\VOICEVOX\vv-engine\run.exe" -ArgumentList "--host 127.0.0.1 --port 50021" -WorkingDirectory "C:\Program Files\VOICEVOX\vv-engine" -PassThru -WindowStyle Hidden

# Wait for server ready
$ready = $false
for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:50021/version" -ErrorAction Stop
        $ready = $true
        break
    } catch {}
}

if (!$ready) {
    Write-Error "VOICEVOX Server failed to start in 30 seconds."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "VOICEVOX Server ready!"

# Speaker ID: 84 (青山龍星 - しっとり) or 13 (ノーマル)
$speakerId = 84

$scenes = @(
    @{ id = "scene1"; text = "思考する、AIエージェント。アンチグラビティ。" },
    @{ id = "scene2"; text = "コードの文脈を深く理解し、自律的に設計と実装を行います。" },
    @{ id = "scene3"; text = "無駄を削ぎ落とした美しさ。洗練されたUIとデザインを構築します。" },
    @{ id = "scene4"; text = "そして、コードから映像を生み出す。ハイパーフレームスによる動画生成まで。" },
    @{ id = "scene5"; text = "心地よい開発体験を、ともに。" }
)

foreach ($s in $scenes) {
    Write-Host "Synthesizing $($s.id): $($s.text)..."
    $encodedText = [System.Web.HttpUtility]::UrlEncode($s.text)
    $queryUri = "http://127.0.0.1:50021/audio_query?speaker=$speakerId&text=$encodedText"
    
    # Query
    $queryJson = Invoke-RestMethod -Uri $queryUri -Method Post -ContentType "application/json"
    
    # Adjust speed slightly for calmer MUJI vibe if needed (0.95 speed)
    $queryJson.speedScale = 0.96
    
    $body = $queryJson | ConvertTo-Json -Depth 10
    
    # Synthesis
    $synthUri = "http://127.0.0.1:50021/synthesis?speaker=$speakerId"
    $wavBytes = Invoke-RestMethod -Uri $synthUri -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json"
    
    $outPath = Join-Path "audio" "$($s.id).wav"
    [System.IO.File]::WriteAllBytes((Resolve-Path .).Path + "\audio\" + "$($s.id).wav", $wavBytes)
    Write-Host "Saved $outPath"
}

# Stop Engine
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Write-Host "All audio generated successfully!"
