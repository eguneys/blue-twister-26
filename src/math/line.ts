import type { Vec2 } from "./vec2";

type Point = Vec2

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const line = (x1: number, y1: number, x2: number, y2: number): Line => ({ x1, y1, x2, y2 })

/**
 * Split a line segment into N equal parts
 * @param line The line to split
 * @param segments Number of segments to create (default: 8)
 * @returns Array of points along the line including start and end points
 */
function splitLineIntoSegments(
  line: Line, 
  segments: number = 8
): Point[] {
  const { x1, y1, x2, y2 } = line;
  const points: Point[] = [];
  
  // Add the starting point
  points.push({ x: x1, y: y1 });
  
  // Calculate intermediate points
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    points.push({ x, y });
  }
  
  // Add the ending point
  points.push({ x: x2, y: y2 });
  
  return points;
}

/**
 * Get the 8 line segments from the split points
 * @param line The line to split
 * @returns Array of 8 line segments
 */
export function getLineSegments(line: Line, nb: number = 8): Line[] {
  const points = splitLineIntoSegments(line, nb);
  const segments: Line[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y
    });
  }
  
  return segments;
}



/**
 * Shorten a line by absolute length from both ends
 * @param line The line to shorten
 * @param amount Length to remove from each end
 * @returns Shortened line
 */
export function shortenLineByLengthBothEnds(
  line: Line,
  amount: number
): Line {
  const { x1, y1, x2, y2 } = line;
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  
  /*
  if (amount * 2 >= length) {
    throw new Error('Amount too large, would eliminate the line');
  }
    */
  
  const t = amount / length;
  
  const newX1 = x1 + (x2 - x1) * t;
  const newY1 = y1 + (y2 - y1) * t;
  
  const newX2 = x2 - (x2 - x1) * t;
  const newY2 = y2 - (y2 - y1) * t;
  
  return {
    x1: newX1,
    y1: newY1,
    x2: newX2,
    y2: newY2
  };
}



/**
 * Advance the entire line forward (move line along its direction)
 * @param line The line to advance
 * @param distance Distance to advance
 * @returns Line moved forward along its direction
 */
export function advanceEntireLineForward(
  line: Line,
  distance: number
): Line {
  const { x1, y1, x2, y2 } = line;
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  
  if (length === 0) {
    // For zero-length line, move in positive x direction
    return {
      x1: x1 + distance,
      y1,
      x2: x2 + distance,
      y2
    };
  }
  
  const dirX = (x2 - x1) / length;
  const dirY = (y2 - y1) / length;
  
  return {
    x1: x1 + dirX * distance,
    y1: y1 + dirY * distance,
    x2: x2 + dirX * distance,
    y2: y2 + dirY * distance
  };
}

/**
 * More optimized version using while loop with pattern calculations
 */
export function createDashedLineOptimized(
  line: Line,
  dashLength: number,
  gapLength: number,
  offset: number = 0
): Line[] {
  const { x1, y1, x2, y2 } = line;
  const dashes: Line[] = [];
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  const totalLength = Math.sqrt(dx * dx + dy * dy);
  
  if (totalLength === 0) return [];
  
  const dirX = dx / totalLength;
  const dirY = dy / totalLength;
  
  const patternLength = dashLength + gapLength;
  
  if (patternLength <= 0) {
    return [{ x1, y1, x2, y2 }];
  }
  
  // Calculate where to start
  // Adjust offset to be within one pattern length (for efficiency)
  const normalizedOffset = offset % patternLength;
  const patternStart = -normalizedOffset;
  
  // Find the first pattern index that could intersect the line
  let currentPos = patternStart;
  
  while (currentPos < totalLength) {
    // Check if we're in a dash segment
    const dashSegmentStart = currentPos;
    const dashSegmentEnd = currentPos + dashLength;
    
    // Calculate intersection with line bounds
    const visibleStart = Math.max(dashSegmentStart, 0);
    const visibleEnd = Math.min(dashSegmentEnd, totalLength);
    
    // If we have a visible dash segment
    if (visibleEnd > visibleStart) {
      dashes.push({
        x1: x1 + dirX * visibleStart,
        y1: y1 + dirY * visibleStart,
        x2: x1 + dirX * visibleEnd,
        y2: y1 + dirY * visibleEnd
      });
    }
    
    // Move to next pattern
    currentPos += patternLength;
  }
  
  return dashes;
}