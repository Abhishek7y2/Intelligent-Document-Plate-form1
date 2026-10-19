Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main\docs\audit-evidence\benchmark-inv-page-01.png'
$tsvPath = 'C:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main\docs\audit-evidence\benchmark-inv-page-01-tesseract.tsv'
$outPath = 'C:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main\docs\audit-evidence\step2-claim2-ocr-bbox-rendered.png'

$img = [System.Drawing.Image]::FromFile($imgPath)
$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $img.Width, $img.Height)
$img.Dispose()

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 230, 0, 0), 2)
$tsvLines = Get-Content $tsvPath
$drawnCount = 0

foreach ($line in $tsvLines | Select-Object -Skip 1) {
    $parts = $line.Split("`t")
    if ($parts.Length -ge 12 -and $parts[0] -eq '5' -and $parts[11].Trim().Length -gt 0) {
        $left = [int]$parts[6]
        $top = [int]$parts[7]
        $width = [int]$parts[8]
        $height = [int]$parts[9]
        $g.DrawRectangle($pen, $left, $top, $width, $height)
        $drawnCount++
    }
}

$g.Dispose()
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Drew $drawnCount bounding boxes on image: $outPath"
