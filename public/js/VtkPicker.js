import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkPointPicker from '@kitware/vtk.js/Rendering/Core/PointPicker';
import vtkPicker from '@kitware/vtk.js/Rendering/Core/Picker';
// interface ExtendedPointPicker extends vtkPointPicker {
//     getPointId?: () => number ;
// }
export var PickerType;
(function (PickerType) {
    PickerType["CELL"] = "cell";
    PickerType["POINT"] = "point";
    PickerType["WORLD"] = "world";
})(PickerType || (PickerType = {}));
export class GenericVTKPicker {
    constructor(renderer, renderWindow, config = { type: PickerType.CELL }) {
        this.pickCallbacks = [];
        this.renderer = renderer;
        this.renderWindow = renderWindow;
        this.config = config;
        this.picker = this.createPicker();
        this.setupPicker();
    }
    createPicker() {
        let picker;
        switch (this.config.type) {
            case PickerType.CELL:
                picker = vtkCellPicker.newInstance();
                break;
            case PickerType.POINT:
                picker = vtkPointPicker.newInstance();
                break;
            case PickerType.WORLD:
                picker = vtkPicker.newInstance();
                break;
            default:
                picker = vtkCellPicker.newInstance();
        }
        return picker;
    }
    setupPicker() {
        if (this.config.tolerance !== undefined) {
            this.picker.setTolerance(this.config.tolerance);
        }
        if (this.config.pickFromList !== undefined) {
            this.picker.setPickFromList(this.config.pickFromList);
        }
        if (this.config.initializePickList !== undefined) {
            this.picker.initializePickList();
        }
    }
    pick(x, y) {
        this.picker.pick([x, y, 0], this.renderer);
        const pickSuccessful = this.picker.getActors().length !== 0;
        const result = {
            success: pickSuccessful,
            position: [x, y]
        };
        if (pickSuccessful) {
            result.worldPosition = this.picker.getPickPosition();
            result.actor = this.picker.getActors()[0];
            if (this.config.type === PickerType.CELL && 'getCellId' in this.picker) {
                result.cellId = this.picker.getCellId();
                result.pickPosition = this.picker.getPickPosition();
                //result.normal = (this.picker as vtkCellPicker).getPickNormal();
                result.normal = this.picker.getPickNormal();
            }
            if (this.config.type === PickerType.POINT && 'getPointId' in this.picker) {
                result.pointId = this.picker.getPointId();
            }
            this.notifyCallbacks(result);
        }
        return result;
    }
    pickFromMouseEvent(event) {
        const bounds = event.target.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        return this.pick(x, y);
    }
    addPickListener(callback) {
        this.pickCallbacks.push(callback);
    }
    removePickListener(callback) {
        const index = this.pickCallbacks.indexOf(callback);
        if (index > -1) {
            this.pickCallbacks.splice(index, 1);
        }
    }
    clearPickListeners() {
        this.pickCallbacks = [];
    }
    notifyCallbacks(result) {
        this.pickCallbacks.forEach(callback => callback(result));
    }
    addActorToPickList(actor) {
        this.picker.addPickList(actor);
    }
    removeActorFromPickList(actor) {
        this.picker.deletePickList(actor);
    }
    setTolerance(tolerance) {
        this.picker.setTolerance(tolerance);
        this.config.tolerance = tolerance;
    }
    getTolerance() {
        return this.picker.getTolerance();
    }
    enablePickFromList(enable) {
        this.picker.setPickFromList(enable);
        this.config.pickFromList = enable;
    }
    getPicker() {
        return this.picker;
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        if (config.type && config.type !== this.config.type) {
            this.config.type = config.type;
            this.picker = this.createPicker();
            this.setupPicker();
        }
        if (config.tolerance !== undefined) {
            this.setTolerance(config.tolerance);
        }
        if (config.pickFromList !== undefined) {
            this.enablePickFromList(config.pickFromList);
        }
        if (config.initializePickList !== undefined) {
            this.picker.initializePickList();
            this.config.initializePickList = config.initializePickList;
        }
    }
}
// Usage example:
/*
import { GenericVTKPicker, PickerType } from './GenericVTKPicker';

// Create picker
const picker = new GenericVTKPicker(renderer, renderWindow, {
  type: PickerType.CELL,
  tolerance: 0.005
});

// Add pick listener
picker.addPickListener((result) => {
  if (result.success) {
    console.log('Picked position:', result.worldPosition);
    console.log('Cell ID:', result.cellId);
  }
});

// Handle mouse clicks
renderWindow.getInteractor().onLeftButtonPress((event) => {
  const result = picker.pickFromMouseEvent(event);
  if (result.success) {
    console.log('Pick successful!');
  }
});
*/ 
