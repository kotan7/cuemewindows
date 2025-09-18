import React, { useState, useEffect } from 'react'
import { ModeOption } from '../../types/modes'

interface ModeSelectProps {
  currentMode: string
  onModeChange: (modeKey: string) => void
  className?: string
}

export const ModeSelect: React.FC<ModeSelectProps> = ({
  currentMode,
  onModeChange,
  className = ''
}) => {
  const [availableModes, setAvailableModes] = useState<ModeOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadAvailableModes()
  }, [])

  const loadAvailableModes = async () => {
    try {
      setIsLoading(true)
      const modes = await window.electronAPI.invoke('get-available-modes')
      setAvailableModes(modes)
    } catch (error) {
      console.error('Failed to load available modes:', error)
      // フォールバック: デフォルトモードのみ表示
      setAvailableModes([
        {
          key: 'interview',
          displayName: '面接モード（候補者）',
          description: '積極的、短め、ですます調'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleModeSelect = (modeKey: string) => {
    onModeChange(modeKey)
    setIsOpen(false)
  }

  const currentModeData = availableModes.find(mode => mode.key === currentMode)

  if (isLoading) {
    return (
      <div className={className}>
        <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
          モード読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Current Mode Display / Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">
              {currentModeData?.displayName || currentMode}
            </div>
            <div className="text-xs text-gray-500">
              {currentModeData?.description || ''}
            </div>
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            {availableModes.map((mode) => (
              <button
                key={mode.key}
                onClick={() => handleModeSelect(mode.key)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors ${
                  mode.key === currentMode ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <div className="font-medium">{mode.displayName}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {mode.description}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Quick Mode Toggle Component (for compact spaces)
export const ModeToggle: React.FC<{
  currentMode: string
  onModeChange: (modeKey: string) => void
  compactModes?: string[] // 表示するモードを限定
  className?: string
}> = ({ currentMode, onModeChange, compactModes, className = '' }) => {
  const [availableModes, setAvailableModes] = useState<ModeOption[]>([])

  useEffect(() => {
    loadAvailableModes()
  }, [])

  const loadAvailableModes = async () => {
    try {
      const modes = await window.electronAPI.invoke('get-available-modes')
      let filteredModes = modes
      
      if (compactModes && compactModes.length > 0) {
        filteredModes = modes.filter((mode: ModeOption) => 
          compactModes.includes(mode.key)
        )
      }
      
      setAvailableModes(filteredModes)
    } catch (error) {
      console.error('Failed to load available modes:', error)
    }
  }

  const getModeIcon = (modeKey: string) => {
    const icons: Record<string, string> = {
      interview: '🎯',
      meeting: '📝',
      sales: '💼',
      debate: '⚖️',
      class: '📚',
      telesales: '📞',
      support: '🛠️'
    }
    return icons[modeKey] || '💬'
  }

  const getModeColor = (modeKey: string) => {
    const colors: Record<string, string> = {
      interview: 'bg-blue-100 text-blue-800 border-blue-200',
      meeting: 'bg-green-100 text-green-800 border-green-200',
      sales: 'bg-purple-100 text-purple-800 border-purple-200',
      debate: 'bg-red-100 text-red-800 border-red-200',
      class: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      telesales: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      support: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[modeKey] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {availableModes.map((mode) => (
        <button
          key={mode.key}
          onClick={() => onModeChange(mode.key)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${
            mode.key === currentMode
              ? getModeColor(mode.key)
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
          title={mode.description}
        >
          <span className="mr-1">{getModeIcon(mode.key)}</span>
          {mode.displayName.replace('モード', '').replace('（候補者）', '').replace('（提案）', '').replace('（高応答）', '')}
        </button>
      ))}
    </div>
  )
}