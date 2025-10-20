# ScenePicker (vtk.js utility)

`ScenePicker` is a lightweight helper class designed to simplify object picking in vtk.js scenes.It wraps vtk.js mouse events (`onLeftButtonPress`, etc.) and any compatible vtk.js picker (`vtkCellPicker`, `vtkPointPicker`, `vtkPropPicker`, …),and emits normalized, easy-to-use pick events.

## [Demo](https://xaliphostes.github.io/vtk-picker/)

## Features

- Works with `vtkCellPicker`, `vtkPointPicker`, and other compatible pickers
- Configurable mouse button (left, middle, right)
- Optional modifier key requirements (Shift, Ctrl, Alt, Meta/Cmd)
- Normalized event interface across different picker types
- Simple subscription-based API

## Installation

Copy `VtkPicker.ts` into your project.

## Quick Example

```typescript
import { ScenePicker } from './ScenePicker';
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';

// Setup your vtk.js scene first
const interactor = renderWindow.getInteractor();
const cellPicker = vtkCellPicker.newInstance();

// Create picker with left mouse button
const scenePicker = new ScenePicker(interactor, cellPicker, {
  button: 'left',
  requireModifiers: { shift: true } // Optional: require Shift key
});

// Listen for pick events
scenePicker.onPick((event) => {
  if (event.picked) {
    console.log('Picked actor:', event.actor);
    console.log('World position:', event.world);
    console.log('Cell ID:', event.cellId);
  }
});

// Cleanup when done
scenePicker.dispose();
```

## API

### Constructor

```typescript
new ScenePicker(interactor, picker, options?)
```

**Options:**
- `button?: 'left' | 'middle' | 'right'` - Mouse button to use (default: 'left')
- `requireModifiers?: { shift?, ctrl?, alt?, meta? }` - Required modifier keys

### Methods

- `onPick(callback)` - Register pick event listener, returns unsubscribe function
- `dispose()` - Clean up all event listeners

### Event Object

```typescript
{
  picked: boolean;           // Whether anything was picked
  actor: any;                // Picked actor/prop
  world: [x, y, z];         // 3D world coordinates
  cellId: number;           // Cell ID (if available)
  pointId: number;          // Point ID (if available)
  displayPos: [x, y, z];    // Screen coordinates
  modifiers: { shift, ctrl, alt, meta };
  button: string;           // Which button was pressed
  // ... additional fields
}
```

## License

MIT

## Author
[xaliphostes](https://github.com/xaliphostes)