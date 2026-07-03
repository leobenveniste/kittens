import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Cat, 
  X, 
  RotateCcw, 
  HelpCircle, 
  Trophy, 
  Lightbulb, 
  Eye, 
  RefreshCw,
  Plus,
  Minus,
  Sun,
  Moon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generatePuzzle } from './utils/puzzleGenerator';
import { 
  playMeow, 
  playClick, 
  playRemove, 
  playWin, 
  playError 
} from './utils/audio';

function App() {
  // 1. Declaraciones de Estado y Refs (Hooks)
  const [gridSize, setGridSize] = useState(8);
  const [puzzle, setPuzzle] = useState(null);
  const [board, setBoard] = useState([]); // Matriz NxN con valores: 'empty' | 'cross' | 'cat'
  const [history, setHistory] = useState([]); // Historial de estados del tablero para deshacer
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing' | 'won'
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintAnimationCell, setHintAnimationCell] = useState(null); // Casillas resaltadas por pista reciente
  const [solvedByComputer, setSolvedByComputer] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Inicializar el tema de color desde localStorage o el sistema
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kittens-theme') || 'light';
    }
    return 'light';
  });

  const timerRef = useRef(null);

  // Referencias para el gesto de arrastre (drag)
  const isDragging = useRef(false);
  const dragTargetState = useRef(null);
  const lastTouchedCell = useRef(null);
  const lastTouchTime = useRef(0); // Evitar doble evento touch/mouse en móviles

  // 2. Efecto de Sincronización del Tema (Hook)
  useEffect(() => {
    localStorage.setItem('kittens-theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // 3. Callback de Creación del Puzzle (Hook)
  const handleCreatePuzzle = useCallback((size) => {
    const newPuzzle = generatePuzzle(size);
    setPuzzle(newPuzzle);
    setBoard(Array.from({ length: size }, () => Array(size).fill('empty')));
    setHistory([]);
    setMoves(0);
    setTime(0);
    setGameStatus('playing');
    setHintsUsed(0);
    setHintAnimationCell(null);
    setSolvedByComputer(false);
    
    // Iniciar temporizador
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  }, []);

  // 4. Efecto de Puzzle Inicial en Montaje (Hook)
  useEffect(() => {
    handleCreatePuzzle(gridSize);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 5. Efecto de Parar Temporizador al Ganar (Hook)
  useEffect(() => {
    if (gameStatus === 'won') {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [gameStatus]);

  // 6. Callback para obtener conflictos (Hook)
  const getConflicts = useCallback((currentCats, currentRegions) => {
    const conflicts = new Set();
    
    for (let i = 0; i < currentCats.length; i++) {
      const catA = currentCats[i];
      for (let j = i + 1; j < currentCats.length; j++) {
        const catB = currentCats[j];
        
        // Regla 1: No más de un gato por sección
        const sameRegion = currentRegions[catA.r]?.[catA.c] === currentRegions[catB.r]?.[catB.c];
        
        // Regla 2 y 3: No más de un gato por fila o columna
        const sameRow = catA.r === catB.r;
        const sameCol = catA.c === catB.c;
        
        // Regla 4: Los gatos no pueden estar uno al lado del otro (adyacentes)
        const adjacent = Math.abs(catA.r - catB.r) <= 1 && Math.abs(catA.c - catB.c) <= 1;
        
        if (sameRegion || sameRow || sameCol || adjacent) {
          conflicts.add(`${catA.r},${catA.c}`);
          conflicts.add(`${catB.r},${catB.c}`);
        }
      }
    }
    
    return conflicts;
  }, []);

  // 7. Efecto de verificación automática de victoria (Hook)
  useEffect(() => {
    if (gameStatus === 'won' || !puzzle || board.length !== gridSize) return;
    
    const currentCats = [];
    for (let r = 0; r < puzzle.gridSize; r++) {
      for (let c = 0; c < puzzle.gridSize; c++) {
        if (board[r]?.[c] === 'cat') {
          currentCats.push({ r, c });
        }
      }
    }

    if (currentCats.length === puzzle.gridSize) {
      const conflicts = getConflicts(currentCats, puzzle.regions);
      if (conflicts.size === 0) {
        setGameStatus('won');
        playWin();
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    }
  }, [board, puzzle, gameStatus, getConflicts, gridSize]);

  // 8. Click izquierdo en celda: rota entre vacio -> cruz -> gato -> vacio
  const handleCellClick = (r, c, isStart = false) => {
    if (gameStatus === 'won') return board[r][c];

    const currentState = board[r][c];
    let nextState = 'empty';

    if (currentState === 'empty') {
      nextState = 'cross';
      playClick();
    } else if (currentState === 'cross') {
      nextState = 'cat';
      playMeow();
    } else if (currentState === 'cat') {
      nextState = 'empty';
      playRemove();
    }

    if (isStart) {
      setHistory(prev => [...prev, board]);
    }

    setBoard(prev => prev.map((row, ri) => 
      row.map((val, ci) => (ri === r && ci === c) ? nextState : val)
    ));
    setMoves(m => m + 1);

    return nextState;
  };

  // 9. Click derecho para cruz manual rápida
  const handleCellRightClick = (r, c, isStart = false) => {
    if (gameStatus === 'won') return board[r][c];

    const currentState = board[r][c];
    let nextState = 'empty';

    if (currentState === 'empty') {
      nextState = 'cross';
      playClick();
    } else {
      nextState = 'empty';
      playRemove();
    }

    if (isStart) {
      setHistory(prev => [...prev, board]);
    }

    setBoard(prev => prev.map((row, ri) => 
      row.map((val, ci) => (ri === r && ci === c) ? nextState : val)
    ));
    setMoves(m => m + 1);

    return nextState;
  };

  // 10. Gestores del arrastre (drag)
  const startDrag = (r, c, isRightClick = false) => {
    if (gameStatus === 'won') return;
    isDragging.current = true;
    lastTouchedCell.current = { r, c };

    if (isRightClick) {
      const nextState = handleCellRightClick(r, c, true);
      dragTargetState.current = nextState;
    } else {
      const nextState = handleCellClick(r, c, true);
      dragTargetState.current = nextState;
    }
  };

  const continueDrag = (r, c) => {
    if (!isDragging.current || !dragTargetState.current || gameStatus === 'won') return;
    if (board[r][c] === dragTargetState.current) return; // Ya tiene el estado

    if (dragTargetState.current === 'cross') {
      playClick();
    } else if (dragTargetState.current === 'cat') {
      playMeow();
    } else {
      playRemove();
    }

    setBoard(prev => prev.map((row, ri) =>
      row.map((val, ci) => (ri === r && ci === c) ? dragTargetState.current : val)
    ));
    setMoves(m => m + 1);
  };

  const endDrag = () => {
    isDragging.current = false;
    dragTargetState.current = null;
    lastTouchedCell.current = null;
  };

  // 11. Listener global de mouseup para detener el arrastre fuera del tablero (Hook)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      endDrag();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // 12. Pantalla de carga inicial (CONDITIONAL RETURN)
  // Ocurre al final de la declaración de todos los hooks para cumplir con las Reglas de Hooks de React.
  if (!puzzle || board.length !== gridSize) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 transition-colors duration-200">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="p-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-2xl shadow-sm animate-bounce">
            <Cat className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Cargando Kittens...</h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Preparando gatitos y secciones...</p>
        </div>
      </div>
    );
  }

  // 13. Datos derivados seguros (el puzzle no es nulo aquí)
  const { regions, regionColors, solution } = puzzle;

  // Derivar las posiciones de los gatos actualmente en el tablero
  const cats = [];
  for (let r = 0; r < puzzle.gridSize; r++) {
    for (let c = 0; c < puzzle.gridSize; c++) {
      if (board[r]?.[c] === 'cat') {
        cats.push({ r, c });
      }
    }
  }

  // Verifica si una casilla (r, c) está bloqueada por cualquier gato del tablero
  const isBlockedByCat = (r, c) => {
    return cats.some(cat => {
      if (cat.r === r && cat.c === c) return false;
      const sameRow = cat.r === r;
      const sameCol = cat.c === c;
      const adjacent = Math.abs(cat.r - r) <= 1 && Math.abs(cat.c - c) <= 1;
      const sameRegion = regions[cat.r]?.[cat.c] === regions[r]?.[c];
      return sameRow || sameCol || adjacent || sameRegion;
    });
  };

  // Evaluar estado de celdas
  const hasCat = (r, c) => board[r]?.[c] === 'cat';
  const isManualCross = (r, c) => board[r]?.[c] === 'cross';
  
  // Una celda tiene cruz automática si no tiene gato y está bloqueada por algún gato
  const hasAutoCross = (r, c) => {
    if (hasCat(r, c)) return false;
    return isBlockedByCat(r, c);
  };

  // Gatos en conflicto
  const conflictingCats = getConflicts(cats, regions);

  // Manejar arrastre por toque en móviles (Touch events)
  const handleTouchStart = (e) => {
    if (gameStatus === 'won') return;
    lastTouchTime.current = Date.now(); // Registrar tiempo para bloquear mousedown emulado
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const cellElement = element.closest('.game-cell');
      if (cellElement) {
        const r = parseInt(cellElement.getAttribute('data-row'), 10);
        const c = parseInt(cellElement.getAttribute('data-col'), 10);
        if (!isNaN(r) && !isNaN(c)) {
          e.preventDefault(); // Evitar scroll
          startDrag(r, c, false);
        }
      }
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current || gameStatus === 'won') return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const cellElement = element.closest('.game-cell');
      if (cellElement) {
        const r = parseInt(cellElement.getAttribute('data-row'), 10);
        const c = parseInt(cellElement.getAttribute('data-col'), 10);
        if (!isNaN(r) && !isNaN(c)) {
          if (lastTouchedCell.current?.r !== r || lastTouchedCell.current?.c !== c) {
            lastTouchedCell.current = { r, c };
            continueDrag(r, c);
          }
        }
      }
    }
  };

  // Deshacer (Undo)
  const handleUndo = () => {
    if (history.length === 0 || gameStatus === 'won') return;
    playRemove();
    const prevBoard = history[history.length - 1];
    setBoard(prevBoard);
    setHistory(prev => prev.slice(0, -1));
    setMoves(m => m + 1);
  };

  // Dar una pista (Hint)
  const handleHint = () => {
    if (gameStatus === 'won') return;

    const getNeighbors = (row, col) => {
      const neighbors = [];
      if (row > 0) neighbors.push({ r: row - 1, c: col });
      if (row < puzzle.gridSize - 1) neighbors.push({ r: row + 1, c: col });
      if (col > 0) neighbors.push({ r: row, c: col - 1 });
      if (col < puzzle.gridSize - 1) neighbors.push({ r: row, c: col + 1 });
      return neighbors;
    };

    const candidates = [];
    for (let r = 0; r < puzzle.gridSize; r++) {
      for (let c = 0; c < puzzle.gridSize; c++) {
        const inSolution = solution.some(s => s.r === r && s.c === c);
        const isCurrentlyEmpty = board[r][c] === 'empty' && !isBlockedByCat(r, c);
        if (!inSolution && isCurrentlyEmpty) {
          candidates.push({ r, c });
        }
      }
    }

    let cellsToDiscard = [];

    for (let start of candidates) {
      const group = [start];
      const queue = [...getNeighbors(start.r, start.c)];
      
      while (queue.length > 0 && group.length < 4) {
        const next = queue.shift();
        const isCand = candidates.some(c => c.r === next.r && c.c === next.c);
        const inGroup = group.some(c => c.r === next.r && c.c === next.c);
        if (isCand && !inGroup) {
          group.push(next);
          queue.push(...getNeighbors(next.r, next.c));
        }
      }

      if (group.length === 4) {
        cellsToDiscard = group;
        break;
      }
    }

    if (cellsToDiscard.length === 0) {
      for (let size = 3; size >= 1; size--) {
        for (let start of candidates) {
          const group = [start];
          const queue = [...getNeighbors(start.r, start.c)];
          while (queue.length > 0 && group.length < size) {
            const next = queue.shift();
            const isCand = candidates.some(c => c.r === next.r && c.c === next.c);
            const inGroup = group.some(c => c.r === next.r && c.c === next.c);
            if (isCand && !inGroup) {
              group.push(next);
              queue.push(...getNeighbors(next.r, next.c));
            }
          }
          if (group.length === size) {
            cellsToDiscard = group;
            break;
          }
        }
        if (cellsToDiscard.length > 0) break;
      }
    }

    if (cellsToDiscard.length > 0) {
      playClick();
      setHistory(prev => [...prev, board]);
      setHintsUsed(h => h + 1);
      setMoves(m => m + 1);

      const nextBoard = board.map((row, ri) =>
        row.map((val, ci) => {
          const shouldDiscard = cellsToDiscard.some(cell => cell.r === ri && cell.c === ci);
          return shouldDiscard ? 'cross' : val;
        })
      );
      setBoard(nextBoard);
      setHintAnimationCell(cellsToDiscard);
      setTimeout(() => setHintAnimationCell(null), 1200);
    } else {
      playError();
    }
  };

  // Mostrar la solución de forma automática (Solve)
  const handleSolve = () => {
    if (gameStatus === 'won') return;
    playClick();
    setHistory(prev => [...prev, board]);
    
    const newBoard = Array.from({ length: puzzle.gridSize }, () => Array(puzzle.gridSize).fill('empty'));
    solution.forEach(sol => {
      newBoard[sol.r][sol.c] = 'cat';
    });
    
    setBoard(newBoard);
    setGameStatus('won');
    setSolvedByComputer(true);
  };

  // Reiniciar tablero actual
  const handleReset = () => {
    if (!board.some(row => row.some(cell => cell !== 'empty'))) return;
    playRemove();
    setHistory([]);
    setBoard(Array.from({ length: puzzle.gridSize }, () => Array(puzzle.gridSize).fill('empty')));
    setGameStatus('playing');
    setSolvedByComputer(false);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 select-none transition-colors duration-200 overflow-hidden">
      {/* Header */}
      <header className="w-full border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-30 transition-colors duration-200 shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-2.5 grid grid-cols-2 md:flex md:flex-row items-center justify-between gap-3 md:gap-4">
          
          <div className="flex items-center gap-3 col-span-1 order-1 flex-row">
            <div className="p-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-xl shadow-sm">
              <Cat className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white leading-none">
                Kittens
              </h1>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                Lógica Felina
              </span>
            </div>
          </div>

          {/* Estadísticas (Info) en el Centro */}
          <div className="col-span-2 order-3 md:order-2 flex items-center justify-center gap-5 md:gap-7 text-xs md:text-sm font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20 border border-neutral-200/40 dark:border-neutral-800/30 px-5 py-2 md:py-1.5 rounded-full shadow-xs w-full md:w-auto">
            <span className="flex items-center gap-1.5 cursor-help" title="Tiempo transcurrido">
              ⏱️ <span className="tabular-nums font-bold text-neutral-900 dark:text-white">{formatTime(time)}</span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-800 font-light">|</span>
            <span className="flex items-center gap-1.5 cursor-help" title="Movimientos realizados">
              🔄 <span className="tabular-nums font-bold text-neutral-900 dark:text-white">{moves}</span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-800 font-light">|</span>
            <span className="flex items-center gap-1.5 cursor-help" title="Gatos colocados en el tablero">
              🐱 <span className="tabular-nums font-bold text-neutral-900 dark:text-white">{cats.length} / {puzzle.gridSize}</span>
            </span>
          </div>

          {/* Ajustes a la derecha */}
          <div className="flex items-center gap-2 col-span-1 order-2 justify-end">
            <button
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              className="p-2 md:p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 cursor-pointer transition active:scale-95"
              title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
            >
              {theme === 'light' ? <Moon className="w-5.5 h-5.5 md:w-5 md:h-5" /> : <Sun className="w-5.5 h-5.5 md:w-5 md:h-5 text-amber-400" />}
            </button>

            <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5 bg-white dark:bg-neutral-900">
              <button 
                onClick={() => {
                  const newSize = Math.max(5, gridSize - 1);
                  setGridSize(newSize);
                  handleCreatePuzzle(newSize);
                }}
                disabled={gridSize <= 5}
                className="p-2 md:p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400 disabled:opacity-40 cursor-pointer"
                title="Reducir tamaño"
              >
                <Minus className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
              <span className="px-2 text-xs md:text-sm font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                {gridSize}×{gridSize}
              </span>
              <button 
                onClick={() => {
                  const newSize = Math.min(10, gridSize + 1);
                  setGridSize(newSize);
                  handleCreatePuzzle(newSize);
                }}
                disabled={gridSize >= 10}
                className="p-2 md:p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400 disabled:opacity-40 cursor-pointer"
                title="Aumentar tamaño"
              >
                <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
            </div>
            
            <button
              onClick={() => handleCreatePuzzle(gridSize)}
              className="flex items-center gap-1 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-medium text-xs px-3.5 py-2.5 md:px-2.5 md:py-1.5 rounded-lg border border-transparent transition active:scale-95 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Crear</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center py-4 px-4 md:px-8 max-w-5xl mx-auto w-full overflow-hidden">
        <div className="flex flex-col items-center justify-center w-full">
          
          <div className="flex flex-col items-center justify-center max-w-[450px] w-full">
            {conflictingCats.size > 0 && gameStatus !== 'won' && (
              <div className="w-full mb-3 text-center text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 py-1.5 px-3 rounded-lg border border-red-100 dark:border-red-900/40 animate-pulse font-medium shrink-0">
                ⚠️ ¡Hay gatos en conflicto en la grilla!
              </div>
            )}

            {/* Grid */}
            <div 
              className="w-full max-w-[min(410px,84vw,47dvh)] aspect-square grid border-3 border-neutral-900 bg-white relative overflow-hidden shrink-0 touch-none"
              style={{ gridTemplateColumns: `repeat(${puzzle.gridSize}, minmax(0, 1fr))` }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={endDrag}
            >
              {Array.from({ length: puzzle.gridSize }).map((_, r) =>
                Array.from({ length: puzzle.gridSize }).map((_, c) => {
                  const regionId = regions[r][c];
                  const colorConfig = regionColors[regionId];
                  const isCat = hasCat(r, c);
                  const isAutoX = hasAutoCross(r, c);
                  const isManualX = isManualCross(r, c);
                  
                  const borderTop = (r === 0 || regions[r - 1][c] !== regionId) ? 'border-t-3 border-t-neutral-900' : 'border-t border-t-black/15';
                  const borderLeft = (c === 0 || regions[r][c - 1] !== regionId) ? 'border-l-3 border-l-neutral-900' : 'border-l border-l-black/15';
                  const borderBottom = (r === puzzle.gridSize - 1) ? 'border-b-3 border-b-neutral-900' : '';
                  const borderRight = (c === puzzle.gridSize - 1) ? 'border-r-3 border-r-neutral-900' : '';

                  const isConflicting = conflictingCats.has(`${r},${c}`);
                  const isHintAnim = Array.isArray(hintAnimationCell)
                    ? hintAnimationCell.some(cell => cell.r === r && cell.c === c)
                    : hintAnimationCell?.r === r && hintAnimationCell?.c === c;

                  let bgClass = colorConfig.bg;
                  if (isConflicting) {
                    bgClass = 'bg-red-100';
                  } else if (isHintAnim) {
                    bgClass = 'bg-amber-100 animate-pulse';
                  } else {
                    bgClass = `${colorConfig.bg} ${colorConfig.hover}`;
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      data-row={r}
                      data-col={c}
                      onMouseDown={(e) => {
                        // Bloquear mousedown emulado en pantallas táctiles
                        if (Date.now() - lastTouchTime.current < 500) return;
                        if (e.button === 0) {
                          startDrag(r, c, false);
                        } else if (e.button === 2) {
                          startDrag(r, c, true);
                        }
                      }}
                      onMouseEnter={() => continueDrag(r, c)}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`
                        relative flex items-center justify-center aspect-square game-cell cursor-pointer select-none
                        ${borderTop} ${borderLeft} ${borderBottom} ${borderRight}
                        ${bgClass}
                      `}
                    >
                      {isCat ? (
                        <div className={`
                          transform transition-transform duration-200 scale-90 md:scale-100
                          ${isConflicting ? 'text-red-600 animate-bounce' : 'text-neutral-900'}
                          ${isHintAnim ? 'text-amber-600 scale-110' : ''}
                        `}>
                          <Cat className="w-6 h-6 md:w-8 md:h-8 fill-current" />
                        </div>
                      ) : isAutoX ? (
                        <div className="text-black/25 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 md:w-4 md:h-4 stroke-[2]" />
                        </div>
                      ) : isManualX ? (
                        <div className={`text-black/55 flex items-center justify-center ${isHintAnim ? 'animate-pulse scale-110 text-amber-600' : 'animate-[scaleIn_0.15s_ease-out]'}`}>
                          <X className="w-3.5 h-3.5 md:w-4 md:h-4 stroke-[3]" />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {/* Botones de Acción (Tools) abajo, centrados */}
            <div className="flex items-center justify-center gap-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800 px-6 py-2.5 rounded-full shadow-sm shrink-0 mt-4">
              <button
                onClick={handleUndo}
                disabled={history.length === 0 || gameStatus === 'won'}
                className="p-2 md:p-1.5 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Deshacer (Undo)"
              >
                <RotateCcw className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={handleHint}
                disabled={gameStatus === 'won'}
                className="p-2 md:p-1.5 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Descartar 4 casilleros vacíos"
              >
                <Lightbulb className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={handleSolve}
                disabled={gameStatus === 'won'}
                className="p-2 md:p-1.5 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Resolver automáticamente"
              >
                <Eye className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 md:p-1.5 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
                title="Reiniciar tablero"
              >
                <X className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={() => setShowInstructions(true)}
                className="p-2 md:p-1.5 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
                title="Cómo jugar"
              >
                <HelpCircle className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Victoria */}
        {gameStatus === 'won' && !solvedByComputer && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-45 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border-3 border-neutral-900 dark:border-neutral-800 p-6 md:p-8 max-w-sm w-full text-center shadow-2xl animate-[scaleIn_0.3s_ease-out]">
              <div className="inline-flex items-center justify-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl text-amber-500 mb-4 border border-amber-100 dark:border-amber-900/40">
                <Trophy className="w-12 h-12 stroke-[1.5]" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                ¡Excelente Trabajo!
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                Has ubicado todos los gatitos correctamente sin ningún conflicto.
              </p>

              <div className="grid grid-cols-3 gap-3 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl mb-6 border border-neutral-100 dark:border-amber-900/45 text-neutral-700 dark:text-neutral-300">
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wider">Tiempo</span>
                  <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{formatTime(time)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wider">Movimientos</span>
                  <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{moves}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wider">Pistas</span>
                  <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{hintsUsed}</span>
                </div>
              </div>

              <button
                onClick={() => handleCreatePuzzle(gridSize)}
                className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-semibold py-3 rounded-xl border-2 border-neutral-900 dark:border-white transition active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Jugar de nuevo</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Instrucciones */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border-3 border-neutral-900 dark:border-neutral-800 p-6 md:p-8 max-w-sm w-full text-left shadow-2xl animate-[scaleIn_0.2s_ease-out] relative">
              <button 
                onClick={() => setShowInstructions(false)}
                className="absolute top-4 right-4 p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-700 pb-3 mb-4">
                <HelpCircle className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">¿Cómo Jugar?</h2>
              </div>

              <div className="space-y-3.5 text-xs md:text-sm text-neutral-600 dark:text-neutral-300">
                <p>
                  El objetivo es ubicar exactamente <strong>un gato</strong> en cada fila, columna y sección de color.
                </p>
                <div className="border-l-4 border-neutral-900 dark:border-neutral-500 pl-3 py-1 space-y-2 text-xs">
                  <div className="flex items-start gap-1.5">
                    <span className="text-neutral-950 dark:text-neutral-100 font-bold">1.</span>
                    <p>Un solo gato por <strong>sección de color</strong>.</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-neutral-950 dark:text-neutral-100 font-bold">2.</span>
                    <p>Un solo gato por cada <strong>fila y columna</strong>.</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-neutral-950 dark:text-neutral-100 font-bold">3.</span>
                    <p>Los gatos <strong>no pueden tocarse</strong> entre sí (tampoco en diagonal).</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-2 text-xs">
                  <p>
                    <strong className="text-neutral-900 dark:text-white">Clic izquierdo:</strong> rota entre Vacío ➔ Cruz ➔ Gato ➔ Vacío.
                  </p>
                  <p>
                    <strong className="text-neutral-900 dark:text-white">Clic derecho:</strong> coloca o quita una cruz manual.
                  </p>
                  <p className="bg-neutral-100 dark:bg-neutral-900/60 p-2.5 rounded-lg text-[10px] md:text-xs text-neutral-500 dark:text-neutral-400 italic">
                    Tip: Al colocar un gato, se descartan automáticamente (cruces) su fila, columna, sección y alrededores, ayudando a resolver el puzzle por lógica.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="mt-6 w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-semibold py-2.5 rounded-xl border border-transparent transition active:scale-95 cursor-pointer text-center text-xs"
              >
                ¡Entendido!
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between text-neutral-400 dark:text-neutral-600 border-t border-neutral-50 dark:border-neutral-900 transition-colors duration-200 shrink-0">
        <span className="text-xs">
          Kittens Puzzle &copy; 2026
        </span>
        <span className="text-sm font-normal text-neutral-500 dark:text-neutral-500 italic pr-2">
          para Ce
        </span>
      </footer>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: scale(1) rotate(0deg); }
          20%, 60% { transform: scale(1.15) rotate(-8deg); }
          40%, 80% { transform: scale(1.15) rotate(8deg); }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default App;
