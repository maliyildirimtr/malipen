import { describe, it, expect } from 'vitest';
import { distance, distToSegment, isPointInPolygon, hitTestShape } from '../src/utils/geometry';
import { Stroke } from '../src/components/DrawingCanvas';

describe('Geometry Hit Testing', () => {
  it('calculates distance correctly', () => {
    expect(distance({x: 0, y: 0}, {x: 3, y: 4})).toBe(5);
  });

  it('calculates distance to segment correctly', () => {
    const p1 = {x: 0, y: 0};
    const p2 = {x: 10, y: 0};
    expect(distToSegment({x: 5, y: 5}, p1, p2)).toBe(5);
    expect(distToSegment({x: -5, y: 0}, p1, p2)).toBe(5);
    expect(distToSegment({x: 15, y: 0}, p1, p2)).toBe(5);
  });

  it('calculates point in polygon correctly', () => {
    const poly = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}, {x: 0, y: 10}];
    expect(isPointInPolygon({x: 5, y: 5}, poly)).toBe(true);
    expect(isPointInPolygon({x: 15, y: 5}, poly)).toBe(false);
  });

  it('hit tests a filled rectangle correctly', () => {
    const rect: Stroke = {
      id: '1', type: 'rectangle', width: 2, color: '#000', isFilled: true,
      points: [{x: 10, y: 10}, {x: 20, y: 20}]
    };
    expect(hitTestShape(15, 15, rect)).toBe(true); // Inside
    expect(hitTestShape(25, 25, rect)).toBe(false); // Outside
  });

  it('hit tests an unfilled rectangle correctly', () => {
    const rect: Stroke = {
      id: '2', type: 'rectangle', width: 2, color: '#000', isFilled: false,
      points: [{x: 10, y: 10}, {x: 100, y: 100}]
    };
    expect(hitTestShape(50, 50, rect)).toBe(false); // Inside, but unfilled so shouldn't hit center
    expect(hitTestShape(10, 50, rect)).toBe(true); // On the edge
  });

  it('hit tests a circle correctly', () => {
    const circle: Stroke = {
      id: '3', type: 'circle', width: 2, color: '#000', isFilled: true,
      points: [{x: 0, y: 0}, {x: 10, y: 0}] // Radius = 10
    };
    expect(hitTestShape(5, 0, circle)).toBe(true);
    expect(hitTestShape(15, 0, circle)).toBe(false);
  });
});
