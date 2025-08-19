import { onRequestPost as __api_ai_ts_onRequestPost } from "/Users/shashi/Code/TickerSugession/web/functions/api/ai.ts"
import { onRequestGet as __api_chart_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/chart.ts"
import { onRequestGet as __api_ipos_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/ipos.ts"
import { onRequestGet as __api_news_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/news.ts"
import { onRequestGet as __api_quote_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/quote.ts"
import { onRequestGet as __api_read_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/read.ts"
import { onRequestGet as __api_screener_saved_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/screener-saved.ts"
import { onRequestGet as __api_trending_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/api/trending.ts"
import { onRequestPost as __ai_ts_onRequestPost } from "/Users/shashi/Code/TickerSugession/web/functions/ai.ts"
import { onRequestGet as __chart_ts_onRequestGet } from "/Users/shashi/Code/TickerSugession/web/functions/chart.ts"

export const routes = [
    {
      routePath: "/api/ai",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_ts_onRequestPost],
    },
  {
      routePath: "/api/chart",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_chart_ts_onRequestGet],
    },
  {
      routePath: "/api/ipos",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_ipos_ts_onRequestGet],
    },
  {
      routePath: "/api/news",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_news_ts_onRequestGet],
    },
  {
      routePath: "/api/quote",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_quote_ts_onRequestGet],
    },
  {
      routePath: "/api/read",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_read_ts_onRequestGet],
    },
  {
      routePath: "/api/screener-saved",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_screener_saved_ts_onRequestGet],
    },
  {
      routePath: "/api/trending",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_trending_ts_onRequestGet],
    },
  {
      routePath: "/ai",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__ai_ts_onRequestPost],
    },
  {
      routePath: "/chart",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__chart_ts_onRequestGet],
    },
  ]