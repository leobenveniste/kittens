/**
 * Genera posiciones válidas de gatos en una grilla de NxN según las reglas:
 * - 1 gato por fila
 * - 1 gato por columna
 * - Sin gatos adyacentes (horizontal, vertical o diagonal)
 */
function generateValidCatPositions(N) {
  function solve(row, positions) {
    if (row === N) {
      return positions;
    }

    // Mezclar columnas aleatoriamente para variedad de puzzles
    const cols = Array.from({ length: N }, (_, i) => i);
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }

    for (let c of cols) {
      let valid = true;
      for (let r = 0; r < row; r++) {
        const prevC = positions[r];
        // Columna duplicada
        if (prevC === c) {
          valid = false;
          break;
        }
        // Adyacencia (distancia de chebyshev <= 1)
        if (Math.abs(row - r) <= 1 && Math.abs(c - prevC) <= 1) {
          valid = false;
          break;
        }
      }

      if (valid) {
        positions.push(c);
        const result = solve(row + 1, positions);
        if (result) return result;
        positions.pop();
      }
    }

    return null;
  }

  // Intentar resolver hasta 100 veces (con mezclas aleatorias)
  for (let t = 0; t < 100; t++) {
    const res = solve(0, []);
    if (res) {
      return res.map((c, r) => ({ r, c }));
    }
  }

  // Fallback para N=8 estándar
  return [
    { r: 0, c: 0 },
    { r: 1, c: 3 },
    { r: 2, c: 6 },
    { r: 3, c: 1 },
    { r: 4, c: 4 },
    { r: 5, c: 7 },
    { r: 6, c: 2 },
    { r: 7, c: 5 }
  ].slice(0, N);
}

/**
 * Genera N regiones conexas a partir de las celdas semilla (posiciones de gatos de la solución).
 * Algoritmo: Región growing balanceado con límite de tamaño para garantizar secciones de tamaño 3.
 */
function generateRegions(N, catPositions) {
  const grid = Array.from({ length: N }, () => Array(N).fill(-1));
  const regionCells = Array.from({ length: N }, () => []);

  // Inicializar semillas
  catPositions.forEach((pos, i) => {
    grid[pos.r][pos.c] = i;
    regionCells[i].push(pos);
  });

  // Determinar límites de tamaño para cada región según las nuevas condiciones:
  // - una sección de 2 casillas
  // - una sección de 3 casillas
  // - dos secciones de 4 casillas
  // - al menos una sección de 5 casillas (para N >= 6)
  const targetSizes = Array(N).fill(Infinity);
  const indices = Array.from({ length: N }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  targetSizes[indices[0]] = 2;
  targetSizes[indices[1]] = 3;
  targetSizes[indices[2]] = 4;
  targetSizes[indices[3]] = 4;
  if (N >= 6) {
    targetSizes[indices[4]] = 5;
  }

  let assignedCount = N;
  const totalCells = N * N;

  while (assignedCount < totalCells) {
    let progressInRound = false;

    // Barajar los índices de las regiones para crecimiento aleatorio ordenado
    const regionIndices = Array.from({ length: N }, (_, i) => i);
    for (let i = regionIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [regionIndices[i], regionIndices[j]] = [regionIndices[j], regionIndices[i]];
    }

    for (let i of regionIndices) {
      // Si la región ya alcanzó su tamaño objetivo (3 para las pequeñas), no crece
      if (regionCells[i].length >= targetSizes[i]) {
        continue;
      }

      const candidates = [];
      for (let cell of regionCells[i]) {
        const neighbors = [
          { r: cell.r - 1, c: cell.c },
          { r: cell.r + 1, c: cell.c },
          { r: cell.r, c: cell.c - 1 },
          { r: cell.r, c: cell.c + 1 }
        ];

        for (let n of neighbors) {
          if (n.r >= 0 && n.r < N && n.c >= 0 && n.c < N) {
            if (grid[n.r][n.c] === -1) {
              if (!candidates.some(c => c.r === n.r && c.c === n.c)) {
                candidates.push(n);
              }
            }
          }
        }
      }

      if (candidates.length > 0) {
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        grid[choice.r][choice.c] = i;
        regionCells[i].push(choice);
        assignedCount++;
        progressInRound = true;
      }
    }

    // Manejar celdas huérfanas en caso de bloqueos (conectar con cualquier vecino asignado)
    if (!progressInRound && assignedCount < totalCells) {
      let found = false;
      for (let r = 0; r < N && !found; r++) {
        for (let c = 0; c < N && !found; c++) {
          if (grid[r][c] === -1) {
            const neighbors = [
              { r: r - 1, c },
              { r: r + 1, c },
              { r: r, c: c - 1 },
              { r: r, c: c + 1 }
            ];
            const assignedNeighbors = [];
            for (let n of neighbors) {
              if (n.r >= 0 && n.r < N && n.c >= 0 && n.c < N && grid[n.r][n.c] !== -1) {
                assignedNeighbors.push(grid[n.r][n.c]);
              }
            }
            if (assignedNeighbors.length > 0) {
              // Intentar asignar preferentemente a regiones que no hayan alcanzado su target
              const validNeighbors = assignedNeighbors.filter(regId => regionCells[regId].length < targetSizes[regId]);
              const chosenNeighbors = validNeighbors.length > 0 ? validNeighbors : assignedNeighbors;
              
              const regId = chosenNeighbors[Math.floor(Math.random() * chosenNeighbors.length)];
              grid[r][c] = regId;
              regionCells[regId].push({ r, c });
              assignedCount++;
              found = true;
            }
          }
        }
      }
      if (!found) break;
    }
  }

  return grid;
}

// Lista de clases Tailwind CSS para fondos minimalistas más saturados (idénticos y vibrantes en ambos temas)
// Agregamos una propiedad de "family" para clasificar colores similares y evitar adyacencias difíciles de distinguir.
const PASTEL_COLORS = [
  { name: 'lavender', bg: 'bg-board-lavender', hover: 'hover:bg-board-lavender-hover', text: 'text-purple-800', active: 'bg-board-lavender-hover', family: 'purple' },
  { name: 'peach', bg: 'bg-board-peach', hover: 'hover:bg-board-peach-hover', text: 'text-amber-800', active: 'bg-board-peach-hover', family: 'orange' },
  { name: 'blue', bg: 'bg-board-blue', hover: 'hover:bg-board-blue-hover', text: 'text-blue-800', active: 'bg-board-blue-hover', family: 'blue' },
  { name: 'green', bg: 'bg-board-green', hover: 'hover:bg-board-green-hover', text: 'text-green-800', active: 'bg-board-green-hover', family: 'green' },
  { name: 'gray', bg: 'bg-board-gray', hover: 'hover:bg-board-gray-hover', text: 'text-neutral-800', active: 'bg-board-gray-hover', family: 'gray' },
  { name: 'coral', bg: 'bg-board-coral', hover: 'hover:bg-board-coral-hover', text: 'text-red-800', active: 'bg-board-coral-hover', family: 'red' },
  { name: 'yellow', bg: 'bg-board-yellow', hover: 'hover:bg-board-yellow-hover', text: 'text-lime-800', active: 'bg-board-yellow-hover', family: 'yellow' },
  { name: 'pink', bg: 'bg-board-pink', hover: 'hover:bg-board-pink-hover', text: 'text-fuchsia-800', active: 'bg-board-pink-hover', family: 'pink' },
  { name: 'taupe', bg: 'bg-board-taupe', hover: 'hover:bg-board-taupe-hover', text: 'text-stone-800', active: 'bg-board-taupe-hover', family: 'brown' },
  { name: 'mint', bg: 'bg-board-mint', hover: 'hover:bg-board-mint-hover', text: 'text-teal-800', active: 'bg-board-mint-hover', family: 'teal' }
];


/**
 * Asigna colores únicos a cada región de forma que regiones adyacentes nunca compartan la misma familia de color.
 * Utiliza backtracking para resolver el coloreado de grafos con restricción de familia.
 */
function assignRegionColors(N, regions, colors) {
  // 1. Detectar pares de regiones adyacentes (que comparten frontera)
  const adjacentPairs = new Set();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const currentReg = regions[r][c];
      const neighbors = [
        { r: r - 1, c },
        { r: r + 1, c },
        { r: r, c: c - 1 },
        { r: r, c: c + 1 }
      ];
      for (let n of neighbors) {
        if (n.r >= 0 && n.r < N && n.c >= 0 && n.c < N) {
          const neighborReg = regions[n.r][n.c];
          if (neighborReg !== currentReg) {
            const key = currentReg < neighborReg 
              ? `${currentReg}-${neighborReg}` 
              : `${neighborReg}-${currentReg}`;
            adjacentPairs.add(key);
          }
        }
      }
    }
  }

  // Crear la lista de adyacencias
  const adjList = Array.from({ length: N }, () => []);
  adjacentPairs.forEach(pair => {
    const [u, v] = pair.split('-').map(Number);
    adjList[u].push(v);
    adjList[v].push(u);
  });

  // 2. Colorear las regiones (cada una con un color de la paleta asignado de forma única)
  const regionColors = Array(N).fill(null);
  const usedColors = new Set();

  function solveColoring(regId) {
    if (regId === N) return true;

    // Mezclar los colores disponibles para máxima aleatoriedad
    const shuffledColors = [...colors];
    for (let i = shuffledColors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
    }

    for (let color of shuffledColors) {
      if (usedColors.has(color.name)) continue;

      // Verificar si algún vecino ya tiene un color de la misma familia
      let familyClash = false;
      for (let neighbor of adjList[regId]) {
        const neighborColor = regionColors[neighbor];
        if (neighborColor && neighborColor.family === color.family) {
          familyClash = true;
          break;
        }
      }

      if (!familyClash) {
        regionColors[regId] = color;
        usedColors.add(color.name);
        if (solveColoring(regId + 1)) return true;
        usedColors.delete(color.name);
        regionColors[regId] = null;
      }
    }

    return false;
  }

  // Intentar resolver con la restricción estricta de familia de color.
  if (solveColoring(0)) {
    return regionColors;
  }

  // Fallback simple: Si la restricción de familia es demasiado estricta para la densidad del grafo,
  // simplemente coloreamos evitando que dos vecinos tengan el mismo color exacto (sin restricción de familia).
  const regionColorsFallback = Array(N).fill(null);
  const usedColorsFallback = new Set();

  function solveColoringFallback(regId) {
    if (regId === N) return true;

    const shuffledColors = [...colors];
    for (let i = shuffledColors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
    }

    for (let color of shuffledColors) {
      if (usedColorsFallback.has(color.name)) continue;

      let nameClash = false;
      for (let neighbor of adjList[regId]) {
        const neighborColor = regionColorsFallback[neighbor];
        if (neighborColor && neighborColor.name === color.name) {
          nameClash = true;
          break;
        }
      }

      if (!nameClash) {
        regionColorsFallback[regId] = color;
        usedColorsFallback.add(color.name);
        if (solveColoringFallback(regId + 1)) return true;
        usedColorsFallback.delete(color.name);
        regionColorsFallback[regId] = null;
      }
    }

    return false;
  }

  solveColoringFallback(0);
  return regionColorsFallback;
}

/**
 * Cuenta cuántas soluciones válidas tiene el puzzle con las regiones generadas.
 * Retorna 2 inmediatamente si se detecta más de una solución para optimizar la velocidad.
 */
function countSolutions(N, regions) {
  let solutionsCount = 0;
  const colsOccupied = Array(N).fill(false);
  const regionsOccupied = Array(N).fill(false);
  const cats = Array(N).fill(-1);

  function solve(r) {
    if (r === N) {
      solutionsCount++;
      return;
    }

    for (let c = 0; c < N; c++) {
      if (colsOccupied[c]) continue;

      const regId = regions[r][c];
      if (regionsOccupied[regId]) continue;

      // Adyacencia diagonal/directa (solo con la fila anterior)
      if (r > 0 && Math.abs(cats[r - 1] - c) <= 1) continue;

      // Colocar temporalmente
      colsOccupied[c] = true;
      regionsOccupied[regId] = true;
      cats[r] = c;

      solve(r + 1);

      // Revertir
      cats[r] = -1;
      regionsOccupied[regId] = false;
      colsOccupied[c] = false;

      // Abortar si ya se encontró más de una solución
      if (solutionsCount > 1) return;
    }
  }

  solve(0);
  return solutionsCount;
}

export function generatePuzzle(N) {
  let solution, regions;
  let attempts = 0;

  // Verifica si se cumplen las condiciones de tamaño de las secciones
  const validateRegionsSizes = (regGrid) => {
    const counts = Array(N).fill(0);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        counts[regGrid[r][c]]++;
      }
    }

    const countOf2 = counts.filter(x => x === 2).length;
    const countOf3 = counts.filter(x => x === 3).length;
    const countOf4 = counts.filter(x => x === 4).length;
    const countOf5OrMore = counts.filter(x => x >= 5).length;
    const hasExactlyFive = counts.some(x => x === 5);

    if (N === 5) {
      return countOf2 === 1 && countOf3 === 1 && countOf4 === 2 && countOf5OrMore === 1;
    } else {
      return countOf2 === 1 && countOf3 === 1 && countOf4 === 2 && hasExactlyFive;
    }
  };

  do {
    solution = generateValidCatPositions(N);
    regions = generateRegions(N, solution);
    attempts++;
  } while (
    (!validateRegionsSizes(regions) || countSolutions(N, regions) !== 1) &&
    attempts < 4000
  );

  // Asignar colores inteligentes que evitan colisiones de familias de colores adyacentes
  const regionColors = assignRegionColors(N, regions, PASTEL_COLORS);

  return {
    gridSize: N,
    solution,
    regions,
    regionColors
  };
}
