# PowerShell Static Article Generator & Sitemap Builder
# Usage: powershell -ExecutionPolicy Bypass -File build_articles.ps1

$configPath = "config.json"
$guidesPath = "guides.json"

if (-not (Test-Path $configPath)) {
    Write-Error "config.json not found!"
    exit 1
}
if (-not (Test-Path $guidesPath)) {
    Write-Error "guides.json not found!"
    exit 1
}

# 1. Load data
$config = Get-Content -Raw -Path $configPath | ConvertFrom-Json
$guides = Get-Content -Raw -Path $guidesPath | ConvertFrom-Json

$settings = $config.settings
$siteName = $settings.siteName
if ($null -eq $siteName) { $siteName = "Vape 'R' Aus" }
$announcement = $settings.announcement
if ($null -eq $announcement) { $announcement = "FREE EXPRESS SHIPPING ON ALL ORDERS OVER $150!" }
$contactEmail = $settings.contactEmail
if ($null -eq $contactEmail) { $contactEmail = "vapesonlineaustralia@proton.me" }
$contactPhone = $settings.contactPhone
if ($null -eq $contactPhone) { $contactPhone = "0402 179 489" }

# Create education folder
$eduDir = "education"
if (-not (Test-Path $eduDir)) {
    New-Item -ItemType Directory -Path $eduDir | Out-Null
}

Write-Host "Compiling educational articles into static HTML pages..." -ForegroundColor Cyan

# Robust Line-by-Line Markdown to HTML parser
function Convert-ContentToHtml($content) {
    # Standardize line endings and split
    $content = $content -replace "`r", ""
    $lines = $content -split "`n"
    
    $htmlParts = @()
    $inList = $false
    $listType = "" # "ul" or "ol"
    $inTable = $false
    
    foreach ($line in $lines) {
        $l = $line.Trim()
        
        # Handle empty lines
        if ($l -eq "") {
            if ($inList) {
                $htmlParts += "</$listType>"
                $inList = $false
            }
            if ($inTable) {
                $htmlParts += "</table></div>"
                $inTable = $false
            }
            continue
        }
        
        # Handle subheaders
        if ($l.StartsWith("### ")) {
            if ($inList) { $htmlParts += "</$listType>"; $inList = $false }
            if ($inTable) { $htmlParts += "</table></div>"; $inTable = $false }
            
            $title = $l.Substring(4).Trim()
            $htmlParts += "<h3>$title</h3>"
            continue
        }
        
        # Handle tables
        if ($l.StartsWith("|")) {
            if ($inList) { $htmlParts += "</$listType>"; $inList = $false }
            if ($l -match "^\|\s*---\s*\|") { continue } # separator row
            
            if (-not $inTable) {
                $htmlParts += "<div class='table-responsive'><table class='article-table'>"
                $inTable = $true
                $isHeader = $true
            } else {
                $isHeader = $false
            }
            
            $cells = $l.Split("|") | Where-Object { $_.Trim() -ne "" }
            $rowHtml = "<tr>"
            foreach ($cell in $cells) {
                $tag = if ($isHeader) { "th" } else { "td" }
                $cleanCell = $cell.Trim() -replace "\*\*(.*?)\*\*", "<strong>`$1</strong>"
                $rowHtml += "<$tag>$cleanCell</$tag>"
            }
            $rowHtml += "</tr>"
            $htmlParts += $rowHtml
            continue
        }
        
        # If we were in table but line is not table
        if ($inTable) {
            $htmlParts += "</table></div>"
            $inTable = $false
        }
        
        # Handle lists
        $isOrdered = $l -match "^\d+\.\s+"
        $isUnordered = $l.StartsWith("* ") -or $l.StartsWith("- ")
        
        if ($isOrdered -or $isUnordered) {
            $targetListType = if ($isOrdered) { "ol" } else { "ul" }
            
            if ($inList -and $listType -ne $targetListType) {
                # Close previous list if type changed
                $htmlParts += "</$listType>"
                $inList = $false
            }
            
            if (-not $inList) {
                $htmlParts += "<$targetListType>"
                $inList = $true
                $listType = $targetListType
            }
            
            # Clean list line
            $cleanLine = $l
            if ($isOrdered) {
                $cleanLine = $cleanLine -replace "^\d+\.\s+", ""
            } else {
                $cleanLine = $cleanLine -replace "^[*]\s+|^[-]\s+", ""
            }
            $cleanLine = $cleanLine -replace "\*\*(.*?)\*\*", "<strong>`$1</strong>"
            $htmlParts += "<li>$cleanLine</li>"
            continue
        }
        
        # If we were in list but line is not list
        if ($inList) {
            $htmlParts += "</$listType>"
            $inList = $false
        }
        
        # Standard paragraph line
        $cleanLine = $l -replace "\*\*(.*?)\*\*", "<strong>`$1</strong>"
        $htmlParts += "<p>$cleanLine</p>"
    }
    
    # Close any trailing lists or tables
    if ($inList) { $htmlParts += "</$listType>" }
    if ($inTable) { $htmlParts += "</table></div>" }
    
    return $htmlParts -join "`n"
}

# 2. Iterate and generate pages
foreach ($guide in $guides) {
    $id = $guide.id
    $title = $guide.title
    $keyword = $guide.keyword
    $date = $guide.date
    $summary = $guide.summary
    $author = $guide.author
    if ($null -eq $author) { $author = "Vape 'R' Aus Education" }
    
    $parsedBody = Convert-ContentToHtml $guide.content
    
    # Calculate reading time (roughly 220 words per minute)
    $wordCount = ($guide.content -split '\s+').Length
    $readTime = [Math]::Max(1, [Math]::Round($wordCount / 220))
    
    # Template HTML
    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- SEO Meta Tags -->
  <title>$title | $siteName</title>
  <meta name="description" content="$summary">
  <meta name="keywords" content="$keyword, cheap vapes, buy smokes online australia, iget bar, cigarettes carton">
  <link rel="canonical" href="https://vaperaus.com/education/$id.html">
  
  <!-- Open Graph -->
  <meta property="og:title" content="$title | $siteName">
  <meta property="og:description" content="$summary">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://vaperaus.com/education/$id.html">
  <meta property="og:site_name" content="$siteName">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Styles -->
  <link rel="stylesheet" href="../css/design_system.css?v=9">
  <link rel="stylesheet" href="../css/main.css?v=9">
  
  <!-- Custom Article Page styling -->
  <style>
    .article-layout {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 40px;
      margin-top: 40px;
      margin-bottom: 60px;
    }
    .article-main {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 40px;
      box-shadow: var(--shadow-sm);
    }
    .article-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 25px;
      margin-bottom: 30px;
    }
    .article-title {
      font-size: 32px;
      font-family: var(--font-title);
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
      margin-bottom: 15px;
    }
    .article-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .article-meta-item span {
      color: var(--gold-accent);
      font-weight: 600;
    }
    .article-body {
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.8;
      color: var(--text-secondary);
    }
    .article-body p {
      margin-bottom: 25px;
    }
    .article-body h3 {
      font-size: 20px;
      color: #fff;
      margin-top: 35px;
      margin-bottom: 15px;
      font-family: var(--font-title);
      font-weight: 600;
    }
    .article-body ul, .article-body ol {
      margin-bottom: 25px;
      padding-left: 20px;
    }
    .article-body li {
      margin-bottom: 10px;
    }
    .article-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      font-size: 14px;
      text-align: left;
    }
    .article-table th {
      background: rgba(212, 175, 55, 0.1);
      color: var(--gold-accent);
      font-weight: 600;
      padding: 12px;
      border: 1px solid var(--border-color);
    }
    .article-table td {
      padding: 12px;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
    .sidebar-sticky {
      position: sticky;
      top: 100px;
      display: flex;
      flex-direction: column;
      gap: 25px;
    }
    .sidebar-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 25px;
      box-shadow: var(--shadow-sm);
    }
    .sidebar-title {
      font-size: 18px;
      font-family: var(--font-title);
      color: #fff;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
    }
    .sidebar-product {
      display: flex;
      gap: 15px;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px dashed rgba(255,255,255,0.05);
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .sidebar-product:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .sidebar-product:hover {
      opacity: 0.8;
    }
    .sidebar-product img {
      width: 60px;
      height: 60px;
      object-fit: contain;
      background: rgba(255,255,255,0.02);
      border-radius: 6px;
      border: 1px solid var(--border-color);
      padding: 4px;
    }
    .sidebar-product-info {
      flex: 1;
    }
    .sidebar-product-name {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }
    .sidebar-product-price {
      font-size: 13px;
      color: var(--gold-accent);
      font-weight: 700;
    }
    @media (max-width: 992px) {
      .article-layout {
        grid-template-columns: 1fr;
      }
      .sidebar-sticky {
        position: static;
      }
    }
    @media (max-width: 576px) {
      .article-main {
        padding: 25px;
      }
      .article-title {
        font-size: 24px;
      }
    }
  </style>
  
  <!-- Schema.org JSON-LD structured data for Google Search -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://vaperaus.com/education/$id.html"
    },
    "headline": "$title",
    "description": "$summary",
    "datePublished": "$date",
    "dateModified": "$date",
    "author": {
      "@type": "Organization",
      "name": "$siteName"
    },
    "publisher": {
      "@type": "Organization",
      "name": "$siteName",
      "logo": {
        "@type": "ImageObject",
        "url": "https://vaperaus.com/img/logo.png"
      }
    }
  }
  </script>
</head>
<body>

  <div class="main-wrapper">
    <!-- PROMO BANNER -->
    <div class="promo-banner" style="background: linear-gradient(90deg, #12141c 0%, #1d190e 50%, #12141c 100%); border-bottom: 1px solid rgba(212, 175, 55, 0.25); color: #fff; padding: 14px 20px; font-size: 15px; font-family: var(--font-body); display: flex; justify-content: center; align-items: center; gap: 12px; z-index: 1000; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
      <span class="promo-badge" style="background: var(--gold-accent); color: #000; font-weight: 800; padding: 4px 12px; border-radius: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 10px rgba(212,175,55,0.3);">PROMO</span>
      <span style="letter-spacing: 0.2px; text-transform: uppercase; font-weight: 600;">Sorry, but all Alibarbar prizes have been won. — FREE SHIPPING ON ALL ORDERS OVER $150!</span>
    </div>

    <!-- ANNOUNCEMENT BAR -->
    <div class="announcement-bar">
      <p>$announcement</p>
    </div>

    <!-- MAIN HEADER -->
    <header class="main-header">
      <div class="container header-container" style="justify-content: space-between;">
        <a href="../index.html" class="logo-link" style="display:flex; align-items:center; height:100%;">
          <img src="../img/logo.png" alt="Vape 'R' Aus Logo" style="height:50px; object-fit:contain; filter: drop-shadow(0 0 4px rgba(255,255,255,0.15));">
        </a>
        <div class="header-actions">
          <a href="../index.html#catalog" class="btn-primary" style="text-decoration:none; padding:10px 20px; font-size:14px;">SHOP STOREFRONT</a>
        </div>
      </div>
    </header>

    <!-- CONTENT WRAPPER -->
    <main class="container">
      <div class="article-layout">
        
        <!-- Main Article Panel -->
        <article class="article-main">
          <div class="article-header">
            <h1 class="article-title">$title</h1>
            <div class="article-meta-row">
              <div class="article-meta-item">Published: <span>$date</span></div>
              <div class="article-meta-item">Author: <span>$author</span></div>
              <div class="article-meta-item">Reading Time: <span>$readTime min read</span></div>
            </div>
          </div>
          
          <div class="article-body">
            $parsedBody
          </div>
        </article>
        
        <!-- Sidebar CTAs -->
        <aside class="article-sidebar">
          <div class="sidebar-sticky">
            
            <div class="sidebar-card">
              <h4 class="sidebar-title">Shop Best Sellers</h4>
              
              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/iget_bar_opt1_1783090988615.png" alt="IGET Bar 3500">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">IGET Bar 3500 Puffs</div>
                  <div class="sidebar-product-price">From `$33.00</div>
                </div>
              </a>
              
              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/jnr_vapro_7000_1783089462854.png" alt="JNR Vapro 7000">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">JNR Vapro 7000 Puffs</div>
                  <div class="sidebar-product-price">From `$35.00</div>
                </div>
              </a>

              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/winfield_blue_carton_1782979619147.png" alt="Winfield Blue Carton">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">Winfield Blue Carton (10x25s)</div>
                  <div class="sidebar-product-price">From `$260.00</div>
                </div>
              </a>

              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/marlboro_gold_carton_1783089227796.png" alt="Marlboro Gold Carton">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">Marlboro Gold Carton (10x20s)</div>
                  <div class="sidebar-product-price">From `$250.00</div>
                </div>
              </a>
              
            </div>

            <div class="sidebar-card" style="background: linear-gradient(135deg, #1d190e 0%, #12141c 100%); border-color: rgba(212,175,55,0.3); text-align: center;">
              <h4 class="sidebar-title" style="border-bottom:none; margin-bottom:10px;">Why Buy From Us?</h4>
              <p style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:20px;">
                We ship express from Melbourne within 48 hours. Discreet packaging, bulk discounts, and the cheapest prices in Australia guaranteed.
              </p>
              <a href="../index.html#catalog" class="btn-primary" style="display:block; text-decoration:none; padding:12px; font-size:13px;">SHOP CATALOG</a>
            </div>

          </div>
        </aside>
        
      </div>
    </main>

    <!-- FOOTER -->
    <footer class="main-footer" style="margin-top:60px;">
      <div class="container footer-grid">
        <div>
          <h3 class="footer-col-title">$siteName</h3>
          <p style="font-size: 13px; line-height: 1.6; color: var(--text-muted); margin-bottom: 20px;">
            Australia's leading discount outlet for bulk cigarette cartons and high puff disposable vapes. Express post nationwide.
          </p>
        </div>
        
        <div>
          <h3 class="footer-col-title">Product Catalog</h3>
          <ul class="footer-links">
            <li><a href="../index.html#catalog">Browse Storefront</a></li>
            <li><a href="../index.html#faq">FAQ</a></li>
          </ul>
        </div>
        
        <div>
          <h3 class="footer-col-title">Support</h3>
          <ul class="footer-links">
            <li><a href="../index.html#contact-us">Contact Us</a></li>
          </ul>
        </div>
        
        <div>
          <h3 class="footer-col-title">Order Info</h3>
          <div class="footer-contact-item">
            <span class="footer-contact-icon">✉</span>
            <span>$contactEmail</span>
          </div>
          <div class="footer-contact-item">
            <span class="footer-contact-icon">☎</span>
            <span>$contactPhone</span>
          </div>
        </div>
      </div>
      
      <div class="container">
        <div class="footer-bottom">
          <div class="footer-copy">
            &copy; 2026 $siteName. All rights reserved.
          </div>
          <div style="display: flex; gap: 15px; color: var(--text-muted); font-size:11px;">
            <span>PayID &amp; Bank Transfer Only</span>
            <span style="opacity:0.3;">|</span>
            <span>18+ Age Restricted</span>
          </div>
        </div>
      </div>
    </footer>

  </div>

</body>
</html>
"@
    
    # Write file
    $outPath = Join-Path $eduDir "$id.html"
    $html | Out-File -FilePath $outPath -Encoding utf8 -Force
    Write-Host "Generated: $outPath" -ForegroundColor Green
}

# 3. Generate sitemap.xml
Write-Host "Building sitemap.xml..." -ForegroundColor Cyan

$sitemap = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://vaperaus.com/index.html</loc>
    <priority>1.0</priority>
  </url>
"@

foreach ($guide in $guides) {
    $id = $guide.id
    $sitemap += @"

  <url>
    <loc>https://vaperaus.com/education/$id.html</loc>
    <priority>0.8</priority>
  </url>
"@
}

$sitemap += "`n</urlset>"
$sitemap | Out-File -FilePath "sitemap.xml" -Encoding utf8 -Force
Write-Host "Generated: sitemap.xml" -ForegroundColor Green
Write-Host "All operations completed successfully!" -ForegroundColor Green
