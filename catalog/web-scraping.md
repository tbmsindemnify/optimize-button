# Web search and scraping tools for agents (what the Optimize button knows about)

Checked 2026-10-24. The refresh job watches the official docs in `guidance/sources.json`.

| Tool | What it does | Open source | Notes the button applies |
|---|---|---|---|
| Firecrawl | search, scrape, crawl a whole site, map, extract structured data, interact (runs a real browser); returns clean markdown for models | yes (core), hosted API | default for "read this page/site clean"; cite the page with every fact |
| Exa | neural search over its own index: finds pages by meaning, returns contents/highlights; Websets for research lists; MCP server | no (hosted) | default for "find the pages that answer X"; **its privacy policy lets self-serve plans use queries for training; zero-retention is Enterprise** — never put client data in a query |
| Tavily | search API tuned for agents/RAG, with extraction | no (hosted) | alternative to Exa; same query-leaves-the-building caution |
| Crawl4AI | open-source Python crawler built for LLM pipelines | yes | self-hosted crawling when data must stay local |
| Jina Reader | URL → clean text/markdown | hosted + open components | quick single-page reads |
| Playwright / Browserbase | scripted real browsers | yes / hosted | logins, dynamic pages, forms |
| Perplexity Search API | search with answers; led a Sept 2026 independent accuracy benchmark (openbenchmarks.com) | no | when the task is "answer with sources" rather than "give me pages" |

Pairing that works: **Exa finds, Firecrawl reads.** Exa returns the five pages that match what you meant; Firecrawl turns each into clean text; the model gets exactly the pages that matter, with the source attached to every fact.

Rule the button enforces: the question can leave the building, the file cannot. Searches go out; client files, PII and internal strategy never go into a search query or a hosted scraper.
