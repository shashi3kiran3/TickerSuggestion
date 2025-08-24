export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')
  
  // Get current week dates
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6) // End of week (Saturday)
  
  const startDate = startOfWeek.toISOString().split('T')[0]
  const endDate = endOfWeek.toISOString().split('T')[0]

  try {
    // Try Yahoo Finance earnings calendar for current week
    const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/calendar?startDate=${startDate}&endDate=${endDate}&region=US&lang=en-US`
    const yahooRes = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    })

    if (yahooRes.ok) {
      const yahooData = await yahooRes.json()
      const earnings = yahooData?.earnings?.earnings || []
      
      if (earnings.length > 0) {
        return new Response(JSON.stringify({ earnings }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
    }

    // No fallback data - return empty array if Yahoo API fails
    return new Response(JSON.stringify({ earnings: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })

  } catch (error) {
    console.error('Earnings API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch earnings data' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}
