export default function EventsLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-48 space-y-6">
      {/* Large calendar-themed loading animation */}
      <div className="relative">
        {/* Large calendar icon with pulsing effect */}
        <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
          </svg>
        </div>
        
        {/* Large floating event indicators */}
        <div className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full animate-ping shadow-lg"></div>
        <div className="absolute -bottom-3 -left-3 w-5 h-5 bg-green-500 rounded-full animate-ping shadow-lg" style={{animationDelay: '0.3s'}}></div>
        <div className="absolute top-1/2 -right-6 w-4 h-4 bg-blue-500 rounded-full animate-ping shadow-lg" style={{animationDelay: '0.6s'}}></div>
        <div className="absolute top-1/2 -left-6 w-4 h-4 bg-orange-500 rounded-full animate-ping shadow-lg" style={{animationDelay: '0.9s'}}></div>
      </div>
      
      <div className="text-center">
        <div className="text-lg text-gray-300 mb-3 font-medium">Loading market events...</div>
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
        </div>
        <div className="text-sm text-gray-500 mt-3">Gathering earnings, IPOs, and economic events...</div>
      </div>
    </div>
  )
}
