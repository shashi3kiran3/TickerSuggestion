var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ai.ts
var onRequestPost = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  try {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }
    const payload = await request.json();
    const model = payload?.model || "gpt-4o-mini";
    const messages = payload?.messages;
    const response_format = payload?.response_format;
    const temperature = typeof payload?.temperature === "number" ? payload.temperature : 0.3;
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, response_format, temperature })
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "proxy_error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestPost");

// api/chart.ts
var onRequestGet = /* @__PURE__ */ __name(async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol") || "SPY";
    const range = url.searchParams.get("range") || "2y";
    const interval = url.searchParams.get("interval") || "1d";
    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    const headers = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "application/json, text/plain, */*",
      referer: "https://finance.yahoo.com/",
      "accept-language": "en-US,en;q=0.9"
    };
    const ep = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplit`;
    const resp = await fetch(ep, { headers });
    if (resp.ok) {
      const text = await resp.text();
      const response = new Response(text, {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "s-maxage=600" }
      });
      await cache.put(cacheKey, response.clone());
      return response;
    }
    const key = env.ALPHA_VANTAGE_KEY;
    if (key) {
      const av = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(
          symbol
        )}&outputsize=${range === "10y" || range === "5y" ? "full" : "compact"}&apikey=${encodeURIComponent(key)}`
      );
      const data = await av.json();
      const series = data?.["Time Series (Daily)"] || {};
      const entries = Object.entries(series);
      entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
      const timestamp = [];
      const open = [];
      const high = [];
      const low = [];
      const close = [];
      for (const [date, ohlc] of entries) {
        timestamp.push(new Date(date).getTime() / 1e3);
        open.push(parseFloat(ohlc["1. open"]));
        high.push(parseFloat(ohlc["2. high"]));
        low.push(parseFloat(ohlc["3. low"]));
        close.push(parseFloat(ohlc["4. close"]));
      }
      const payload = {
        chart: {
          result: [
            {
              timestamp,
              indicators: { quote: [{ open, high, low, close }] }
            }
          ]
        }
      };
      const response = new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "s-maxage=600" }
      });
      await cache.put(cacheKey, response.clone());
      return response;
    }
    return new Response(JSON.stringify({ chart: { result: [] }, error: "upstream_unavailable" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ chart: { result: [] }, error: "proxy_error" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestGet");

// api/ipos.ts
var onRequestGet2 = /* @__PURE__ */ __name(async () => {
  try {
    const urls = [
      "https://api.nasdaq.com/api/ipo/calendar",
      "https://www.nasdaq.com/api/v3/calendar/ipos"
    ];
    for (const u of urls) {
      const resp = await fetch(u, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json,text/csv,*/*" } });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (text.length < 10) continue;
      return new Response(text, { status: 200, headers: { "content-type": resp.headers.get("content-type") || "text/plain" } });
    }
  } catch {
  }
  return new Response(JSON.stringify({ error: "unavailable" }), { status: 200, headers: { "content-type": "application/json" } });
}, "onRequestGet");

// api/news.ts
var onRequestGet3 = /* @__PURE__ */ __name(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(25, Math.max(1, parseInt(url.searchParams.get("pageSize") || "10")));
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const sourceFilter = (url.searchParams.get("source") || "").trim();
    const perSource = Math.min(20, Math.max(3, parseInt(url.searchParams.get("perSource") || "12")));
    const headers = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "application/rss+xml, application/xml, text/xml, */*"
    };
    const cache = caches.default;
    const cacheKey = new Request(`https://news-cache.invalid${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
      method: "GET"
    });
    const cached = await cache.match(cacheKey);
    let items;
    if (cached) {
      items = await cached.json();
    } else {
      const feeds = [
        { name: "CNBC", url: "https://www.cnbc.com/id/10001147/device/rss/rss.html" },
        // Markets
        { name: "Reuters", url: "https://feeds.reuters.com/reuters/businessNews" },
        { name: "Yahoo Finance", url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US" },
        { name: "MarketWatch", url: "https://www.marketwatch.com/feeds/topstories" },
        { name: "Nasdaq", url: "https://www.nasdaq.com/feed/rssoutbound?category=Stock-Market-News" },
        { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml" },
        { name: "Financial Times", url: "https://www.ft.com/rss/home" },
        { name: "TheStreet", url: "https://www.thestreet.com/.rss/full/" },
        { name: "Investing.com", url: "https://www.investing.com/rss/news.rss" },
        { name: "PR Newswire", url: "https://www.prnewswire.com/rss/all-news.rss" },
        { name: "Business Wire", url: "https://www.businesswire.com/portal/site/home/rss/" },
        { name: "SEC", url: "https://www.sec.gov/news/pressreleases.rss" }
      ];
      const gq = q ? q : "stock market";
      feeds.push({
        name: "Google News",
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(gq)}&hl=en-US&gl=US&ceid=US:en`
      });
      const results = await Promise.allSettled(
        feeds.map(async (f) => {
          const text = await fetchWithTimeout(f.url, { headers }, 7e3);
          const parsed = parseRss(text, f.name);
          return parsed.slice(0, perSource);
        })
      );
      let all = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
      const mTicker = /\b[A-Z]{1,5}\b/.exec(q || "");
      if (mTicker) {
        const sym = mTicker[0];
        try {
          const st = await fetchWithTimeout(
            `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(sym)}.json`,
            { headers: { "user-agent": headers["user-agent"] } },
            4e3
          );
          const data = JSON.parse(st);
          const msgs = (data?.messages || []).slice(0, perSource);
          const mapped = msgs.map((m) => ({
            id: hash(`st_${m.id}`),
            title: (m?.body || "").slice(0, 140),
            url: m?.entities?.links?.[0]?.url || `https://stocktwits.com/${m?.user?.username || ""}/message/${m?.id}`,
            source: "StockTwits",
            publishedAt: m?.created_at,
            description: m?.body || void 0
          }));
          all = all.concat(mapped);
        } catch {
        }
      }
      items = rankAndDedupe(filterStockMarket(all));
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(items), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "s-maxage=60" }
        })
      );
    }
    let filtered = items;
    if (sourceFilter && sourceFilter !== "All") filtered = filtered.filter((i) => i.source === sourceFilter);
    if (q) filtered = filtered.filter((i) => i.title.toLowerCase().includes(q));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageItems = filtered.slice(start, end);
    return new Response(JSON.stringify({ items: pageItems, total }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ items: [], total: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestGet");
function parseRss(xml, source) {
  const items = [];
  const regex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while (m = regex.exec(xml)) {
    const block = m[1];
    const rawTitle = extract(block, "title");
    const title = sanitizeRss(rawTitle || "", false);
    const link = extract(block, "link");
    const pubDate = extract(block, "pubDate");
    const rawDesc = extract(block, "description") || extract(block, "content:encoded");
    const desc = rawDesc ? sanitizeRss(rawDesc, true) : null;
    if (!title || !link) continue;
    items.push({ id: hash(link), title, url: link, source, publishedAt: pubDate || void 0, description: desc || void 0 });
  }
  return items;
}
__name(parseRss, "parseRss");
function extract(block, tag) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  if (!m) return null;
  return decodeHtml(m[1].trim());
}
__name(extract, "extract");
function decodeHtml(s) {
  return s.replace(/<!\[CDATA\[/g, "").replace(/]]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
__name(decodeHtml, "decodeHtml");
function sanitizeRss(s, stripTags) {
  let out = decodeHtml(s || "");
  if (stripTags) {
    out = out.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}
__name(sanitizeRss, "sanitizeRss");
function rankAndDedupe(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out.sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt));
}
__name(rankAndDedupe, "rankAndDedupe");
function dateMs(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}
__name(dateMs, "dateMs");
function filterStockMarket(items) {
  const re = /(stock|stocks|share|shares|market|wall street|fed|rates|yields|earnings|guidance|upgrade|downgrade|price target|pre[- ]?market|after[- ]?hours|nasdaq|s&p|dow|ipo|dividend|buyback|sec|fed|treasury|bond)/i;
  const tickerLike = /\b[A-Z]{1,5}\b/;
  return items.filter((n) => {
    const t = n.title || "";
    return re.test(t) || tickerLike.test(t);
  });
}
__name(filterStockMarket, "filterStockMarket");
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return `id_${h}`;
}
__name(hash, "hash");
async function fetchWithTimeout(url, init, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return await resp.text();
  } finally {
    clearTimeout(id);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");

// api/quote.ts
var onRequestGet4 = /* @__PURE__ */ __name(async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const symbols = (url.searchParams.get("symbols") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50).join(",");
    if (!symbols) return new Response(JSON.stringify({ quoteResponse: { result: [] } }), { status: 200 });
    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    const headers = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "application/json, text/plain, */*",
      referer: "https://finance.yahoo.com/",
      "accept-language": "en-US,en;q=0.9"
    };
    const endpoints = [
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`,
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`
    ];
    for (const ep of endpoints) {
      const resp = await fetch(ep, { headers });
      if (resp.ok) {
        const text = await resp.text();
        const response = new Response(text, {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "s-maxage=300" }
        });
        await cache.put(cacheKey, response.clone());
        return response;
      }
      if (![401, 403, 429, 500, 502, 503].includes(resp.status)) {
        const text = await resp.text();
        return new Response(text, { status: resp.status, headers: { "content-type": "application/json" } });
      }
    }
    const key = env.ALPHA_VANTAGE_KEY;
    if (key) {
      const syms = symbols.split(",").slice(0, 5);
      const results = [];
      for (const s of syms) {
        try {
          const av = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(s)}&apikey=${encodeURIComponent(
              key
            )}`
          );
          const data = await av.json();
          const q = data?.["Global Quote"];
          if (q) {
            results.push({ symbol: q["01. symbol"] || s, quoteType: "EQUITY" });
          }
        } catch {
        }
      }
      const response = new Response(JSON.stringify({ quoteResponse: { result: results }, source: "alphavantage" }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "s-maxage=300" }
      });
      await cache.put(cacheKey, response.clone());
      return response;
    }
    return new Response(JSON.stringify({ quoteResponse: { result: [] }, error: "upstream_unavailable" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ quoteResponse: { result: [] }, error: "proxy_error" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestGet");

// api/read.ts
var onRequestGet5 = /* @__PURE__ */ __name(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const target = url.searchParams.get("url") || "";
    if (!target) return new Response("", { status: 200 });
    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5e3);
    try {
      const readerUrl = `https://r.jina.ai/http://${target.replace(/^https?:\/\//, "")}`;
      const resp = await fetch(readerUrl, {
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0", accept: "text/plain,*/*" }
      });
      if (resp.ok) {
        const text = await resp.text();
        const response = new Response(text || "", {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "s-maxage=600" }
        });
        await cache.put(cacheKey, response.clone());
        return response;
      }
    } catch {
    }
    clearTimeout(id);
    try {
      const resp = await fetch(target, { headers: { "user-agent": "Mozilla/5.0" } });
      const html = await resp.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const response = new Response(text, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "s-maxage=600" }
      });
      await cache.put(cacheKey, response.clone());
      return response;
    } catch {
    }
    return new Response("", { status: 200 });
  } catch {
    return new Response("", { status: 200 });
  }
}, "onRequestGet");

// api/screener-saved.ts
var onRequestGet6 = /* @__PURE__ */ __name(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const scrIds = url.searchParams.get("scrIds") || "most_actives";
    const count = url.searchParams.get("count") || "50";
    const yf = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=${encodeURIComponent(
      count
    )}&scrIds=${encodeURIComponent(scrIds)}`;
    const resp = await fetch(yf, { headers: { "user-agent": "Mozilla/5.0" } });
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ quotes: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestGet");

// api/trending.ts
var onRequestGet7 = /* @__PURE__ */ __name(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const region = url.searchParams.get("region") || "US";
    const count = url.searchParams.get("count") || "25";
    const yf = `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}?count=${encodeURIComponent(
      count
    )}`;
    const resp = await fetch(yf, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!resp.ok) return new Response(JSON.stringify({ symbols: [] }), { status: 200 });
    const data = await resp.json();
    const lists = data?.finance?.result || [];
    const symbols = [];
    for (const l of lists) {
      for (const q of l?.quotes || []) {
        if (q?.symbol) symbols.push(q.symbol);
      }
    }
    const uniq = Array.from(new Set(symbols));
    return new Response(JSON.stringify({ symbols: uniq }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ symbols: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestGet");

// chart.ts
var onRequestGet8 = /* @__PURE__ */ __name(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol") || "SPY";
    const range = url.searchParams.get("range") || "2y";
    const interval = url.searchParams.get("interval") || "1d";
    const yf = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplit`;
    const resp = await fetch(yf, { headers: { "user-agent": "Mozilla/5.0" } });
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "chart_fetch_error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}, "onRequestGet");

// ../.wrangler/tmp/pages-Z5DQ4K/functionsRoutes-0.9547510463415301.mjs
var routes = [
  {
    routePath: "/api/ai",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/chart",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/ipos",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/news",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/quote",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/read",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/screener-saved",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/trending",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/ai",
    mountPath: "/",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/chart",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  }
];

// ../node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-XNDw0E/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-XNDw0E/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.008736202404062143.mjs.map
