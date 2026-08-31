import { describe, it, expect } from 'vitest';

// Unit test for Drawing Engine with Snapshot History & Text Support
// Focused Architecture Verification

interface Point {
  x: number;
  y: number;
}

type ToolType = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'double-arrow' | 'rectangle' | 'rounded-rectangle' | 'circle' | 'ellipse' | 'polygon' | 'text' | 'select';

interface TextFormat {
  text: string;
}

interface Stroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
  type: ToolType;
  textFormat?: TextFormat;
}

class DrawingEngineSnapshotModel {
  history: Stroke[][] = [[]];
  historyIndex = 0;
  
  get strokes() {
    return this.history[this.historyIndex];
  }

  commitHistory(newStrokes: Stroke[]) {
    const newHistory = this.history.slice(0, this.historyIndex + 1);
    newHistory.push([...newStrokes]);
    this.history = newHistory;
    this.historyIndex = newHistory.length - 1;
  }

  addStroke(stroke: Stroke) {
    this.commitHistory([...this.strokes, stroke]);
  }

  deleteStroke(id: string) {
    this.commitHistory(this.strokes.filter(s => s.id !== id));
  }

  updateStroke(id: string, updatedProps: Partial<Stroke>) {
    const newStrokes = [...this.strokes];
    const idx = newStrokes.findIndex(s => s.id === id);
    if (idx >= 0) {
      newStrokes[idx] = { ...newStrokes[idx], ...updatedProps };
      this.commitHistory(newStrokes);
    }
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return true;
    }
    return false;
  }

  clear() {
    this.commitHistory([]);
  }
}

function runTests() {
  console.log('--- Focused Architecture Verification: Snapshot History ---');
  const engine = new DrawingEngineSnapshotModel();

  // Test Setup: Multiple Annotations sharing history
  engine.addStroke({ id: 'base1', color: 'red', width: 2, type: 'pen', points: [{x: 0, y: 0}] });
  engine.addStroke({ id: 'base2', color: 'blue', width: 2, type: 'rectangle', points: [{x: 0, y: 0}, {x: 10, y: 10}] });
  
  const baseObjectRef = engine.strokes[0];

  // 1. Create text "Hello"
  engine.addStroke({
    id: 'text1',
    color: 'black',
    width: 1,
    type: 'text',
    points: [{ x: 100, y: 100 }],
    textFormat: { text: 'Hello' }
  });

  const snapshotBeforeEdit = engine.strokes;
  const originalTextObjectRef = engine.strokes[2];
  
  // Verify structural sharing
  if (snapshotBeforeEdit[0] !== baseObjectRef) throw new Error('Structural sharing failed on creation');

  // 3. Edit it to "Hello World" (copy-on-write)
  engine.updateStroke('text1', { textFormat: { text: 'Hello World' } });

  const snapshotAfterEdit = engine.strokes;
  const editedTextObjectRef = engine.strokes[2];

  // Identity checks
  if (editedTextObjectRef === originalTextObjectRef) throw new Error('Failure: Mutable reference sharing detected during edit!');
  if (snapshotAfterEdit[0] !== baseObjectRef) throw new Error('Structural sharing failed during edit');

  // 4. Undo
  engine.undo();
  // 5. Verify the text is exactly "Hello"
  if ((engine.strokes[2].textFormat?.text as string) !== 'Hello') throw new Error('Undo failed to restore original text');
  // Verify identity is perfectly restored
  if (engine.strokes[2] !== originalTextObjectRef) throw new Error('Undo failed to restore exact object identity');

  // 6. Redo
  engine.redo();
  // 7. Verify it becomes "Hello World"
  if (engine.strokes[2].textFormat?.text !== 'Hello World') throw new Error('Redo failed to restore edited text');
  if (engine.strokes[2] !== editedTextObjectRef) throw new Error('Redo failed to restore edited object identity');
  console.log('✓ Edit mutation isolation verified');

  // 8. Repeat the same test for movement
  engine.updateStroke('text1', { points: [{ x: 200, y: 200 }] });
  // snapshot array unused, just verify object isolation
  const movedTextObjectRef = engine.strokes[2];

  if (movedTextObjectRef === editedTextObjectRef) throw new Error('Failure: Mutable reference sharing detected during move!');
  
  engine.undo();
  if ((engine.strokes[2].points[0].x as number) !== 100) throw new Error('Undo move failed');
  if (engine.strokes[2] !== editedTextObjectRef) throw new Error('Identity corrupted during undo of move');
  
  engine.redo();
  if (engine.strokes[2].points[0].x !== 200) throw new Error('Redo move failed');
  console.log('✓ Move mutation isolation verified');

  // 9. Repeat for deletion
  engine.deleteStroke('text1');
  const snapshotAfterDelete = engine.strokes;
  
  // Verify z-order / identity of remaining items
  if (snapshotAfterDelete.length !== 2) throw new Error('Delete failed');
  if (snapshotAfterDelete[0] !== baseObjectRef) throw new Error('Base object identity lost during delete');
  
  engine.undo();
  if ((engine.strokes.length as number) !== 3) throw new Error('Undo delete failed');
  if (engine.strokes[2] !== movedTextObjectRef) throw new Error('Identity corrupted during undo of delete');
  if (engine.strokes[2].textFormat?.text !== 'Hello World') throw new Error('Data corrupted during undo of delete');
  
  engine.redo();
  if (engine.strokes.length !== 2) throw new Error('Redo delete failed');
  console.log('✓ Delete mutation isolation verified');

  console.log('\nAll structural sharing & reference mutation tests PASSED!');
}

describe('Drawing Engine History', () => {
  it('passes structural sharing verification', () => {
    runTests();
  });
});
