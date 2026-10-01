import * as cheerio from "cheerio"

export interface SiteAnalysis {
  url: string
  title: string | null
  description: string | null
  colors: string[]
  fonts: string[]
  headings: string[]
  og_image: string | null
  og_title: string | null
  og_description: string | null
  keywords: string[]
  main_text: string
  links_count: number
  has_blog: boolean
  has_ecommerce: boolean
  technologies: string[]
  error: string | null
}

function extractColors(html: string): string[] {
  const colorPatterns = [
    /#[0-9a-fA-F]{3,8}/g,
    /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g,
    /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/g,
    /hsl\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)/g,
  ]

  const allColors: string[] = []
  for (const pattern of colorPatterns) {
    const matches = html.match(pattern) || []
    allColors.push(...matches)
  }

  // Deduplicate and return top 10 most common
  const counts = new Map<string, number>()
  for (const color of allColors) {
    const normalized = color.toLowerCase().trim()
    counts.set(normalized, (counts.get(normalized) || 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([color]) => color)
}

function extractFonts(html: string): string[] {
  const fontPatterns = [
    /font-family:\s*['"]?([^;'"}\n]+)/gi,
    /fonts\.googleapis\.com\/css2?\?family=([^"&\s]+)/gi,
    /fonts\.bunny\.net\/css\?family=([^"&\s]+)/gi,
  ]

  const fonts = new Set<string>()
  for (const pattern of fontPatterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      const fontName = decodeURIComponent(match[1])
        .split(",")[0]
        .replace(/['"]/g, "")
        .trim()
      if (fontName && fontName.length < 50) {
        fonts.add(fontName)
      }
    }
  }

  return Array.from(fonts.values()).slice(0, 10)
}

function detectTechnologies($: cheerio.CheerioAPI, html: string): string[] {
  const techs: string[] = []

  if (html.includes("wp-content") || html.includes("wordpress")) techs.push("WordPress")
  if (html.includes("shopify")) techs.push("Shopify")
  if (html.includes("__next")) techs.push("Next.js")
  if (html.includes("__nuxt")) techs.push("Nuxt.js")
  if (html.includes("react")) techs.push("React")
  if (html.includes("vue")) techs.push("Vue.js")
  if (html.includes("bootstrap")) techs.push("Bootstrap")
  if (html.includes("tailwind")) techs.push("Tailwind CSS")
  if (html.includes("gtag") || html.includes("google-analytics")) techs.push("Google Analytics")
  if (html.includes("fbq(") || html.includes("facebook.net")) techs.push("Meta Pixel")
  if ($('meta[name="generator"]').attr("content")) {
    techs.push($('meta[name="generator"]').attr("content") || "")
  }

  return Array.from(new Set(techs).values())
}

export async function analyzeSite(url: string): Promise<SiteAnalysis> {
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`

    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentTeamAI/1.0)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove scripts and styles for text extraction
    $("script, style, noscript, iframe").remove()

    const headings = $("h1, h2, h3")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((h) => h.length > 0)
      .slice(0, 20)

    const mainText = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000)

    const metaKeywords = $('meta[name="keywords"]').attr("content") || ""
    const keywords = metaKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

    const allLinks = $("a[href]").length
    const hasBlog =
      $('a[href*="blog"]').length > 0 ||
      $('a[href*="artigo"]').length > 0 ||
      $('a[href*="post"]').length > 0
    const hasEcommerce =
      $('a[href*="produto"]').length > 0 ||
      $('a[href*="product"]').length > 0 ||
      $('a[href*="shop"]').length > 0 ||
      $('a[href*="loja"]').length > 0 ||
      $(".price, .preco, [data-price]").length > 0

    return {
      url: normalizedUrl,
      title: $("title").text().trim() || null,
      description: $('meta[name="description"]').attr("content") || null,
      colors: extractColors(html),
      fonts: extractFonts(html),
      headings,
      og_image: $('meta[property="og:image"]').attr("content") || null,
      og_title: $('meta[property="og:title"]').attr("content") || null,
      og_description: $('meta[property="og:description"]').attr("content") || null,
      keywords,
      main_text: mainText,
      links_count: allLinks,
      has_blog: hasBlog,
      has_ecommerce: hasEcommerce,
      technologies: detectTechnologies($, html),
      error: null,
    }
  } catch (error) {
    return {
      url,
      title: null,
      description: null,
      colors: [],
      fonts: [],
      headings: [],
      og_image: null,
      og_title: null,
      og_description: null,
      keywords: [],
      main_text: "",
      links_count: 0,
      has_blog: false,
      has_ecommerce: false,
      technologies: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}
