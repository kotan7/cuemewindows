import React, { useState, useEffect, useRef } from "react"
import { LogOut, Command } from "lucide-react"

interface SolutionCommandsProps {
  extraScreenshots: any[]
  onTooltipVisibilityChange?: (visible: boolean, height: number) => void
}

const SolutionCommands: React.FC<SolutionCommandsProps> = ({
  extraScreenshots,
  onTooltipVisibilityChange
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (onTooltipVisibilityChange) {
      let tooltipHeight = 0
      if (tooltipRef.current && isTooltipVisible) {
        tooltipHeight = tooltipRef.current.offsetHeight + 10 // Adjust if necessary
      }
      onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
    }
  }, [isTooltipVisible, onTooltipVisibilityChange])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  return (
    <div>
      <div className="pt-2 w-fit">
        <div className="text-xs text-white/90 liquid-glass-bar py-2 px-4 flex items-center justify-center gap-4">
          {/* Show/Hide */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[11px] leading-none">表示/非表示</span>
            <div className="flex gap-1">
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
                <Command className="w-3 h-3" />
              </button>
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70">
                B
              </button>
            </div>
          </div>

          {/* Screenshot */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[11px] leading-none truncate">
              {extraScreenshots.length === 0
                ? "コードのスクリーンショット"
                : "スクリーンショット"}
            </span>
            <div className="flex gap-1">
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
                <Command className="w-3 h-3" />
              </button>
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70">
                H
              </button>
            </div>
          </div>
          {extraScreenshots.length > 0 && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[11px] leading-none">デバッグ</span>
              <div className="flex gap-1">
                <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
                  <Command className="w-3 h-3" />
                </button>
                <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70">
                  ↵
                </button>
              </div>
            </div>
          )}

          {/* Start Over */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[11px] leading-none">最初からやり直す</span>
            <div className="flex gap-1">
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
                <Command className="w-3 h-3" />
              </button>
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70">
                R
              </button>
            </div>
          </div>

          {/* Question Mark with Tooltip */}
          <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Question mark circle */}
            <div className="w-6 h-6 rounded-full morphism-button flex items-center justify-center cursor-help z-10">
              <span className="text-xs text-white/70">?</span>
            </div>

            {/* Tooltip Content */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full right-0 mt-2 w-80"
                style={{ zIndex: 100 }}
              >
                <div className="p-3 text-xs morphism-dropdown text-white/90">
                  {/* Tooltip content */}
                  <div className="space-y-4">
                    <h3 className="font-medium whitespace-nowrap">
                      キーボードショートカット
                    </h3>
                    <div className="space-y-3">
                      {/* Toggle Command */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="whitespace-nowrap">
                            ウィンドウ切り替え
                          </span>
                          <div className="flex gap-1">
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                              <Command className="w-2 h-2" />
                            </span>
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              B
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 whitespace-nowrap truncate">
                          このウィンドウを表示または非表示にします。
                        </p>
                      </div>
                      {/* Screenshot Command */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="whitespace-nowrap">
                            スクリーンショットを撮る
                          </span>
                          <div className="flex gap-1">
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                              <Command className="w-2 h-2" />
                            </span>
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              H
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 whitespace-nowrap truncate">
                          質問や解決策の追加部分をキャプチャしてデバッグに役立てます。追加のスクリーンショットは5枚まで保存されます。
                        </p>
                      </div>
                      {/* Debug Command */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="whitespace-nowrap">デバッグ</span>
                          <div className="flex gap-1">
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                              <Command className="w-2 h-2" />
                            </span>
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              ↵
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 whitespace-nowrap truncate">
                          これまでのスクリーンショットと新しく追加したスクリーンショットに基づいて新しい解決策を生成します。
                        </p>
                      </div>
                      {/* Start Over Command */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="whitespace-nowrap">最初からやり直す</span>
                          <div className="flex gap-1">
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                              <Command className="w-2 h-2" />
                            </span>
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              R
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 whitespace-nowrap truncate">
                          新しい質問から新たに始めます。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sign Out Button */}
          <button
            className="text-white/70 hover:text-white/90 transition-colors hover:cursor-pointer"
            title="サインアウト"
            onClick={() => window.electronAPI.quitApp()}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SolutionCommands
