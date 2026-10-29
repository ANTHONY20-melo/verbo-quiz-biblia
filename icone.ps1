# VERBO - Gerador de icones PWA (192 e 512) via System.Drawing
Add-Type -AssemblyName System.Drawing

function Make-Icon {
  param([int]$Size, [string]$Out)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  # fundo escuro do app
  $g.Clear([System.Drawing.Color]::FromArgb(13, 17, 23))

  # vineta radial dourada (glow)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
  $center = New-Object System.Drawing.Point([int](${Size} * 0.5), [int](${Size} * 0.42))
  $radial = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radial.AddEllipse($Size * 0.1, $Size * 0.1, $Size * 0.8, $Size * 0.8)
  $pathBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($radial)
  $pathBrush.CenterColor = [System.Drawing.Color]::FromArgb(80, 224, 164, 28)
  $pathBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(13, 17, 23))
  $g.FillPath($pathBrush, $radial)

  # letra V serifada dourada
  $font = New-Object System.Drawing.Font('Georgia', [float](${Size} * 0.52), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $ink = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 201, 92))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $boxY = [float](${Size} * -0.02)
  $box = New-Object System.Drawing.RectangleF ([float]0), $boxY, ([float]${Size}), ([float]${Size})
  $g.DrawString('V', $font, $ink, $box, $sf)

  # anel dourado
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 201, 92), [float](${Size} * 0.035))
  $inset = ${Size} * 0.075
  $g.DrawEllipse($pen, $inset, $inset, ${Size} - 2 * $inset, ${Size} - 2 * $inset)

  # halo de brilho no V (retrolook)
  $g.Dispose()

  # export PNG
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK icon $Out ($Size x $Size)"
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Make-Icon -Size 192 -Out (Join-Path $here 'icon-192.png')
Make-Icon -Size 512 -Out (Join-Path $here 'icon-512.png')
