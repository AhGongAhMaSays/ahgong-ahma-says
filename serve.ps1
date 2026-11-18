param([int]$Port = 8123)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".mp3"  = "audio/mpeg"
  ".ttf"  = "font/ttf"
  ".woff" = "font/woff"
  ".woff2"= "font/woff2"
  ".json" = "application/json; charset=utf-8"
  ".ico"  = "image/x-icon"
}

# images/fonts/audio are re-requested by the browser every time a screen
# re-renders the same <img> (e.g. a popup's next/let's-go button) — with
# no-store on those too, each one re-downloads from scratch instead of
# coming straight from cache, which is what read as buttons "lagging in
# appearing". html/css/js keep no-store so edits during this dev session
# always show immediately.
$cacheableExt = @(".png", ".jpg", ".jpeg", ".gif", ".svg", ".mp3", ".ttf", ".woff", ".woff2", ".ico")

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $path = Join-Path $root $rel
    # -LiteralPath, not the bare positional path: Test-Path/Get-Item otherwise
    # treat [ ] ? * in a filename as wildcard glob syntax instead of literal
    # characters, so a real file like "... [歌词] ..." or "Q&A [draft].pdf"
    # fails to be found even though it exists exactly at that path.
    if ((Test-Path -LiteralPath $path) -and -not (Get-Item -LiteralPath $path).PSIsContainer) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $res.ContentType = $ct
      if ($cacheableExt -contains $ext) {
        $res.Headers.Add("Cache-Control", "public, max-age=3600")
      } else {
        $res.Headers.Add("Cache-Control", "no-store")
      }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
