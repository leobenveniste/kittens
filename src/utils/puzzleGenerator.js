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

  // Determinar límites de tamaño para cada región.
  // Queremos que al menos 3 regiones tengan un tamaño máximo de 3 para cumplir el requerimiento del usuario.
  const targetSizes = Array(N).fill(Infinity);
  const smallRegionIndices = [];
  while (smallRegionIndices.length < 3) {
    const idx = Math.floor(Math.random() * N);
    if (!smallRegionIndices.includes(idx)) {
      smallRegionIndices.push(idx);
    }
  }
  smallRegionIndices.forEach(idx => {
    targetSizes[idx] = 3;
  });

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
const PASTEL_COLORS = [
  { name: 'rose', bg: 'bg-rose-200', hover: 'hover:bg-rose-300/50', text: 'text-rose-800', active: 'bg-rose-300' },
  { name: 'indigo', bg: 'bg-indigo-200', hover: 'hover:bg-indigo-300/50', text: 'text-indigo-800', active: 'bg-indigo-300' },
  { name: 'emerald', bg: 'bg-emerald-200', hover: 'hover:bg-emerald-300/50', text: 'text-emerald-800', active: 'bg-emerald-300' },
  { name: 'amber', bg: 'bg-amber-200', hover: 'hover:bg-amber-300/50', text: 'text-amber-800', active: 'bg-amber-300' },
  { name: 'cyan', bg: 'bg-cyan-200', hover: 'hover:bg-cyan-300/50', text: 'text-cyan-800', active: 'bg-cyan-300' },
  { name: 'purple', bg: 'bg-purple-200', hover: 'hover:bg-purple-300/50', text: 'text-purple-800', active: 'bg-purple-300' },
  { name: 'orange', bg: 'bg-orange-200', hover: 'hover:bg-orange-300/50', text: 'text-orange-800', active: 'bg-orange-300' },
  { name: 'lime', bg: 'bg-lime-200', hover: 'hover:bg-lime-300/50', text: 'text-lime-800', active: 'bg-lime-300' },
  { name: 'fuchsia', bg: 'bg-fuchsia-200', hover: 'hover:bg-fuchsia-300/50', text: 'text-fuchsia-800', active: 'bg-fuchsia-300' },
  { name: 'sky', bg: 'bg-sky-200', hover: 'hover:bg-sky-300/50', text: 'text-sky-800', active: 'bg-sky-300' }
];

export function generatePuzzle(N) {
  let solution, regions;
  let attempts = 0;

  // Verifica si al menos 3 regiones tienen exactamente 3 casilleros
  const hasThreeRegionsOfSize3 = (regGrid) => {
    const counts = Array(N).fill(0);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        counts[regGrid[r][c]]++;
      }
    }
    const countSize3 = counts.filter(count => count === 3).length;
    return countSize3 >= 3;
  };

  do {
    solution = generateValidCatPositions(N);
    regions = generateRegions(N, solution);
    attempts++;
  } while (!hasThreeRegionsOfSize3(regions) && attempts < 500);

  // Mezclar la paleta de colores para que las regiones tengan tonos variados e independientes
  const shuffledColors = [...PASTEL_COLORS];
  for (let i = shuffledColors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
  }

  // Mapear cada región de ID 0..N-1 a un color de la paleta
  const regionColors = Array.from({ length: N }, (_, i) => shuffledColors[i % shuffledColors.length]);

  return {
    gridSize: N,
    solution,
    regions,
    regionColors
  };
}
