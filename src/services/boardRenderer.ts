/**
 * Board Renderer Service
 * Renders Sudoku boards with hints to PNG images using @napi-rs/canvas
 */

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import type {
  SolverHintStep,
  SolverHintArea,
  SolverLink,
  SolverCellGroup,
  SolverColor,
} from '@sudobility/sudojo_types';

// =============================================================================
// Color Palettes
// =============================================================================

interface ColorPalette {
  background: string;
  backgroundSecondary: string;
  label: string;
  labelSecondary: string;
  gridLine: string;
  gridLineBold: string;
  // Hint colors
  selected: string; // Purple - selection/highlighting
  success: string; // Blue - correct values
  warning: string; // Orange - caution
  warningSecondary: string; // Yellow - mild warning
  error: string; // Red - errors/eliminations
}

const LIGHT_PALETTE: ColorPalette = {
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  label: '#000000',
  labelSecondary: '#3C3C43',
  gridLine: '#8E8E93',
  gridLineBold: '#000000',
  selected: '#AF52DE',
  success: '#007AFF',
  warning: '#FF9500',
  warningSecondary: '#FFCC00',
  error: '#FF3B30',
};

const DARK_PALETTE: ColorPalette = {
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  label: '#FFFFFF',
  labelSecondary: '#EBEBF5',
  gridLine: '#8E8E93',
  gridLineBold: '#FFFFFF',
  selected: '#BF5AF2',
  success: '#0A84FF',
  warning: '#FF9F0A',
  warningSecondary: '#FFD60A',
  error: '#FF453A',
};

// =============================================================================
// Hint Color Mapping
// =============================================================================

function getHintColor(color: SolverColor, palette: ColorPalette): string {
  switch (color) {
    case 'blue':
      return palette.selected;
    case 'green':
      return palette.success;
    case 'yellow':
      return palette.warningSecondary;
    case 'orange':
      return palette.warning;
    case 'red':
      return palette.error;
    case 'gray':
      return palette.labelSecondary;
    case 'white':
      return palette.background;
    case 'black':
      return palette.label;
    default:
      return palette.selected;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function rowOf(index: number): number {
  return Math.floor(index / 9);
}

function columnOf(index: number): number {
  return index % 9;
}

function blockOf(index: number): number {
  const row = rowOf(index);
  const col = columnOf(index);
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

function cellIndex(row: number, col: number): number {
  return row * 9 + col;
}

/**
 * Parse an 81-character puzzle string into cell values
 * @param puzzle - 81-char string where '0' or '.' = empty
 * @returns Array of 81 values (0 = empty, 1-9 = digit)
 */
function parsePuzzle(puzzle: string): number[] {
  const cells: number[] = [];
  for (let i = 0; i < 81; i++) {
    const char = puzzle[i] || '0';
    const value = char === '.' ? 0 : parseInt(char, 10);
    cells.push(isNaN(value) ? 0 : value);
  }
  return cells;
}

/**
 * Parse a comma-separated digit string into array
 */
function parseDigitString(str: string): number[] {
  if (!str || str === '') return [];
  return str
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= 9);
}

/**
 * Add alpha to hex color
 */
function withAlpha(hex: string, alpha: number): string {
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  const baseColor = hex.length === 9 ? hex.slice(0, 7) : hex;
  return `${baseColor}${alphaHex}`;
}

// =============================================================================
// Internal Cell State
// =============================================================================

interface CellHintState {
  row: number;
  col: number;
  color: SolverColor;
  fill: boolean;
  selectDigit?: number;
  unselectDigit?: number;
  highlightDigits: number[];
  addDigits: number[];
  removeDigits: number[];
}

// =============================================================================
// Board Renderer
// =============================================================================

export interface RenderOptions {
  /** Canvas size in pixels (square) */
  size?: number;
  /** Use dark mode colors */
  darkMode?: boolean;
  /** Hint step to visualize */
  hintStep?: SolverHintStep;
  /** Selected cell index (0-80) */
  selectedIndex?: number;
}

export interface RenderResult {
  /** PNG image buffer */
  buffer: Buffer;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
}

export class BoardRenderer {
  private size: number;

  constructor(size: number = 450) {
    this.size = size;
  }

  /**
   * Render a Sudoku board to PNG
   * @param original - Original puzzle string (81 chars)
   * @param user - User input string (81 chars, '0' = no input)
   * @param options - Render options
   */
  render(original: string, user: string, options: RenderOptions = {}): RenderResult {
    const size = options.size || this.size;
    const cellSize = size / 9;
    const boxSize = size / 3;
    const palette = options.darkMode ? DARK_PALETTE : LIGHT_PALETTE;

    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const givenCells = parsePuzzle(original);
    const userCells = parsePuzzle(user);

    // Build hint cell map
    const hintCells = this.buildHintCellMap(options.hintStep);

    // 1. Clear background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, size, size);

    // 2. Draw cell backgrounds
    this.drawCellBackgrounds(ctx, cellSize, palette, hintCells, options.selectedIndex);

    // 3. Draw cell contents (digits)
    this.drawCellContents(ctx, cellSize, palette, givenCells, userCells, hintCells);

    // 4. Draw grid lines
    this.drawGridLines(ctx, size, cellSize, boxSize, palette);

    // 5. Draw hint groups if present
    if (options.hintStep?.groups) {
      this.drawHintGroups(ctx, cellSize, palette, options.hintStep.groups);
    }

    // 6. Draw hint links if present
    if (options.hintStep?.links) {
      this.drawHintLinks(ctx, cellSize, palette, options.hintStep.links, givenCells, userCells);
    }

    return {
      buffer: canvas.toBuffer('image/png'),
      width: size,
      height: size,
    };
  }

  /**
   * Build a map of hint cells from hint step
   */
  private buildHintCellMap(hintStep?: SolverHintStep): Map<number, CellHintState> {
    const map = new Map<number, CellHintState>();

    if (!hintStep) return map;

    // Add area highlights (expand to all cells in row/col/block)
    if (hintStep.areas) {
      for (const area of hintStep.areas) {
        const indices = this.getAreaIndices(area.type, area.index);
        for (const idx of indices) {
          if (!map.has(idx)) {
            map.set(idx, {
              row: rowOf(idx),
              col: columnOf(idx),
              color: area.color,
              fill: true,
              highlightDigits: [],
              addDigits: [],
              removeDigits: [],
            });
          }
        }
      }
    }

    // Add individual cell highlights (override areas)
    if (hintStep.cells) {
      for (const cell of hintStep.cells) {
        const idx = cellIndex(cell.row, cell.column);
        const state: CellHintState = {
          row: cell.row,
          col: cell.column,
          color: cell.color,
          fill: cell.fill,
          highlightDigits: [],
          addDigits: [],
          removeDigits: [],
        };

        // Parse actions
        if (cell.actions) {
          if (cell.actions.select) {
            state.selectDigit = parseInt(cell.actions.select, 10);
          }
          if (cell.actions.unselect) {
            state.unselectDigit = parseInt(cell.actions.unselect, 10);
          }
          state.highlightDigits = parseDigitString(cell.actions.highlight);
          state.addDigits = parseDigitString(cell.actions.add);
          state.removeDigits = parseDigitString(cell.actions.remove);
        }

        map.set(idx, state);
      }
    }

    return map;
  }

  /**
   * Get all cell indices for an area (row/col/block)
   */
  private getAreaIndices(type: SolverHintArea['type'], index: number): number[] {
    const indices: number[] = [];

    if (type === 'row') {
      for (let c = 0; c < 9; c++) {
        indices.push(index * 9 + c);
      }
    } else if (type === 'column') {
      for (let r = 0; r < 9; r++) {
        indices.push(r * 9 + index);
      }
    } else if (type === 'block') {
      const blockRow = Math.floor(index / 3) * 3;
      const blockCol = (index % 3) * 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          indices.push((blockRow + r) * 9 + (blockCol + c));
        }
      }
    }

    return indices;
  }

  /**
   * Draw cell backgrounds with checkerboard and hint highlights
   */
  private drawCellBackgrounds(
    ctx: SKRSContext2D,
    cellSize: number,
    palette: ColorPalette,
    hintCells: Map<number, CellHintState>,
    selectedIndex?: number
  ): void {
    for (let i = 0; i < 81; i++) {
      const row = rowOf(i);
      const col = columnOf(i);
      const block = blockOf(i);
      const x = col * cellSize;
      const y = row * cellSize;

      // Default: checkerboard based on block
      let bgColor = block % 2 === 0 ? palette.backgroundSecondary : palette.background;

      // Selection highlight (row/col/block of selected cell)
      if (selectedIndex !== undefined) {
        const selRow = rowOf(selectedIndex);
        const selCol = columnOf(selectedIndex);
        const selBlock = blockOf(selectedIndex);

        if (row === selRow || col === selCol || block === selBlock) {
          bgColor = withAlpha(palette.selected, 0.15);
        }
      }

      // Hint cell background
      const hintCell = hintCells.get(i);
      if (hintCell?.fill) {
        bgColor = withAlpha(getHintColor(hintCell.color, palette), 0.3);
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Hint cell border (non-fill mode)
      if (hintCell && !hintCell.fill) {
        ctx.strokeStyle = getHintColor(hintCell.color, palette);
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
      }

      // Selected cell border
      if (i === selectedIndex) {
        ctx.strokeStyle = palette.selected;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
      }
    }
  }

  /**
   * Draw cell contents (digits and pencilmarks)
   */
  private drawCellContents(
    ctx: SKRSContext2D,
    cellSize: number,
    palette: ColorPalette,
    givenCells: number[],
    userCells: number[],
    hintCells: Map<number, CellHintState>
  ): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 81; i++) {
      const row = rowOf(i);
      const col = columnOf(i);
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;

      const given = givenCells[i];
      const user = userCells[i];
      const hintCell = hintCells.get(i);

      // Check for hint action (select/unselect)
      if (hintCell?.selectDigit) {
        // Show digit being placed (success color)
        ctx.font = `bold ${cellSize * 0.6}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = palette.success;
        ctx.fillText(String(hintCell.selectDigit), x, y);
        continue;
      }
      if (hintCell?.unselectDigit) {
        // Show digit being removed (error color)
        ctx.font = `bold ${cellSize * 0.6}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = palette.error;
        ctx.fillText(String(hintCell.unselectDigit), x, y);
        continue;
      }

      // Given digit
      if (given && given !== 0) {
        ctx.font = `bold ${cellSize * 0.6}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = palette.label;
        ctx.fillText(String(given), x, y);
        continue;
      }

      // User input
      if (user && user !== 0) {
        ctx.font = `${cellSize * 0.6}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = palette.success;
        ctx.fillText(String(user), x, y);
        continue;
      }

      // Pencilmarks from hint actions
      if (hintCell) {
        const pencilmarks = this.collectPencilmarks(hintCell);
        if (pencilmarks.length > 0) {
          this.drawPencilmarks(ctx, col * cellSize, row * cellSize, cellSize, palette, pencilmarks);
        }
      }
    }
  }

  /**
   * Collect pencilmarks from hint cell state
   */
  private collectPencilmarks(hintCell: CellHintState): { digit: number; color: string }[] {
    const marks: { digit: number; color: string }[] = [];

    for (const digit of hintCell.highlightDigits) {
      marks.push({ digit, color: 'highlight' });
    }
    for (const digit of hintCell.addDigits) {
      marks.push({ digit, color: 'add' });
    }
    for (const digit of hintCell.removeDigits) {
      marks.push({ digit, color: 'remove' });
    }

    return marks;
  }

  /**
   * Draw pencilmarks in a cell
   */
  private drawPencilmarks(
    ctx: SKRSContext2D,
    cellX: number,
    cellY: number,
    cellSize: number,
    palette: ColorPalette,
    pencilmarks: { digit: number; color: string }[]
  ): void {
    ctx.font = `${cellSize * 0.25}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const pm of pencilmarks) {
      // Position in 3x3 grid within cell
      const markRow = Math.floor((pm.digit - 1) / 3);
      const markCol = (pm.digit - 1) % 3;
      const markX = cellX + (markCol + 0.5) * (cellSize / 3);
      const markY = cellY + (markRow + 0.5) * (cellSize / 3);

      // Color based on action type
      switch (pm.color) {
        case 'highlight':
          ctx.fillStyle = palette.selected;
          break;
        case 'add':
          ctx.fillStyle = palette.success;
          break;
        case 'remove':
          ctx.fillStyle = palette.error;
          break;
        default:
          ctx.fillStyle = palette.labelSecondary;
      }

      ctx.fillText(String(pm.digit), markX, markY);
    }
  }

  /**
   * Draw grid lines (thin for cells, thick for boxes)
   */
  private drawGridLines(
    ctx: SKRSContext2D,
    size: number,
    cellSize: number,
    boxSize: number,
    palette: ColorPalette
  ): void {
    // Thin lines (cell borders)
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;

    for (let i = 1; i < 9; i++) {
      if (i % 3 !== 0) {
        // Vertical
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, size);
        ctx.stroke();

        // Horizontal
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(size, i * cellSize);
        ctx.stroke();
      }
    }

    // Thick lines (box borders)
    ctx.strokeStyle = palette.gridLineBold;
    ctx.lineWidth = 2;

    for (let i = 0; i <= 3; i++) {
      const pos = i * boxSize;

      // Vertical
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
  }

  /**
   * Draw hint groups (for pattern visualization like ALS)
   */
  private drawHintGroups(
    ctx: SKRSContext2D,
    cellSize: number,
    palette: ColorPalette,
    groups: SolverCellGroup[]
  ): void {
    for (const group of groups) {
      const color = getHintColor(group.color, palette);

      // Convert [row, col] pairs to indices
      const cellIndices = group.cells.map(([row, col]) => cellIndex(row ?? 0, col ?? 0));

      // Semi-transparent fill
      ctx.fillStyle = withAlpha(color, 0.2);
      for (const idx of cellIndices) {
        const row = rowOf(idx);
        const col = columnOf(idx);
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }

      // Border outline (only outer edges)
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      this.drawGroupOutline(ctx, cellIndices, cellSize);

      // Label if present
      if (group.name && cellIndices.length > 0) {
        const firstCell = cellIndices[0]!;
        const row = rowOf(firstCell);
        const col = columnOf(firstCell);
        this.drawGroupLabel(
          ctx,
          col * cellSize,
          row * cellSize,
          group.name,
          color,
          palette.background
        );
      }
    }
  }

  /**
   * Draw outline around a group of cells
   */
  private drawGroupOutline(ctx: SKRSContext2D, cells: number[], cellSize: number): void {
    const cellSet = new Set(cells);

    for (const idx of cells) {
      const row = rowOf(idx);
      const col = columnOf(idx);
      const x = col * cellSize;
      const y = row * cellSize;

      // Top edge
      if (row === 0 || !cellSet.has((row - 1) * 9 + col)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellSize, y);
        ctx.stroke();
      }

      // Bottom edge
      if (row === 8 || !cellSet.has((row + 1) * 9 + col)) {
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }

      // Left edge
      if (col === 0 || !cellSet.has(row * 9 + (col - 1))) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cellSize);
        ctx.stroke();
      }

      // Right edge
      if (col === 8 || !cellSet.has(row * 9 + (col + 1))) {
        ctx.beginPath();
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw group label
   */
  private drawGroupLabel(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    name: string,
    color: string,
    bgColor: string
  ): void {
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    const metrics = ctx.measureText(name);
    const padding = 4;
    const width = metrics.width + padding * 2;
    const height = 16;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + padding, y + height / 2);
  }

  /**
   * Draw hint links (for chain visualization)
   */
  private drawHintLinks(
    ctx: SKRSContext2D,
    cellSize: number,
    palette: ColorPalette,
    links: SolverLink[],
    givenCells: number[],
    userCells: number[]
  ): void {
    ctx.strokeStyle = palette.selected;
    ctx.lineWidth = 2;

    for (const link of links) {
      const fromIdx = cellIndex(link.fromRow, link.fromCol);
      const toIdx = cellIndex(link.toRow, link.toCol);

      // Calculate positions (center for main digits, pencilmark position otherwise)
      const fromHasDigit = (givenCells[fromIdx] || 0) !== 0 || (userCells[fromIdx] || 0) !== 0;
      const toHasDigit = (givenCells[toIdx] || 0) !== 0 || (userCells[toIdx] || 0) !== 0;

      let startX: number, startY: number, endX: number, endY: number;

      if (fromHasDigit) {
        startX = link.fromCol * cellSize + cellSize / 2;
        startY = link.fromRow * cellSize + cellSize / 2;
      } else {
        const pmRow = Math.floor((link.digit - 1) / 3);
        const pmCol = (link.digit - 1) % 3;
        startX = link.fromCol * cellSize + (pmCol + 0.5) * (cellSize / 3);
        startY = link.fromRow * cellSize + (pmRow + 0.5) * (cellSize / 3);
      }

      if (toHasDigit) {
        endX = link.toCol * cellSize + cellSize / 2;
        endY = link.toRow * cellSize + cellSize / 2;
      } else {
        const pmRow = Math.floor((link.digit - 1) / 3);
        const pmCol = (link.digit - 1) % 3;
        endX = link.toCol * cellSize + (pmCol + 0.5) * (cellSize / 3);
        endY = link.toRow * cellSize + (pmRow + 0.5) * (cellSize / 3);
      }

      // Draw line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);

      if (link.type === 'weak') {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/**
 * Create a board renderer instance
 */
export function createBoardRenderer(size: number = 450): BoardRenderer {
  return new BoardRenderer(size);
}
