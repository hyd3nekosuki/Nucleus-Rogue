
import React from 'react';

interface Props {
  level: number;
  onClick?: () => void;
}

const TrefoilIndicator: React.FC<Props> = ({ level, onClick }) => {
  if (level <= 0) return null;

  const color = "#facc15"; // Neon Yellow
  const glowClass = level >= 5 ? "drop-shadow-[0_0_10px_rgba(250,204,21,1)]" : "drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]";
  const isInteractive = level >= 5;

  /**
   * 扇形（ブレード）を描画するパスを生成
   * @param startAngle 開始角度（度）
   * @param endAngle 終了角度（度）
   * @param innerR 内半径
   * @param outerR 外半径
   */
  const describeArc = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
    const rad = (degree: number) => (degree - 90) * Math.PI / 180.0;
    const x1 = 50 + innerR * Math.cos(rad(startAngle));
    const y1 = 50 + innerR * Math.sin(rad(startAngle));
    const x2 = 50 + outerR * Math.cos(rad(startAngle));
    const y2 = 50 + outerR * Math.sin(rad(startAngle));
    const x3 = 50 + outerR * Math.cos(rad(endAngle));
    const y3 = 50 + outerR * Math.sin(rad(endAngle));
    const x4 = 50 + innerR * Math.cos(rad(endAngle));
    const y4 = 50 + innerR * Math.sin(rad(endAngle));

    return [
      "M", x1, y1,
      "L", x2, y2,
      "A", outerR, outerR, 0, 0, 1, x3, y3,
      "L", x4, y4,
      "A", innerR, innerR, 0, 0, 0, x1, y1,
      "Z"
    ].join(" ");
  };

  // 本物のトレフォイルに近い比率
  const innerR = 14; // 隙間の開始
  const outerR = 42; // ブレードの外端

  return (
    <div 
      className={`flex items-center justify-center transition-all duration-700 hover:scale-110 ${glowClass} ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`} 
      title={isInteractive ? `r-process Accretion Available (Level ${level}/5)` : `Nuclear Mastery: Level ${level}/5`}
      onClick={isInteractive ? onClick : undefined}
    >
      <svg width="32" height="32" viewBox="0 0 100 100" className="w-6 h-6 md:w-8 md:h-8 overflow-visible">
        {/* Level 5: Outer Ring (Warning Boundary) - Fixed without animation */}
        {level >= 5 && (
          <circle 
            cx="50" cy="50" r="47" 
            fill="none" 
            stroke={color} 
            strokeWidth="2" 
            strokeDasharray="4 2"
          />
        )}

        {/* Level 1: Center Core (The Atomic Nucleus) */}
        {level >= 1 && (
          <circle cx="50" cy="50" r="10" fill={color} />
        )}

        {/* Level 2: Top Blade (60 degrees wide) */}
        {level >= 2 && (
          <path 
            d={describeArc(330, 390, innerR, outerR)} 
            fill={color}
            className="transition-all duration-500"
          />
        )}

        {/* Level 3: Bottom Right Blade */}
        {level >= 3 && (
          <path 
            d={describeArc(90, 150, innerR, outerR)} 
            fill={color}
            className="transition-all duration-500"
          />
        )}

        {/* Level 4: Bottom Left Blade */}
        {level >= 4 && (
          <path 
            d={describeArc(210, 270, innerR, outerR)} 
            fill={color}
            className="transition-all duration-500"
          />
        )}
      </svg>
    </div>
  );
};

export default TrefoilIndicator;
