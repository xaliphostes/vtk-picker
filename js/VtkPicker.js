import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkPointPicker from '@kitware/vtk.js/Rendering/Core/PointPicker';
import vtkPicker from '@kitware/vtk.js/Rendering/Core/Picker';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkLineSource from '@kitware/vtk.js/Filters/Sources/LineSource';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
export class GenericVTKPicker {
    constructor(renderer, renderWindow, config = {
        type: "cell" /* PickerType.CELL */,
        modifierKey: "none" /* ModifierKey.NONE */,
        showRayDuringDrag: true,
        rayColor: [1.0, 1.0, 0.0],
        pointColor: [1.0, 0.0, 0.0],
        pointRadius: 0.05
    }) {
        this.pickCallbacks = [];
        // Ray visualization
        this.rayActor = null;
        this.rayLineSource = null;
        this.pointActor = null;
        this.pointSphereSource = null;
        // State tracking
        this.isMouseDown = false;
        this.lastPickResult = null;
        this.currentModifierPressed = false;
        this.renderer = renderer;
        this.renderWindow = renderWindow;
        this.config = {
            modifierKey: "none" /* ModifierKey.NONE */,
            showRayDuringDrag: true,
            rayColor: [1.0, 1.0, 0.0],
            pointColor: [1.0, 0.0, 0.0],
            pointRadius: 0.05,
            ...config
        };
        this.picker = this.createPicker();
        this.setupPicker();
        this.pickCallbacks = [];
        this.setupVisualization();
        this.setupInteractionHandlers();
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
    setupVisualization() {
        // Create ray line
        this.rayLineSource = vtkLineSource.newInstance();
        const rayMapper = vtkMapper.newInstance();
        rayMapper.setInputConnection(this.rayLineSource.getOutputPort());
        this.rayActor = vtkActor.newInstance();
        this.rayActor.setMapper(rayMapper);
        this.rayActor.getProperty().setColor(...(this.config.rayColor || [1.0, 1.0, 0.0]));
        this.rayActor.getProperty().setLineWidth(2);
        this.rayActor.setVisibility(false);
        // Create intersection point sphere
        this.pointSphereSource = vtkSphereSource.newInstance({
            radius: this.config.pointRadius || 0.05,
            phiResolution: 16,
            thetaResolution: 16
        });
        const pointMapper = vtkMapper.newInstance();
        pointMapper.setInputConnection(this.pointSphereSource.getOutputPort());
        this.pointActor = vtkActor.newInstance();
        this.pointActor.setMapper(pointMapper);
        this.pointActor.getProperty().setColor(...(this.config.pointColor || [1.0, 0.0, 0.0]));
        this.pointActor.setVisibility(false);
        // Add to renderer
        this.renderer.addActor(this.rayActor);
        this.renderer.addActor(this.pointActor);
    }
    setupInteractionHandlers() {
        const interactor = this.renderWindow.getInteractor();
        // Mouse down - start picking if modifier key is correct
        interactor.onLeftButtonPress((event) => {
            if (this.isModifierKeyActive(event)) {
                this.isMouseDown = true;
                this.performPick(event);
            }
        });
        // Mouse move - update ray visualization if mouse is down
        interactor.onMouseMove((event) => {
            if (this.isMouseDown && this.isModifierKeyActive(event) && this.config.showRayDuringDrag) {
                this.updateRayVisualization(event);
            }
        });
        // Mouse up - finalize pick and hide visualization
        interactor.onLeftButtonRelease((event) => {
            if (this.isMouseDown) {
                this.isMouseDown = false;
                this.hideVisualization();
            }
        });
        // Track modifier key state changes
        interactor.onKeyPress((event) => {
            this.updateModifierState(event);
        });
        interactor.onKeyUp((event) => {
            this.updateModifierState(event);
            // If modifier key is released while dragging, hide visualization
            if (this.isMouseDown && !this.isModifierKeyActive(event)) {
                this.hideVisualization();
            }
        });
    }
    isModifierKeyActive(event) {
        switch (this.config.modifierKey) {
            case "none" /* ModifierKey.NONE */:
                return true;
            case "shift" /* ModifierKey.SHIFT */:
                return event.shiftKey === true;
            case "ctrl" /* ModifierKey.CTRL */:
                return event.controlKey === true;
            case "alt" /* ModifierKey.ALT */:
                return event.altKey === true;
            default:
                return true;
        }
    }
    updateModifierState(event) {
        this.currentModifierPressed = this.isModifierKeyActive(event);
    }
    performPick(event) {
        const result = this.pickFromMouseEvent(event);
        this.lastPickResult = result;
        if (result.success && result.worldPosition) {
            this.showVisualization(event, result.worldPosition);
        }
        else {
            this.hideVisualization();
        }
    }
    updateRayVisualization(event) {
        if (!this.lastPickResult || !this.lastPickResult.success) {
            return;
        }
        // Get camera position for ray origin
        const camera = this.renderer.getActiveCamera();
        const cameraPos = camera.getPosition();
        const pickPos = this.lastPickResult.worldPosition;
        // Update ray
        this.rayLineSource.setPoint1(cameraPos[0], cameraPos[1], cameraPos[2]);
        this.rayLineSource.setPoint2(pickPos[0], pickPos[1], pickPos[2]);
        // Ensure visualization is visible
        if (this.rayActor && !this.rayActor.getVisibility()) {
            this.rayActor.setVisibility(true);
        }
        if (this.pointActor && !this.pointActor.getVisibility()) {
            this.pointActor.setVisibility(true);
        }
        this.renderWindow.render();
    }
    showVisualization(event, worldPosition) {
        if (!this.config.showRayDuringDrag) {
            return;
        }
        const camera = this.renderer.getActiveCamera();
        const cameraPos = camera.getPosition();
        // Set ray from camera to pick point
        this.rayLineSource.setPoint1(cameraPos[0], cameraPos[1], cameraPos[2]);
        this.rayLineSource.setPoint2(worldPosition[0], worldPosition[1], worldPosition[2]);
        this.rayActor.setVisibility(true);
        // Set point at pick position
        this.pointActor.setPosition(worldPosition[0], worldPosition[1], worldPosition[2]);
        this.pointActor.setVisibility(true);
        this.renderWindow.render();
    }
    hideVisualization() {
        if (this.rayActor) {
            this.rayActor.setVisibility(false);
        }
        if (this.pointActor) {
            this.pointActor.setVisibility(false);
        }
        this.renderWindow.render();
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
                result.cellId = cellPicker.getCellId();
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
    removePickListener(callback) {
        const index = this.pickCallbacks.indexOf(callback);
        if (index > -1) {
            this.pickCallbacks.splice(index, 1);
        }
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
        if (config.modifierKey !== undefined) {
            this.config.modifierKey = config.modifierKey;
        }
        if (config.showRayDuringDrag !== undefined) {
            this.config.showRayDuringDrag = config.showRayDuringDrag;
        }
        if (config.rayColor) {
            this.config.rayColor = config.rayColor;
            if (this.rayActor) {
                this.rayActor.getProperty().setColor(...config.rayColor);
            }
        }
        if (config.pointColor) {
            this.config.pointColor = config.pointColor;
            if (this.pointActor) {
                this.pointActor.getProperty().setColor(...config.pointColor);
            }
        }
        if (config.pointRadius !== undefined) {
            this.config.pointRadius = config.pointRadius;
            if (this.pointSphereSource) {
                this.pointSphereSource.setRadius(config.pointRadius);
            }
        }
    }
    destroy() {
        if (this.rayActor) {
            this.renderer.removeActor(this.rayActor);
        }
        if (this.pointActor) {
            this.renderer.removeActor(this.pointActor);
        }
    }
}
