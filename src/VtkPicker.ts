import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkPointPicker from '@kitware/vtk.js/Rendering/Core/PointPicker';
import vtkPicker from '@kitware/vtk.js/Rendering/Core/Picker';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

export const enum PickerType {
    CELL = 'cell',
    POINT = 'point',
    WORLD = 'world'
};

export interface PickResult {
    success: boolean;
    position: number[];
    worldPosition?: number[];
    cellId?: number;
    pointId?: number;
    actor?: vtkActor;
    pickPosition?: number[];
    normal?: number[];
}

export interface PickerConfig {
    type: PickerType;
    tolerance?: number;
    pickFromList?: boolean;
    initializePickList?: boolean;
}

export class GenericVTKPicker {
    private picker: vtkCellPicker | vtkPointPicker | vtkPicker;
    private renderer: vtkRenderer;
    private renderWindow: vtkRenderWindow;
    private config: PickerConfig;
    private pickCallbacks: Array<(result: PickResult) => void> = [];

    constructor(renderer: vtkRenderer, renderWindow: vtkRenderWindow, config = { type: PickerType.CELL }) {
        this.renderer = renderer;
        this.renderWindow = renderWindow;
        this.config = config;
        this.picker = this.createPicker();
        this.setupPicker();
        this.pickCallbacks = [];
    }

    createPicker() {
        switch (this.config.type) {
            case PickerType.CELL:
                return vtkCellPicker.newInstance();
            case PickerType.POINT:
                return vtkPointPicker.newInstance();
            case PickerType.WORLD:
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

    pick(x: number, y: number) {
        this.picker.pick([x, y, 0], this.renderer);
        const pickSuccessful = this.picker.getActors().length !== 0

        const result: PickResult = {
            success: pickSuccessful,
            position: [x, y]
        };

        if (pickSuccessful) {
            result.worldPosition = this.picker.getPickPosition();
            result.actor = this.picker.getActors()[0];

            if (this.config.type === PickerType.CELL && 'getCellId' in this.picker) {
                const cellPicker = this.picker as vtkCellPicker;

                result.cellId = (this.picker as vtkCellPicker).getCellId();
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

            if (this.config.type === PickerType.POINT && 'getPointId' in this.picker) {
                result.pointId = (this.picker as vtkPointPicker).getPointId();
            }
        }

        this.notifyCallbacks(result);
        return result;
    }

    pickFromMouseEvent(event: MouseEvent) {
        const canvas = this.renderWindow.getViews()[0].getCanvas();
        const bounds = canvas.getBoundingClientRect();
        const x = event.position.x;
        const y = event.position.y
        return this.pick(x, y);
    }

    addPickListener(callback: (result: PickResult) => void) {
        this.pickCallbacks.push(callback);
    }

    notifyCallbacks(result: PickResult) {
        this.pickCallbacks.forEach(callback => callback(result));
    }

    setTolerance(tolerance: number) {
        this.picker.setTolerance(tolerance);
        this.config.tolerance = tolerance;
    }

    updateConfig(config: Partial<PickerConfig>) {
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
