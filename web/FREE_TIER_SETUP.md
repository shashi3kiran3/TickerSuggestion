# Free Tier API Setup Guide

## 🎯 Goal: Maximum Data Availability with Zero Cost

This guide will help you set up **ALL** free tier API keys to create a robust fallback system. When one service hits its rate limit, the system automatically switches to the next available source.

## 📊 Free Tier Limits Summary

| Service | Free Tier | Rate Limit | Setup Time | Reliability |
|---------|-----------|------------|------------|-------------|
| **Polygon.io** | 5 calls/min | Very Low | 2 min | ⭐⭐⭐⭐⭐ |
| **Finnhub** | 60 calls/min | Good | 2 min | ⭐⭐⭐⭐ |
| **IEX Cloud** | 500K msgs/month | Excellent | 2 min | ⭐⭐⭐⭐⭐ |
| **Alpha Vantage** | 5 calls/min | Very Low | 2 min | ⭐⭐⭐ |
| **Yahoo Finance** | Unlimited | Unlimited | 0 min | ⭐⭐ |

## 🚀 Quick Setup (5 minutes)

### Step 1: Get API Keys (2 minutes each)

#### 1. **Polygon.io** (Best Free Tier)
1. Go to https://polygon.io/
2. Click "Get Started Free"
3. Sign up with email
4. Get API key from dashboard
5. **Rate Limit**: 5 calls/minute

#### 2. **Finnhub** (Good Backup)
1. Go to https://finnhub.io/
2. Click "Get free API key"
3. Sign up with email
4. Get API key from dashboard
5. **Rate Limit**: 60 calls/minute

#### 3. **IEX Cloud** (Best Volume)
1. Go to https://iexcloud.io/
2. Click "Get Started"
3. Sign up with email
4. Get API key from dashboard
5. **Rate Limit**: 500,000 messages/month

#### 4. **Alpha Vantage** (Last Resort)
1. Go to https://www.alphavantage.co/
2. Click "Get Your Free API Key Today"
3. Sign up with email
4. Get API key from dashboard
5. **Rate Limit**: 5 calls/minute

### Step 2: Configure Environment (1 minute)

Add all keys to your `web/.dev.vars` file:

```bash
# Existing
OPENAI_API_KEY=your_openai_key_here

# New data sources (add all for maximum reliability)
POLYGON_KEY=your_polygon_key_here
FINNHUB_KEY=your_finnhub_key_here
IEX_KEY=your_iex_key_here
ALPHA_VANTAGE_KEY=your_alphavantage_key_here
```

### Step 3: Test the System

```bash
# Test with multiple symbols
curl "http://localhost:8788/api/quote?symbols=AAPL,MSFT,NVDA,TSLA"
```

## 🔄 How the Fallback System Works

### Priority Order:
1. **Polygon.io** (5 calls/min) → Fastest, most reliable
2. **Finnhub** (60 calls/min) → Good backup
3. **IEX Cloud** (500K/month) → High volume
4. **Alpha Vantage** (5 calls/min) → Last resort
5. **Yahoo Finance** (unlimited) → Always available

### Example Fallback Flow:
```
User requests: AAPL, MSFT, NVDA
↓
1. Try Polygon.io → Rate limited (5/min hit)
2. Try Finnhub → Success! ✅
3. Return data from Finnhub
4. Show: "Data loaded from finnhub (fallback from polygon)"
```

## 📈 What You Get with All Free Tiers

### Combined Rate Limits:
- **Polygon**: 5 calls/min
- **Finnhub**: 60 calls/min  
- **IEX**: 500K calls/month
- **Alpha Vantage**: 5 calls/min
- **Yahoo**: Unlimited

**Total**: ~70 calls/min + 500K/month + unlimited fallback

### Features Available:
- ✅ **Real-time stock prices**
- ✅ **Technical analysis** (support/resistance, trends)
- ✅ **Entry/exit recommendations**
- ✅ **Stop loss levels**
- ✅ **Risk/reward ratios**
- ✅ **Confidence levels**
- ✅ **Automatic fallback** when rate limited
- ✅ **Source transparency** (shows which service provided data)

## 🎯 Recommended Setup Strategy

### For Personal Use:
1. **Start with IEX Cloud** (500K/month is generous)
2. **Add Finnhub** (60/min backup)
3. **Add Polygon.io** (fastest when available)
4. **Skip Alpha Vantage** (too limited)

### For Development/Testing:
1. **Get all 4 keys** (maximum reliability)
2. **Test fallback scenarios**
3. **Monitor rate limits**

## 🔧 Troubleshooting

### Common Issues:

#### "No API keys configured"
- Add at least one API key to `.dev.vars`
- Restart the development server

#### "Rate limit exceeded"
- This is normal! The system will automatically try the next source
- Check the status message to see which source was used

#### "No data found"
- Try different symbols (some may be delisted)
- Check if all API keys are valid
- Look at the error details in the response

### Testing Fallback:
```bash
# Make multiple rapid requests to trigger rate limits
for i in {1..10}; do
  curl "http://localhost:8788/api/quote?symbols=AAPL"
  sleep 1
done
```

## 📊 Expected Response Format

```json
{
  "quoteResponse": {
    "result": [
      {
        "symbol": "AAPL",
        "regularMarketPrice": 227.76,
        "regularMarketChange": 0.45,
        "regularMarketChangePercent": 0.2,
        "source": "finnhub",
        "technicalAnalysis": {
          "supportLevel": 216.37,
          "resistanceLevel": 239.15,
          "trend": "UP",
          "prediction": "BULLISH",
          "entryPrice": 223.20,
          "exitPrice": 245.98,
          "stopLoss": 209.54,
          "riskRewardRatio": 3.0,
          "confidence": "MEDIUM"
        }
      }
    ]
  },
  "status": {
    "totalSymbols": 1,
    "foundSymbols": 1,
    "attemptedSources": ["polygon", "finnhub"],
    "successfulSource": "finnhub",
    "fallbackUsed": true,
    "message": "Successfully fetched all data using finnhub (fallback from polygon)"
  }
}
```

## 🎉 Benefits of This Setup

1. **Zero Cost**: All free tiers
2. **Maximum Reliability**: 5 different data sources
3. **Automatic Fallback**: No manual intervention needed
4. **Transparency**: See exactly which source provided data
5. **Technical Analysis**: Professional-grade analysis included
6. **Rate Limit Protection**: Never hit limits with proper fallback

## 🚀 Next Steps

1. **Get all 4 API keys** (5 minutes)
2. **Add to `.dev.vars`** (1 minute)
3. **Test the system** (2 minutes)
4. **Enjoy reliable stock data!** 🎉

The system will automatically handle rate limits and provide the best available data from your configured sources.
