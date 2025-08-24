export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    // Try to fetch from real economic calendar APIs
    const currentDate = new Date()
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    
    const startDate = startOfWeek.toISOString().split('T')[0]
    const endDate = endOfWeek.toISOString().split('T')[0]
    
    // Try to fetch from Investing.com economic calendar
    try {
      const investingUrl = `https://www.investing.com/economic-calendar/Service/getCalendarFilteredData`
      const investingRes = await fetch(investingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: `dateFrom=${startDate}&dateTo=${endDate}&timeZone=8&timeFilter=timeRemain&currentTab=custom&submitFilters=1&limit_from=0`
      })
      
      if (investingRes.ok) {
        const data = await investingRes.json()
        if (data && data.data) {
          const events = data.data.map((item: any) => ({
            company: item.country || 'Economic Calendar',
            date: item.date,
            time: item.time,
            type: 'economic',
            description: item.event,
            impact: item.impact || 'Medium',
            currency: item.currency || 'USD'
          }))
          
          return new Response(JSON.stringify({ events }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
      }
    } catch (error) {
      console.error('Investing.com API failed:', error)
    }
    
    // Try to fetch from Yahoo Finance economic calendar
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/calendar?startDate=${startDate}&endDate=${endDate}&region=US&lang=en-US`
      const yahooRes = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      })
      
      if (yahooRes.ok) {
        const data = await yahooRes.json()
        if (data && data.economicEvents) {
          const events = data.economicEvents.map((item: any) => ({
            company: item.source || 'Economic Calendar',
            date: item.date,
            time: item.time,
            type: 'economic',
            description: item.event,
            impact: item.impact || 'Medium',
            currency: item.currency || 'USD'
          }))
          
          return new Response(JSON.stringify({ events }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
      }
    } catch (error) {
      console.error('Yahoo Finance economic calendar failed:', error)
    }
    
    // No real data available - return empty array
    return new Response(JSON.stringify({ events: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })

  } catch (error) {
    console.error('Economic events API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch economic events' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}
