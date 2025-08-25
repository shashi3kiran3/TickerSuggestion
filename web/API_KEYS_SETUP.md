# API Keys Setup Guide

## Overview
This application now supports multiple data sources for more reliable stock data. You can use free tiers or paid plans for better reliability.

## Recommended Data Sources (in order of preference)

### 1. **Polygon.io** (Recommended - Best Free Tier)
- **Free Tier**: 5 API calls/minute
- **Paid**: $29/month (unlimited real-time)
- **Signup**: https://polygon.io/
- **API Key**: Get from dashboard after signup

### 2. **Finnhub** (Good Free Tier)
- **Free Tier**: 60 API calls/minute
- **Paid**: $9.99/month (unlimited)
- **Signup**: https://finnhub.io/
- **API Key**: Get from dashboard after signup

### 3. **IEX Cloud** (Good Free Tier)
- **Free Tier**: 500,000 messages/month
- **Paid**: $9/month (unlimited)
- **Signup**: https://iexcloud.io/
- **API Key**: Get from dashboard after signup

### 4. **Alpha Vantage** (Limited Free Tier)
- **Free Tier**: 5 API calls/minute
- **Paid**: $49.99/month (unlimited)
- **Signup**: https://www.alphavantage.co/
- **API Key**: Get from dashboard after signup

## Setup Instructions

### 1. Get API Keys
1. Sign up for at least one of the services above
2. Get your API key from their dashboard
3. For best results, get keys from multiple services

### 2. Configure Environment Variables
Add these to your `web/.dev.vars` file:

```bash
# Existing
OPENAI_API_KEY=your_openai_key_here

# New data sources (add at least one)
POLYGON_KEY=sd
FINNHUB_KEY=your_finnhub_key_here
IEX_KEY=your_iex_key_here
ALPHA_VANTAGE_KEY=your_alphavantage_key_here
```

### 3. For Production (Cloudflare Pages)
Add these environment variables in your Cloudflare Pages dashboard:
1. Go to your project settings
2. Navigate to "Environment variables"
3. Add each API key as a secret

## Features Available with Better Data Sources

### Technical Analysis (New!)
- **Support/Resistance Levels**: Key price levels to watch
- **Trend Prediction**: UP/DOWN/NEUTRAL with confidence
- **Entry/Exit Prices**: Suggested buy/sell points
- **Stop Loss Levels**: Risk management
- **Risk/Reward Ratios**: 3:1 ratio for better trades
- **Confidence Levels**: HIGH/MEDIUM/LOW

### Enhanced Data Quality
- **Real-time Prices**: More accurate and frequent updates
- **Volume Data**: Better trading volume information
- **52-week High/Low**: More reliable historical data
- **Multiple Sources**: Fallback if one source fails

## Cost Comparison

| Service | Free Tier | Paid Plan | Best For |
|---------|-----------|-----------|----------|
| Polygon.io | 5 calls/min | $29/month | Real-time data, best free tier |
| Finnhub | 60 calls/min | $9.99/month | Good balance of free/paid |
| IEX Cloud | 500K msgs/month | $9/month | High volume, good pricing |
| Alpha Vantage | 5 calls/min | $49.99/month | Comprehensive data |

## Recommendation
1. **Start with Polygon.io** - Best free tier
2. **Add Finnhub** - Good backup source
3. **Consider IEX Cloud** - If you need high volume
4. **Skip Alpha Vantage** - Expensive for what it offers

## Testing Your Setup
After adding API keys, test with:
```bash
curl "http://localhost:8788/api/quote?symbols=AAPL,MSFT"
```

You should see:
- Real-time prices
- Technical analysis data
- Source information (e.g., "Data from Polygon.io")
- Support/resistance levels
- Entry/exit recommendations
