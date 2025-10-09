import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkPointPicker from '@kitware/vtk.js/Rendering/Core/PointPicker';
import vtkPicker from '@kitware/vtk.js/Rendering/Core/Picker';
;
export class GenericVTKPicker {
    constructor(renderer, renderWindow, config = { type: "cell" /* PickerType.CELL */ }) {
        this.pickCallbacks = [];
        this.renderer = renderer;
        this.renderWindow = renderWindow;
        this.config = config;
        this.picker = this.createPicker();
        this.setupPicker();
        this.pickCallbacks = [];
    }
    createPicker() {
        switch (this.config.type) {
            case "cell" /* PickerType.CELL */:
                return vtkCellPicker.newInstance();
            case "point" /* PickerType.POINT */:
                return vtkPointPicker.newInstance();
            case "world" /* PickerType.WORLD */:
                return vtkPicker.newInstance();
            default:
                return vtkCellPicker.newInstance();
        }
    }
    setupPicker() {
        if (this.config.tolerance !== undefined) {
            this.picker.setTolerance(this.config.tolerance);
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
            if (this.config.type === "cell" /* PickerType.CELL */ && 'getCellId' in this.picker) {
                const cellPicker = this.picker;
                result.cellId = this.picker.getCellId();
                result.pickPosition = this.picker.getPickPosition();
                // Get the normal from the picked data
                const pickedData = cellPicker.getDataSet();
                if (pickedData) {
                    const cellData = pickedData.getCellData();
                    const normals = cellData.getNormals();
                    if (normals && result.cellId !== undefined) {
                        const normalTuple = normals.getTuple(result.cellId);
                        result.normal = [normalTuple[0], normalTuple[1], normalTuple[2]];
                    }
                }
            }
            if (this.config.type === "point" /* PickerType.POINT */ && 'getPointId' in this.picker) {
                result.pointId = this.picker.getPointId();
            }
        }
        this.notifyCallbacks(result);
        return result;
    }
    pickFromMouseEvent(event) {
        const canvas = this.renderWindow.getViews()[0].getCanvas();
        const bounds = canvas.getBoundingClientRect();
        const x = event.position.x;
        const y = event.position.y;
        return this.pick(x, y);
    }
    addPickListener(callback) {
        this.pickCallbacks.push(callback);
    }
    notifyCallbacks(result) {
        this.pickCallbacks.forEach(callback => callback(result));
    }
    setTolerance(tolerance) {
        this.picker.setTolerance(tolerance);
        this.config.tolerance = tolerance;
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
    }
}
