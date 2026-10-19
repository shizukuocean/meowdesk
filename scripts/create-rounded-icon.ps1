param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPng,

  [Parameter(Mandatory = $true)]
  [string]$OutputIco,

  [int]$Size = 256,
  [int]$Radius = 52
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($InputPath)
$bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

$diameter = $Radius * 2
$clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$clipPath.AddArc(0, 0, $diameter, $diameter, 180, 90)
$clipPath.AddArc($Size - $diameter, 0, $diameter, $diameter, 270, 90)
$clipPath.AddArc($Size - $diameter, $Size - $diameter, $diameter, $diameter, 0, 90)
$clipPath.AddArc(0, $Size - $diameter, $diameter, $diameter, 90, 90)
$clipPath.CloseFigure()

$scale = [Math]::Max($Size / $source.Width, $Size / $source.Height)
$drawWidth = [float]($source.Width * $scale)
$drawHeight = [float]($source.Height * $scale)
$drawX = [float](($Size - $drawWidth) / 2)
$drawY = [float](($Size - $drawHeight) / 2)
$dest = New-Object System.Drawing.RectangleF $drawX, $drawY, $drawWidth, $drawHeight

$graphics.SetClip($clipPath)
$graphics.DrawImage($source, $dest)
$graphics.ResetClip()

$shadowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(42, 0, 0, 0)), 2
$graphics.DrawPath($shadowPen, $clipPath)

$outputDir = Split-Path -Parent $OutputPng
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$bitmap.Save($OutputPng, [System.Drawing.Imaging.ImageFormat]::Png)

$pngBytes = [System.IO.File]::ReadAllBytes($OutputPng)
$stream = [System.IO.File]::Create($OutputIco)
$writer = New-Object System.IO.BinaryWriter($stream)

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$pngBytes.Length)
$writer.Write([UInt32]22)
$writer.Write($pngBytes)

$writer.Close()
$stream.Close()
$shadowPen.Dispose()
$clipPath.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$source.Dispose()

Get-Item -LiteralPath $OutputIco
