export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 blur-sm opacity-80 animate-ping" />
        <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-500 animate-spin" style={{ animationDuration: '1.6s' }} />
        <div className="absolute inset-2 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 animate-[spin_2.2s_linear_infinite_reverse]" />
        <div className="absolute inset-4 w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shadow-inner">
          <div className="w-2 h-2 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  )
}


