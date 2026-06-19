# Exa Search Guide for Research

## Available Tools

| Tool | When to Use |
|------|-------------|
| `mcp__exa__web_search_exa` | General web search — describe the ideal page in natural language |
| `mcp__exa__web_fetch_exa` | Fetch full content from a specific URL as clean markdown |
| `mcp__exa__web_search_advanced_exa` | Advanced search with category filters, domain restrictions, date ranges |

## Category Filters (use with advanced search)

| Category | Best For | Index Size |
|----------|----------|------------|
| `research paper` | Scientific papers, arXiv, peer-reviewed research | 100M+ papers |
| `company` | Company profiles, LinkedIn company pages | 50M+ companies |
| `people` | People profiles, LinkedIn, multi-source data | 1B+ people |
| `news` | Current events, journalism | Latest news |
| `personal site` | Expert blogs, personal pages (Exa's unique strength) | Millions |
| `financial report` | SEC filings, earnings reports | Financial data |

## Query Best Practices

1. **Describe the ideal page, not keywords:**
   - BAD: "healthtech Brazil market size"
   - GOOD: "comprehensive market analysis of the Brazilian digital health market with TAM SAM SOM data and growth projections for 2024-2030"

2. **For scientific papers, use `category: "research paper"`:**
   - "peer-reviewed study on AI-assisted medical documentation impact on consultation time and physician satisfaction"
   - "systematic review of digital health interventions for medication adherence in chronic disease patients"

3. **For expert analysis, use `category: "personal site"` or no category:**
   - "expert analysis of healthtech business models in Latin America by experienced founder or investor"
   - "detailed breakdown of B2B2C marketplace dynamics in healthcare from industry practitioner"

4. **For competitor intelligence, use `category: "company"` or `category: "news"`:**
   - "category:company Memed digital prescription platform Brazil"
   - "category:news Mevo healthtech Series B funding round details"

## Research Workflow

### Step 1: Broad Discovery (3-5 searches)
Use `web_search_exa` with varied natural language queries. Get 10 results each.

### Step 2: Filter and Prioritize
From the highlights, identify the 3-5 most relevant and authoritative sources.

### Step 3: Deep Read (fetch full content)
Use `web_fetch_exa` on the best URLs to get full article text.

### Step 4: Cross-Reference
If a finding comes from only one source, search again to verify with a second source.

### Step 5: Synthesize
Combine findings into a structured research brief with citations.

## Token Efficiency

- Use **highlights** mode for initial discovery (10x fewer tokens)
- Use **full text** (web_fetch_exa) only for the most important sources
- Set `numResults` to 5-10 for focused queries, 15-20 for broad exploration
- Always prefer Exa over generic WebSearch — Exa returns cleaner, more relevant content

## Domain Filters for Healthcare Research

Useful domains to include for high-quality healthcare research:
- `pubmed.ncbi.nlm.nih.gov` — PubMed medical research
- `scholar.google.com` — Google Scholar
- `arxiv.org` — Preprints
- `jamanetwork.com` — JAMA
- `thelancet.com` — The Lancet
- `nejm.org` — New England Journal of Medicine
- `healthaffairs.org` — Health Affairs
- `who.int` — WHO
- `bmj.com` — British Medical Journal

Brazilian healthcare sources:
- `saude.gov.br` — Ministry of Health
- `ans.gov.br` — ANS (health insurance regulator)
- `anvisa.gov.br` — ANVISA
- `portal.cfm.org.br` — CFM (medical council)
- `sbis.org.br` — SBIS (health informatics)
