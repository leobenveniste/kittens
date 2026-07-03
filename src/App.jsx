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
  const [showVictoryModal, setShowVictoryModal] = useState(true);
  const [suggestedDiscards, setSuggestedDiscards] = useState([]);

  // Inicializar el tema de color desde localStorage o el sistema
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kittens-theme') || 'light';
    }
    return 'light';
  });

  const timerRef = useRef(null);
  const gridRef = useRef(null);

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
    setShowVictoryModal(true);
    setSuggestedDiscards([]);
    
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

  // 5b. Referencias de callbacks para los listeners táctiles no pasivos
  const startDragRef = useRef(null);
  const continueDragRef = useRef(null);
  const gameStatusRef = useRef(null);

  useEffect(() => {
    startDragRef.current = startDrag;
    continueDragRef.current = continueDrag;
    gameStatusRef.current = gameStatus;
  });

  // Efecto para registrar listeners táctiles no pasivos y prevenir scroll/zoom en arrastres
  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    const onTouchStart = (e) => {
      if (gameStatusRef.current === 'won') return;
      lastTouchTime.current = Date.now();
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element) {
        const cellElement = element.closest('.game-cell');
        if (cellElement) {
          const r = parseInt(cellElement.getAttribute('data-row'), 10);
          const c = parseInt(cellElement.getAttribute('data-col'), 10);
          if (!isNaN(r) && !isNaN(c)) {
            e.preventDefault(); // Seguro de preventDefault aquí (no es pasivo)
            startDragRef.current(r, c, false);
          }
        }
      }
    };

    const onTouchMove = (e) => {
      if (!isDragging.current || gameStatusRef.current === 'won') return;
      e.preventDefault(); // Previene scroll mientras se arrastra
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
              continueDragRef.current(r, c);
            }
          }
        }
      }
    };

    gridElement.addEventListener('touchstart', onTouchStart, { passive: false });
    gridElement.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      gridElement.removeEventListener('touchstart', onTouchStart);
      gridElement.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

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
    setSuggestedDiscards([]);

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
    setSuggestedDiscards([]);

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
    setSuggestedDiscards([]);
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
    setSuggestedDiscards([]); // Limpiar sugerencias al seguir arrastrando
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

  // Deshacer (Undo)
  const handleUndo = () => {
    if (history.length === 0 || gameStatus === 'won') return;
    setSuggestedDiscards([]);
    playRemove();
    const prevBoard = history[history.length - 1];
    setBoard(prevBoard);
    setHistory(prev => prev.slice(0, -1));
  };

  // Dar una pista (Hint)
  const handleHint = () => {
    if (gameStatus === 'won') return;

    // Helper para obtener celdas candidatas viables (vacías y no bloqueadas)
    const getBoardCandidates = (currentBoard) => {
      const size = puzzle.gridSize;
      const candidates = [];
      
      const placedCats = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (currentBoard[r]?.[c] === 'cat') {
            placedCats.push({ r, c });
          }
        }
      }

      const isCellBlocked = (r, c) => {
        if (currentBoard[r]?.[c] !== 'empty') return true;
        return placedCats.some(cat => {
          const sameRow = cat.r === r;
          const sameCol = cat.c === c;
          const adjacent = Math.abs(cat.r - r) <= 1 && Math.abs(cat.c - c) <= 1;
          const sameRegion = regions[cat.r]?.[cat.c] === regions[r]?.[c];
          return sameRow || sameCol || adjacent || sameRegion;
        });
      };

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!isCellBlocked(r, c)) {
            candidates.push({ r, c });
          }
        }
      }
      return { candidates, placedCats };
    };

    // Deducción 1: Región cuya huella de candidatos se limita a una sola fila/columna
    const runDeduction1 = (currentBoard) => {
      const size = puzzle.gridSize;
      const { candidates, placedCats } = getBoardCandidates(currentBoard);
      const regionsWithCats = new Set(placedCats.map(cat => regions[cat.r][cat.c]));

      for (let regId = 0; regId < size; regId++) {
        if (regionsWithCats.has(regId)) continue;

        const regCandidates = candidates.filter(cell => regions[cell.r][cell.c] === regId);
        if (regCandidates.length === 0) continue;

        // Fila única
        const firstRow = regCandidates[0].r;
        const allInSameRow = regCandidates.every(cell => cell.r === firstRow);
        if (allInSameRow) {
          const rowDiscards = candidates.filter(cell => cell.r === firstRow && regions[cell.r][cell.c] !== regId);
          if (rowDiscards.length > 0) {
            return rowDiscards; // Retornar inmediatamente para dar solo una pista de esta fila
          }
        }

        // Columna única
        const firstCol = regCandidates[0].c;
        const allInSameCol = regCandidates.every(cell => cell.c === firstCol);
        if (allInSameCol) {
          const colDiscards = candidates.filter(cell => cell.c === firstCol && regions[cell.r][cell.c] !== regId);
          if (colDiscards.length > 0) {
            return colDiscards; // Retornar inmediatamente para dar solo una pista de esta columna
          }
        }
      }

      return [];
    };

    // Deducción 2: Si colocar un gato en la celda candidata impide colocar un gato en otra región
    const runDeduction2 = (currentBoard) => {
      const size = puzzle.gridSize;
      const { candidates, placedCats } = getBoardCandidates(currentBoard);
      const regionsWithCats = new Set(placedCats.map(cat => regions[cat.r][cat.c]));
      const activeRegions = [];
      for (let i = 0; i < size; i++) {
        if (!regionsWithCats.has(i)) activeRegions.push(i);
      }

      for (let testCell of candidates) {
        const testReg = regions[testCell.r][testCell.c];

        const remainingCandidatesAfterTest = candidates.filter(cell => {
          if (cell.r === testCell.r && cell.c === testCell.c) return false;
          if (cell.r === testCell.r) return false;
          if (cell.c === testCell.c) return false;
          if (Math.abs(cell.r - testCell.r) <= 1 && Math.abs(cell.c - testCell.c) <= 1) return false;
          if (regions[cell.r][cell.c] === testReg) return false;
          return true;
        });

        let causesDeadEnd = false;
        for (let regId of activeRegions) {
          if (regId === testReg) continue;
          const regCandsLeft = remainingCandidatesAfterTest.some(cell => regions[cell.r][cell.c] === regId);
          if (!regCandsLeft) {
            causesDeadEnd = true;
            break;
          }
        }

        if (causesDeadEnd) {
          return [testCell]; // Retornar inmediatamente la primera celda deducida para dar solo una pista
        }
      }

      return [];
    };

    // Fallback: Descartar celdas basadas en la solución real
    const runFallbackDeduction = (currentBoard) => {
      const size = puzzle.gridSize;
      const getNeighbors = (row, col) => {
        const neighbors = [];
        if (row > 0) neighbors.push({ r: row - 1, c: col });
        if (row < size - 1) neighbors.push({ r: row + 1, c: col });
        if (col > 0) neighbors.push({ r: row, c: col - 1 });
        if (col < size - 1) neighbors.push({ r: row, c: col + 1 });
        return neighbors;
      };

      const candidates = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const inSolution = solution.some(s => s.r === r && s.c === c);
          const isCurrentlyEmpty = currentBoard[r][c] === 'empty' && !isBlockedByCat(r, c);
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
        for (let sizeTest = 3; sizeTest >= 1; sizeTest--) {
          for (let start of candidates) {
            const group = [start];
            const queue = [...getNeighbors(start.r, start.c)];
            while (queue.length > 0 && group.length < sizeTest) {
              const next = queue.shift();
              const isCand = candidates.some(c => c.r === next.r && c.c === next.c);
              const inGroup = group.some(c => c.r === next.r && c.c === next.c);
              if (isCand && !inGroup) {
                group.push(next);
                queue.push(...getNeighbors(next.r, next.c));
              }
            }
            if (group.length === sizeTest) {
              cellsToDiscard = group;
              break;
            }
          }
          if (cellsToDiscard.length > 0) break;
        }
      }
      return cellsToDiscard;
    };

    // --- FLUJO DE RESOLUCIÓN DE PISTA ---

    // 1. Intentar Deducción 1
    let cellsToDiscard = runDeduction1(board);

    // 2. Si no hay, intentar Deducción 2
    if (cellsToDiscard.length === 0) {
      cellsToDiscard = runDeduction2(board);
    }

    // 3. Si todo lo lógico ya está descartado, hacer fallback a la solución del tablero
    if (cellsToDiscard.length === 0) {
      cellsToDiscard = runFallbackDeduction(board);
    }

    // Aplicar las sugerencias en el estado sin alterar el tablero
    if (cellsToDiscard.length > 0) {
      playClick();
      setHintsUsed(h => h + 1);
      setSuggestedDiscards(cellsToDiscard);
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
    setSuggestedDiscards([]);
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center md:justify-between gap-3 md:gap-4">
          
          {/* Logo en el centro en móvil, a la izquierda en escritorio */}
          <div className="flex items-center justify-center md:justify-start gap-4 w-full md:w-auto">
            <div className="p-3 md:p-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-2xl shadow-sm">
              <Cat className="w-10 h-10 md:w-12 md:h-12" />
            </div>
            <div className="flex flex-col text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-white leading-none">
                Kittens
              </h1>
              <span className="text-sm md:text-base text-neutral-400 dark:text-neutral-500 font-bold mt-1">
                Lógica Felina
              </span>
            </div>
          </div>

          {/* Ajustes: Selector de tamaño y botón Crear centrados abajo del logo en móvil */}
          <div className="flex items-center justify-center gap-3 w-full md:w-auto">
            
            {/* Selector de Tamaño */}
            <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5 bg-white dark:bg-neutral-900">
              <button 
                onClick={() => {
                  const newSize = Math.max(5, gridSize - 1);
                  setGridSize(newSize);
                  handleCreatePuzzle(newSize);
                }}
                disabled={gridSize <= 5}
                className="p-2.5 md:p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400 disabled:opacity-40 cursor-pointer transition"
                title="Reducir tamaño"
              >
                <Minus className="w-5 h-5 md:w-4.5 md:h-4.5" />
              </button>
              <span className="px-3 text-sm md:text-base font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">
                {gridSize}×{gridSize}
              </span>
              <button 
                onClick={() => {
                  const newSize = Math.min(10, gridSize + 1);
                  setGridSize(newSize);
                  handleCreatePuzzle(newSize);
                }}
                disabled={gridSize >= 10}
                className="p-2.5 md:p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400 disabled:opacity-40 cursor-pointer transition"
                title="Aumentar tamaño"
              >
                <Plus className="w-5 h-5 md:w-4.5 md:h-4.5" />
              </button>
            </div>
            
            {/* Botón Crear */}
            <button
              onClick={() => handleCreatePuzzle(gridSize)}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-bold text-xs md:text-sm px-4 py-3 md:px-3 md:py-2 rounded-lg border border-transparent transition active:scale-95 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
              <span>Crear</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center py-4 px-4 md:px-8 max-w-5xl mx-auto w-full overflow-hidden">
        <div className="flex flex-col items-center justify-center w-full">
          
          <div className="flex flex-col items-center justify-center max-w-[450px] w-full">
            
            {/* Estadísticas (Info) justo arriba de la grilla */}
            <div className="flex items-center justify-center gap-6 md:gap-8 text-base md:text-lg font-extrabold text-neutral-600 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20 border border-neutral-200/40 dark:border-neutral-800/30 px-7 py-3 md:py-2.5 rounded-full shadow-xs w-full mb-3.5 shrink-0">
              <span className="flex items-center gap-2 cursor-help" title="Tiempo transcurrido">
                ⏱️ <span className="tabular-nums font-black text-neutral-900 dark:text-white">{formatTime(time)}</span>
              </span>
              <span className="text-neutral-300 dark:text-neutral-800 font-light">|</span>
              <span className="flex items-center gap-2 cursor-help" title="Pistas utilizadas">
                💡 <span className="tabular-nums font-black text-neutral-900 dark:text-white">{hintsUsed}</span>
              </span>
              <span className="text-neutral-300 dark:text-neutral-800 font-light">|</span>
              <span className="flex items-center gap-2 cursor-help" title="Gatos colocados en el tablero">
                🐱 <span className="tabular-nums font-black text-neutral-900 dark:text-white">{cats.length} / {puzzle.gridSize}</span>
              </span>
            </div>

            {conflictingCats.size > 0 && gameStatus !== 'won' && (
              <div className="w-full mb-3.5 text-center text-base md:text-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 py-2.5 px-4.5 rounded-lg border border-red-100 dark:border-red-900/40 animate-pulse font-bold shrink-0">
                ⚠️ ¡Hay gatos en conflicto en la grilla!
              </div>
            )}

            {/* Grid */}
            <div 
              ref={gridRef}
              className="w-full max-w-[min(410px,84vw,44dvh)] aspect-square grid border-3 border-neutral-900 bg-white relative overflow-hidden shrink-0 touch-none"
              style={{ gridTemplateColumns: `repeat(${puzzle.gridSize}, minmax(0, 1fr))` }}
              onTouchEnd={endDrag}
            >
              {Array.from({ length: puzzle.gridSize }).map((_, r) =>
                Array.from({ length: puzzle.gridSize }).map((_, c) => {
                  const regionId = regions[r][c];
                  const colorConfig = regionColors[regionId];
                  const isCat = hasCat(r, c);
                  const isAutoX = hasAutoCross(r, c);
                  const isManualX = isManualCross(r, c);
                  const isSuggested = suggestedDiscards.some(cell => cell.r === r && cell.c === c);
                  
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

                  const cellStyle = {};
                  if (isSuggested) {
                    cellStyle.backgroundImage = 'repeating-linear-gradient(45deg, rgba(100, 100, 100, 0.35), rgba(100, 100, 100, 0.35) 2px, rgba(120, 120, 120, 0.15) 2px, rgba(120, 120, 120, 0.15) 8px)';
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      data-row={r}
                      data-col={c}
                      style={cellStyle}
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
                          transform transition-transform duration-200 scale-95 md:scale-100
                          ${isConflicting ? 'text-red-600 animate-bounce' : 'text-neutral-900'}
                          ${isHintAnim ? 'text-amber-600 scale-110' : ''}
                        `}>
                          <Cat className="w-7 h-7 md:w-9 md:h-9 fill-current" />
                        </div>
                      ) : (isAutoX || isManualX) ? (
                        <div className={`text-black/55 flex items-center justify-center ${isHintAnim ? 'animate-pulse scale-110 text-amber-600' : 'animate-[scaleIn_0.15s_ease-out]'}`}>
                          <X className="w-4.5 h-4.5 md:w-5 md:h-5 stroke-[3]" />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {/* Botones de Acción (Tools) abajo, centrados */}
            <div className="flex items-center justify-center gap-3.5 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800 px-7 py-3 rounded-full shadow-sm shrink-0 mt-4">
              <button
                onClick={handleUndo}
                disabled={history.length === 0 || gameStatus === 'won'}
                className="p-2.5 md:p-2 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Deshacer (Undo)"
              >
                <RotateCcw className="w-6 h-6 md:w-5 md:h-5" />
              </button>
              <button
                onClick={handleHint}
                disabled={gameStatus === 'won'}
                className="p-2.5 md:p-2 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Descartar 4 casilleros vacíos"
              >
                <Lightbulb className="w-6 h-6 md:w-5 md:h-5" />
              </button>
              <button
                onClick={handleSolve}
                disabled={gameStatus === 'won'}
                className="p-2.5 md:p-2 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Resolver automáticamente"
              >
                <Eye className="w-6 h-6 md:w-5 md:h-5" />
              </button>
              <button
                onClick={handleReset}
                className="p-2.5 md:p-2 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
                title="Reiniciar tablero"
              >
                <X className="w-6 h-6 md:w-5 md:h-5" />
              </button>
              <button
                onClick={() => setShowInstructions(true)}
                className="p-2.5 md:p-2 hover:bg-white dark:hover:bg-neutral-750 hover:border-neutral-200 dark:hover:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
                title="Cómo jugar"
              >
                <HelpCircle className="w-6 h-6 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>
           {/* Modal Victoria */}
        {gameStatus === 'won' && showVictoryModal && !solvedByComputer && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-45 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border-3 border-neutral-900 dark:border-neutral-800 p-6 md:p-8 max-w-md w-full text-center shadow-2xl animate-[scaleIn_0.3s_ease-out]">
              <div className="inline-flex items-center justify-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl text-amber-500 mb-4 border border-amber-100 dark:border-amber-900/40">
                <Trophy className="w-14 h-14 stroke-[1.5]" />
              </div>
              <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-white mb-2">
                ¡Excelente Trabajo!
              </h2>
              <p className="text-base text-neutral-500 dark:text-neutral-400 mb-6 font-medium">
                Has ubicado todos los gatitos correctamente sin ningún conflicto.
              </p>

              <div className="grid grid-cols-2 gap-3.5 bg-neutral-50 dark:bg-neutral-950 p-4.5 rounded-xl mb-6 border border-neutral-100 dark:border-amber-900/45 text-neutral-700 dark:text-neutral-300">
                <div className="flex flex-col">
                  <span className="text-xs md:text-sm text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Tiempo</span>
                  <span className="text-lg md:text-xl font-extrabold text-neutral-900 dark:text-white tabular-nums mt-0.5">{formatTime(time)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs md:text-sm text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Pistas</span>
                  <span className="text-lg md:text-xl font-extrabold text-neutral-900 dark:text-white tabular-nums mt-0.5">{hintsUsed}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => handleCreatePuzzle(gridSize)}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-bold py-3.5 md:py-4 rounded-xl border-2 border-neutral-900 dark:border-white transition active:scale-95 shadow-md flex items-center justify-center gap-2.5 cursor-pointer text-base md:text-lg"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Jugar de nuevo</span>
                </button>

                <button
                  onClick={() => setShowVictoryModal(false)}
                  className="w-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white font-bold py-3 md:py-3.5 rounded-xl border border-neutral-300/50 dark:border-neutral-600 transition active:scale-95 shadow-xs flex items-center justify-center gap-2 cursor-pointer text-sm md:text-base"
                >
                  <X className="w-5 h-5" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Instrucciones */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border-3 border-neutral-900 dark:border-neutral-800 p-6 md:p-8 max-w-md w-full text-left shadow-2xl animate-[scaleIn_0.2s_ease-out] relative">
              <button 
                onClick={() => setShowInstructions(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-500 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-700 pb-3.5 mb-4">
                <HelpCircle className="w-6 h-6 text-neutral-900 dark:text-neutral-100" />
                <h2 className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-white">¿Cómo Jugar?</h2>
              </div>

              <div className="space-y-4 text-sm md:text-base text-neutral-600 dark:text-neutral-300">
                <p className="font-medium">
                  El objetivo es ubicar exactamente <strong>un gato</strong> en cada fila, columna y sección de color.
                </p>
                <div className="border-l-4 border-neutral-900 dark:border-neutral-500 pl-3.5 py-1 space-y-2.5 text-xs md:text-sm">
                  <div className="flex items-start gap-1.5">
                    <span className="text-neutral-950 dark:text-neutral-100 font-extrabold">1.</span>
                    <p>Un solo gato por <strong>sección de color</strong>.</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-neutral-950 dark:text-neutral-100 font-extrabold">2.</span>
                    <p>Un solo gato por cada <strong>fila y columna</strong>.</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-neutral-950 dark:text-neutral-100 font-extrabold">3.</span>
                    <p>Los gatos <strong>no pueden tocarse</strong> entre sí (tampoco en diagonal).</p>
                  </div>
                </div>
                <div className="mt-4 pt-3.5 border-t border-neutral-200 dark:border-neutral-700 space-y-2.5 text-xs md:text-sm">
                  <p>
                    <strong className="text-neutral-900 dark:text-white">Clic izquierdo / Toque:</strong> rota entre Vacío ➔ Cruz ➔ Gato ➔ Vacío.
                  </p>
                  <p>
                    <strong className="text-neutral-900 dark:text-white">Clic derecho / Toque largo:</strong> coloca o quita una cruz manual.
                  </p>
                  <p className="bg-neutral-100 dark:bg-neutral-900/60 p-3 rounded-lg text-xs text-neutral-500 dark:text-neutral-400 italic leading-relaxed">
                    Tip: Al colocar un gato, se descartan automáticamente (cruces) su fila, columna, sección y alrededores, ayudando a resolver el puzzle por lógica.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="mt-6 w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-bold py-3 rounded-xl border border-transparent transition active:scale-95 cursor-pointer text-center text-sm md:text-base"
              >
                ¡Entendido!
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between text-neutral-400 dark:text-neutral-600 border-t border-neutral-50 dark:border-neutral-900 transition-colors duration-200 shrink-0">
        
        {/* Toggle de tema de color - abajo a la izquierda para móvil y escritorio */}
        <button
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          className="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 cursor-pointer transition active:scale-95 shrink-0"
          title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
        >
          {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6 text-amber-400" />}
        </button>

        {/* Dedicatoria "para Ce" más grande a la derecha */}
        <span className="text-lg md:text-xl font-extrabold tracking-wider italic text-neutral-550 dark:text-neutral-450 pr-1 select-none">
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
