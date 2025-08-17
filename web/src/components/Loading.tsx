type LoadingProps = {
  lines?: number
}

export default function Loading({ lines = 3 }: LoadingProps) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-800" />
      ))}
    </div>
  )
}


