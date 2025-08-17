import { useState } from 'react'

type LogoProps = {
  className?: string
}

export default function Logo({ className }: LogoProps) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold ${className || ''}`}>
        MP
      </div>
    )
  }
  return (
    <img
      src="/marketpulse-logo.png"
      alt="MarketPulse"
      className={className}
      onError={() => setFailed(true)}
      loading="eager"
      decoding="sync"
    />
  )
}


