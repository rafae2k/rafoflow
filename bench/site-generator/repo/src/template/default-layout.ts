/**
 * Layout used when the source dir has no `_layout.html`. Variables:
 * site.title, site.lang, page.title, page.description, page.route, rootUrl,
 * nav (raw), content (raw), plus any plugin variables (e.g. readingTime).
 */
export const DEFAULT_LAYOUT = `<!doctype html>
<html lang="{{site.lang}}">
<head>
<meta charset="utf-8">
<meta name="generator" content="site-generator">
<meta name="description" content="{{page.description}}">
<title>{{page.title}} · {{site.title}}</title>
</head>
<body>
<header class="site-header"><a href="{{rootUrl}}index.html">{{site.title}}</a></header>
{{{nav}}}
<main>
<article>
<p class="page-meta">{{readingTime}}</p>
{{{content}}}
</article>
</main>
</body>
</html>
`;

export const LAYOUT_FILE = "_layout.html";
