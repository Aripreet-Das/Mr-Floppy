import React, { useEffect, useState } from "react";

interface DotMatrixEqualizerProps {
  isStreaming?: boolean;
  progress?: number;
  heightLevels?: number[];
}

export const DotMatrixEqualizer: React.FC<DotMatrixEqualizerProps> = ({
  isStreaming = false,
  progress = 0,
}) => {
  const COLUMNS = 26;
  const ROWS = 9;

  // Default bell curve / waveform pattern inspired by the design
  const defaultProfile = [
    1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 8, 7, 7, 8, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1,
  ];

  const [columnHeights, setColumnHeights] = useState<number[]>(defaultProfile);

  useEffect(() => {
    if (!isStreaming) {
      setColumnHeights(defaultProfile);
      return;
    }

    // Dynamic wave animation when streaming data
    let step = 0;
    const interval = setInterval(() => {
      step += 0.25;
      setColumnHeights((prev) =>
        prev.map((_, i) => {
          const wave = Math.sin(step + i * 0.45) * 2.5;
          const noise = (Math.random() - 0.5) * 1.5;
          const base = defaultProfile[i] ?? 4;
          const val = Math.max(1, Math.min(ROWS, Math.round(base + wave + noise)));
          return val;
        })
      );
    }, 120);

    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div className="flex items-end gap-[3px] select-none py-1 px-1">
      {columnHeights.map((activeCount, colIdx) => {
        const isProgressColumn = colIdx / COLUMNS <= Math.max(0.05, progress);
        return (
          <div key={colIdx} className="flex flex-col-reverse gap-[3px]">
            {Array.from({ length: ROWS }).map((_, rowIdx) => {
              const isLit = rowIdx < activeCount;
              return (
                <div
                  key={rowIdx}
                  className="dot-matrix-dot"
                  style={{
                    backgroundColor: isLit
                      ? isStreaming
                        ? isProgressColumn
                          ? "#2dd4bf" // Active teal
                          : "#fbbf24" // Amber gold
                        : "#f59e0b" // Warm amber idle
                      : "rgba(255, 255, 255, 0.07)",
                    boxShadow: isLit
                      ? isStreaming && isProgressColumn
                        ? "0 0 6px rgba(45, 212, 191, 0.75)"
                        : "0 0 5px rgba(245, 158, 11, 0.65)"
                      : "none",
                    opacity: isLit ? 1 : 0.4,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
