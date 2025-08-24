export default function NewsLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-48 space-y-6">
      {/* Large news-themed loading animation */}
      <div className="relative">
        {/* Large newspaper icon with pulsing effect */}
        <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
          </svg>
        </div>
        
        {/* Large floating news dots */}
        <div className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full animate-bounce shadow-lg"></div>
        <div className="absolute -bottom-3 -left-3 w-5 h-5 bg-green-500 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.2s'}}></div>
        <div className="absolute top-1/2 -right-6 w-4 h-4 bg-yellow-500 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.4s'}}></div>
        <div className="absolute top-1/2 -left-6 w-4 h-4 bg-purple-500 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.6s'}}></div>
      </div>
      
      <div className="text-center">
        <div className="text-lg text-gray-300 mb-3 font-medium">Fetching latest US financial news...</div>
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
        </div>
        <div className="text-sm text-gray-500 mt-3">This may take a few moments...</div>
      </div>
    </div>
  )
}
