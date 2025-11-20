import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// ==========================================
// MODULE 1: CONFIGURATIONS (配置层)
// ==========================================

/**
 * AssetConfig: 资源路径配置
 * 换皮说明：将 emoji 替换为图片路径，并在 CSS 中使用 background-image
 */
const AssetConfig = {
  // 主题配色
  Colors: {
    Primary: '#FFD700', // 金色
    Secondary: '#1a0b2e', // 深紫背景
    ReelBg: '#2d1b4e',
    Jackpot: {
      MINI: '#4CAF50',
      MINOR: '#2196F3',
      MAJOR: '#9C27B0',
      GRAND: '#F44336'
    }
  },
  // 符号定义 (Emoji作为占位符，实际项目可换成图片URL)
  Symbols: {
    0: { id: 0, type: 'low', view: '🔟' },
    1: { id: 1, type: 'low', view: '🇯' },
    2: { id: 2, type: 'low', view: '🇶' },
    3: { id: 3, type: 'low', view: '🇰' },
    4: { id: 4, type: 'low', view: '🇦' },
    5: { id: 5, type: 'mid', view: '🪲' }, // 圣甲虫
    6: { id: 6, type: 'mid', view: '🏺' }, // 陶罐
    7: { id: 7, type: 'high', view: '👁️' }, // 荷鲁斯之眼
    8: { id: 8, type: 'high', view: '🧟' }, // 木乃伊
    9: { id: 9, type: 'high', view: '🔺' }, // 金字塔
    100: { id: 100, type: 'wild', view: '🃏' }, // Wild
    101: { id: 101, type: 'bonus', view: '👑' }, // Jackpot Trigger
  },
  // 纵向附属转轴的奖项
  VerticalItems: ['x2', 'MINI', 'x3', 'MINOR', 'x5', 'MAJOR', 'x10', 'GRAND'],
};

/**
 * GameConfig: 核心数值配置
 */
const GameConfig = {
  Reel: {
    Cols: 5,
    Rows: 3,
    SymbolHeight: 80, // px
    SpinDuration: 2000, // ms
    ReelDelay: 200, // ms per reel
  },
  Jackpot: {
    StartValues: { MINI: 100, MINOR: 500, MAJOR: 2000, GRAND: 10000 },
  },
  // 预设牌路 (Scripted Results) - 广告核心
  // reels: 5列的最终停止符号ID [col1, col2, col3, col4, col5]
  ScriptedResults: [
    // 第1局：普通，小奖
    { 
      reels: [1, 2, 1, 2, 1], 
      winAmount: 50, 
      isJackpot: false,
      verticalTarget: 'x2'
    },
    // 第2局：大图标，差点中大奖 (Teaser)
    { 
      reels: [8, 8, 8, 8, 5], 
      winAmount: 200, 
      isJackpot: false,
      verticalTarget: 'x5'
    },
    // 第3局：必中 Jackpot -> EndCard
    { 
      reels: [101, 101, 101, 101, 101], 
      winAmount: 15000, 
      isJackpot: true, 
      verticalTarget: 'GRAND' 
    }
  ]
};

const UITextConfig = {
  Spin: "SPIN",
  Auto: "AUTO",
  Win: "WIN",
  Balance: "CREDITS",
  Download: "DOWNLOAD NOW"
};

// ==========================================
// MODULE 2: UTILS & AD SDK (工具层)
// ==========================================

const AdSDK = {
  onGameReady: () => {
    console.log("[AdSDK] Game Ready");
    // window.mraid?.ready();
  },
  onDownloadClick: () => {
    console.log("[AdSDK] Download Clicked");
    alert("Redirecting to Store...");
    // window.mraid?.open();
    // window.install?.();
  },
  showEndCard: () => {
    console.log("[AdSDK] Show End Card");
  }
};

// 随机生成一列符号用于滚动模糊效果
const getRandomStrip = (length: number) => {
  const keys = Object.keys(AssetConfig.Symbols).map(Number);
  return Array.from({ length }, () => keys[Math.floor(Math.random() * keys.length)]);
};

// ==========================================
// MODULE 3: COMPONENTS (视图层)
// ==========================================

// --- 3.1 单个符号 (Symbol) ---
const SymbolNode = ({ id }: { id: number }) => {
  const symbolData = AssetConfig.Symbols[id as keyof typeof AssetConfig.Symbols] || AssetConfig.Symbols[0];
  
  const style: React.CSSProperties = {
    width: '100%',
    height: `${GameConfig.Reel.SymbolHeight}px`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '50px',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  };

  return <div style={style}>{symbolData.view}</div>;
};

// --- 3.2 单个转轴 (Reel) ---
const Reel = ({ 
  index, 
  isSpinning, 
  targetSymbol, 
  onStop 
}: { 
  index: number; 
  isSpinning: boolean; 
  targetSymbol: number;
  onStop: () => void;
}) => {
  const [strip, setStrip] = useState<number[]>([0, 1, 2]); // 初始显示
  const [offsetY, setOffsetY] = useState(0);
  const [transition, setTransition] = useState('none');

  useEffect(() => {
    if (isSpinning) {
      // 1. 生成长条带 (Start + Randoms + Target + EndPadding)
      // 保证 Target 停在中间行 (Row 2)
      const randomPart = getRandomStrip(20 + index * 2); // 阶梯停顿
      // 目标结构： [Randoms..., TargetTop, TargetMiddle(Result), TargetBottom]
      const targetPart = [
        Math.floor(Math.random() * 9), 
        targetSymbol, 
        Math.floor(Math.random() * 9)
      ];
      
      const newStrip = [...strip, ...randomPart, ...targetPart];
      setStrip(newStrip);

      // 2. 开始转动动画
      // 稍作延迟，让 React 渲染完 newStrip
      setTimeout(() => {
        const totalHeight = newStrip.length * GameConfig.Reel.SymbolHeight;
        const viewHeight = GameConfig.Reel.Rows * GameConfig.Reel.SymbolHeight;
        // 最终停留在倒数第3个位置（让targetPart显示在可视区）
        const targetY = (newStrip.length - 3) * GameConfig.Reel.SymbolHeight;
        
        setTransition(`transform ${2 + index * 0.2}s cubic-bezier(0.4, 0.0, 0.2, 1)`); // 模拟重力加速
        setOffsetY(-targetY);
      }, 50);

    } else {
        // Reset logic if needed, or just keep position
    }
  }, [isSpinning, targetSymbol]);

  const handleTransitionEnd = () => {
    if (isSpinning) {
      // 动画结束，重置 Strip 保持视觉一致但移除多余节点 (Virtual List optimization concept)
      // 这里为了简单，不重置 DOM，只回调
      onStop();
    }
  };

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflow: 'hidden',
      backgroundColor: index % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
      position: 'relative',
      borderRight: '1px solid rgba(255,215,0,0.1)'
    }}>
      <div 
        style={{ 
          transform: `translateY(${offsetY}px)`,
          transition: transition,
          willChange: 'transform'
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {strip.map((sid, i) => (
          <SymbolNode key={i} id={sid} />
        ))}
      </div>
    </div>
  );
};

// --- 3.3 纵向附属转轴 (VerticalSlot) ---
const VerticalSlot = ({ isSpinning, targetItem }: { isSpinning: boolean, targetItem: string }) => {
  const [offsetY, setOffsetY] = useState(0);
  const [list, setList] = useState(AssetConfig.VerticalItems);
  
  useEffect(() => {
    if (isSpinning) {
      // 简单的循环滚动逻辑
      const loopCount = 3;
      const fullList = [];
      for(let i=0; i<loopCount; i++) fullList.push(...AssetConfig.VerticalItems);
      fullList.push(targetItem); // 确保停在目标
      // 再加几个垫底
      fullList.push(...AssetConfig.VerticalItems.slice(0, 2));

      setList(fullList);
      
      setTimeout(() => {
        const itemHeight = 50; // height of vertical item
        const targetIndex = fullList.length - 3; 
        setOffsetY(-(targetIndex * itemHeight));
      }, 10);
    }
  }, [isSpinning, targetItem]);

  return (
    <div style={{
      width: '80px',
      height: '240px', // Match main slot height
      marginLeft: '10px',
      border: '2px solid #FFD700',
      borderRadius: '10px',
      overflow: 'hidden',
      background: '#000',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, 
        background: 'linear-gradient(to bottom, black, transparent)', height: '50px'
      }}/>
      <div style={{
        transform: `translateY(${offsetY}px)`,
        transition: isSpinning ? 'transform 3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
      }}>
        {list.map((item, i) => (
          <div key={i} style={{
            height: '50px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#FFF',
            fontWeight: 'bold',
            fontSize: '14px',
            borderBottom: '1px solid #333'
          }}>
            {item}
          </div>
        ))}
      </div>
      {/* Indicator Line */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'red', zIndex: 20
      }}/>
    </div>
  );
};

// --- 3.4 顶部 Jackpot 显示 (GrandNode) ---
const GrandNode = ({ jackpots }: { jackpots: typeof GameConfig.Jackpot.StartValues }) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      padding: '10px', 
      background: 'rgba(0,0,0,0.5)',
      borderRadius: '8px',
      marginBottom: '10px'
    }}>
      {Object.entries(jackpots).map(([key, val]) => (
        <div key={key} style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 'bold', 
            color: AssetConfig.Colors.Jackpot[key as keyof typeof AssetConfig.Colors.Jackpot],
            marginBottom: '2px'
          }}>{key}</div>
          <div style={{ 
            fontSize: '12px', 
            color: '#FFF', 
            fontFamily: 'monospace' 
          }}>{Math.floor(val).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
};

// --- 3.5 底部 UI (DownUI) ---
const DownUI = ({ onSpin, canSpin, balance, win }: any) => {
  return (
    <div style={{ 
      marginTop: '20px', 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '10px' 
    }}>
      {/* Info Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFF', padding: '0 10px', fontSize: '14px' }}>
        <div style={{ background: '#333', padding: '5px 15px', borderRadius: '20px' }}>
          <span style={{color:'#aaa', fontSize:'10px'}}>{UITextConfig.Win}</span><br/>
          <span style={{color:'#4CAF50', fontWeight:'bold'}}>${win}</span>
        </div>
        <div style={{ background: '#333', padding: '5px 15px', borderRadius: '20px' }}>
          <span style={{color:'#aaa', fontSize:'10px'}}>{UITextConfig.Balance}</span><br/>
          <span>${balance}</span>
        </div>
      </div>

      {/* Spin Button */}
      <button 
        onClick={onSpin} 
        disabled={!canSpin}
        style={{
          background: canSpin ? 'linear-gradient(to bottom, #FFEB3B, #FF9800)' : '#555',
          border: 'none',
          borderRadius: '50px',
          padding: '15px',
          fontSize: '24px',
          fontWeight: '900',
          color: canSpin ? '#5d4037' : '#888',
          boxShadow: canSpin ? '0 4px 0 #E65100, 0 5px 10px rgba(0,0,0,0.5)' : 'none',
          transform: canSpin ? 'translateY(0)' : 'translateY(2px)',
          cursor: canSpin ? 'pointer' : 'default',
          transition: 'all 0.1s',
          margin: '0 20px'
        }}
      >
        {UITextConfig.Spin}
      </button>
    </div>
  );
};

// --- 3.6 结束卡 (EndCard) ---
const EndCard = ({ show, winAmount }: { show: boolean, winAmount: number }) => {
  if (!show) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.85)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      animation: 'fadeIn 0.5s'
    }}>
      <h1 style={{ 
        color: '#FFD700', 
        fontSize: '48px', 
        margin: '0 0 20px 0',
        textShadow: '0 0 20px #FF9800'
      }}>BIG WIN!</h1>
      <div style={{ fontSize: '32px', color: '#FFF', marginBottom: '40px' }}>
        ${winAmount.toLocaleString()}
      </div>
      <button 
        onClick={AdSDK.onDownloadClick}
        style={{
          background: '#4CAF50', color: 'white', border: 'none',
          padding: '15px 40px', fontSize: '20px', borderRadius: '30px',
          fontWeight: 'bold', boxShadow: '0 0 20px rgba(76,175,80, 0.6)',
          animation: 'pulse 1s infinite'
        }}
      >
        {UITextConfig.Download}
      </button>
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

// ==========================================
// MODULE 4: MAIN CONTROLLER (逻辑层)
// ==========================================

enum GameState { LOADING, IDLE, SPINNING, RESULT, ENDCARD }

export const App = () => {
  const [gameState, setGameState] = useState(GameState.LOADING);
  const [spinCount, setSpinCount] = useState(0);
  const [balance, setBalance] = useState(1000);
  const [lastWin, setLastWin] = useState(0);
  const [jackpots, setJackpots] = useState(GameConfig.Jackpot.StartValues);
  const [currentResult, setCurrentResult] = useState<typeof GameConfig.ScriptedResults[0] | null>(null);
  
  // 模拟初始化
  useEffect(() => {
    setTimeout(() => {
      setGameState(GameState.IDLE);
      AdSDK.onGameReady();
    }, 1000);

    // Jackpot Ticker
    const interval = setInterval(() => {
      setJackpots(prev => ({
        MINI: prev.MINI + 0.01,
        MINOR: prev.MINOR + 0.05,
        MAJOR: prev.MAJOR + 0.1,
        GRAND: prev.GRAND + 0.5
      }));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleSpin = () => {
    if (gameState !== GameState.IDLE) return;

    setBalance(b => b - 10); // Cost to spin
    setGameState(GameState.SPINNING);
    setLastWin(0);

    // 决定结果
    const nextSpinIndex = spinCount >= GameConfig.ScriptedResults.length 
      ? GameConfig.ScriptedResults.length - 1 
      : spinCount;
    
    const result = GameConfig.ScriptedResults[nextSpinIndex];
    setCurrentResult(result);
    setSpinCount(s => s + 1);

    // 模拟等待转轴停止
    // 注意：这里的时长应该略大于 Reel 组件内最大的动画时长
    setTimeout(() => {
      handleSpinComplete(result);
    }, 3000);
  };

  const handleSpinComplete = (result: typeof GameConfig.ScriptedResults[0]) => {
    setBalance(b => b + result.winAmount);
    setLastWin(result.winAmount);
    
    if (result.isJackpot) {
      setGameState(GameState.RESULT);
      setTimeout(() => {
         setGameState(GameState.ENDCARD);
         AdSDK.showEndCard?.();
      }, 2000);
    } else {
      setGameState(GameState.IDLE);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(AssetConfig.Colors.Secondary)}"/><path d="M0 0L50 50L100 0" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2"/></svg>')`,
      backgroundSize: 'cover',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden'
    }}>
      {/* Game Container (9:16 Aspect Ratio Keeper) */}
      <div style={{
        width: '100%',
        maxWidth: '450px', // Mobile max width
        height: '100%',
        maxHeight: '800px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        
        {/* Header / Jackpot */}
        <GrandNode jackpots={jackpots} />

        {/* Main Game Area */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          position: 'relative' 
        }}>
          
          {/* Horizontal Slots (5 Reels) */}
          <div style={{
            display: 'flex',
            flex: 1,
            height: `${GameConfig.Reel.Rows * GameConfig.Reel.SymbolHeight}px`,
            background: AssetConfig.Colors.ReelBg,
            border: '4px solid #D4AF37',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Reel 
                key={i} 
                index={i} 
                isSpinning={gameState === GameState.SPINNING}
                targetSymbol={currentResult ? currentResult.reels[i] : 0}
                onStop={() => {}} 
              />
            ))}
          </div>

          {/* Vertical Slot (Bonus) */}
          <VerticalSlot 
            isSpinning={gameState === GameState.SPINNING} 
            targetItem={currentResult ? currentResult.verticalTarget : 'x2'} 
          />

        </div>

        {/* UI Layer */}
        <DownUI 
          onSpin={handleSpin} 
          canSpin={gameState === GameState.IDLE} 
          balance={balance}
          win={lastWin}
        />

        {/* Overlays */}
        {gameState === GameState.LOADING && (
          <div style={{ position:'absolute', color: '#FFF' }}>LOADING ANCIENT TREASURES...</div>
        )}
        
        <EndCard show={gameState === GameState.ENDCARD} winAmount={lastWin} />
        
        {/* Coin Effect Container (Placeholder for particle system) */}
        {lastWin > 0 && (
           <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none'}}>
             {/* In a full implementation, render Coin particles here */}
           </div>
        )}

      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);