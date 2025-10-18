// Lightweight utility for vtk.js picking with key modifiers.
// Works with vtkCellPicker / vtkPointPicker (or your own compatible "picker").
// NOTE: seems that vtkPropPicker is not (yet?) implemented

import { vtkObject } from "@kitware/vtk.js/interfaces";

type VtkPickerLike = {
    pick: (displayPos: [number, number, number], renderer: any) => number | boolean;
    getPickPosition?: () => [number, number, number];
    // You can add optional getters you rely on, e.g. getActor(), getCellId(), getPointId(), etc.
    // They are intentionally left optional to avoid tight coupling with a single picker type.
};

type MouseButton = 'left' | 'middle' | 'right';

export type ModifierMask = {
    shift?: boolean
    ctrl?: boolean
    alt?: boolean
    meta?: boolean     // Cmd on macOS, Win key on Windows (rarely used in browsers)
};

export type ScenePickerEvent = {
    renderer: any;
    rawEvent: any;
    displayPos: [number, number, number];
    picked: boolean;
    picker: VtkPickerLike;
    modifiers: Required<ModifierMask>;
    button: MouseButton;
    // normalized:
    actor?: any | null;
    world?: [number, number, number] | null;
    cellId?: number | undefined;
    pointId?: number | undefined;
};

export type ScenePickerOptions = {
    button?: MouseButton;                   // default 'left'
    requireModifiers?: ModifierMask;        // if provided, event must match these to fire
    // If you want multi-button support, you can new up multiple ScenePicker instances with different buttons.
};

export class ScenePicker {
    private interactor: any;
    private picker: VtkPickerLike;
    private opts: Required<ScenePickerOptions>;
    private subUnsub: Array<() => void> = [];
    private listeners: Set<(ev: ScenePickerEvent) => void> = new Set();
    // private currentRenderer: vtkObject | undefined = undefined

    constructor(interactor: any, picker: VtkPickerLike, opts: ScenePickerOptions = {}) {
        this.interactor = interactor;
        // this.currentRenderer = renderer
        this.picker = picker;
        this.opts = {
            button: opts.button ?? 'left',
            requireModifiers: opts.requireModifiers ?? {},
        } as Required<ScenePickerOptions>;
        this.attach();
    }

    dispose() {
        // call all uninstallers safely
        while (this.subUnsub.length) {
            const off = this.subUnsub.pop();
            try { off && off(); } catch { /* ignore */ }
        }
        this.listeners.clear();
    }

    onPick(cb: (ev: ScenePickerEvent) => void) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private attach() {
        const add = (sub: any) => {
            const u = this.toUnsubscribe(sub);
            if (u) this.subUnsub.push(u);
        };

        const handler = (button: MouseButton) => (callData: any) => {
            const { position, pokedRenderer } = callData || {};
            if (!pokedRenderer || !position) return;

            // if (callData.pokedRenderer && callData.pokedRenderer !== this.currentRenderer) return;

            // Normalize modifiers from vtk.js callData
            const mods: Required<ModifierMask> = {
                shift: !!callData.shiftKey,
                ctrl: !!callData.controlKey,
                alt: !!callData.altKey,
                meta: !!callData.metaKey,
            };

            // Enforce required modifiers if provided
            if (!this.modifiersMatch(mods, this.opts.requireModifiers)) return;

            const displayPos: [number, number, number] = [position.x, position.y, 0];

            // Run the injected picker
            this.picker.pick(displayPos, pokedRenderer);
            const picked = this.computePicked(this.picker);

            const baseEvt: ScenePickerEvent = {
                renderer: pokedRenderer,
                rawEvent: callData,
                displayPos,
                picked,
                picker: this.picker,
                modifiers: mods,
                button,
            };

            // Attach normalized fields so the UI never sees nulls just because of a different picker
            const norm = this.normalizePick(this.picker);
            const evt: ScenePickerEvent & typeof norm = Object.assign(baseEvt, norm);

            // Fan out to listeners
            this.listeners.forEach((fn) => fn(evt));
        };

        // Wire the chosen button
        switch (this.opts.button) {
            case 'left':
                add(this.interactor.onLeftButtonPress(handler('left')));
                break;
            case 'middle':
                add(this.interactor.onMiddleButtonPress(handler('middle')));
                break;
            case 'right':
                add(this.interactor.onRightButtonPress(handler('right')));
                break;
        }
    }

    // Decide if something was picked (works for Cell/Point/Prop)
    private computePicked(p: any): boolean {
        if (typeof p.getActors === 'function' && (p.getActors()?.length ?? 0) > 0) return true;
        if (typeof p.getProp3Ds === 'function' && (p.getProp3Ds()?.length ?? 0) > 0) return true;

        if (typeof p.getActor === 'function' && p.getActor()) return true;
        if (typeof p.getViewProp === 'function' && p.getViewProp()) return true;

        if (typeof p.getCellId === 'function' && typeof p.getCellId() === 'number' && p.getCellId() >= 0) return true;
        if (typeof p.getPointId === 'function' && typeof p.getPointId() === 'number' && p.getPointId() >= 0) return true;

        // Some pickers expose prop/composite ids
        if (typeof p.getPropId === 'function' && typeof p.getPropId() === 'number' && p.getPropId() >= 0) return true;
        if (typeof p.getCompositeID === 'function' && typeof p.getCompositeID() === 'number' && p.getCompositeID() >= 0) return true;

        return false;
    }

    // Normalize result so your UI code doesn't have to care about picker type
    private normalizePick(p: any) {
        // Actor / prop
        let actor: any = null;
        if (typeof p.getActor === 'function' && p.getActor()) actor = p.getActor();
        else if (typeof p.getViewProp === 'function' && p.getViewProp()) actor = p.getViewProp();
        else if (typeof p.getActors === 'function' && p.getActors()?.length) actor = p.getActors()[0];
        else if (typeof p.getProp3Ds === 'function' && p.getProp3Ds()?.length) actor = p.getProp3Ds()[0];

        // World position (present on Cell/Point pickers)
        const world = typeof p.getPickPosition === 'function' ? p.getPickPosition() : null;

        // IDs (may be -1 or undefined depending on picker)
        const cellId = typeof p.getCellId === 'function' ? p.getCellId() : undefined;
        const pointId = typeof p.getPointId === 'function' ? p.getPointId() : undefined;

        return { actor, world, cellId, pointId };
    }

    private modifiersMatch(
        mods: Required<ModifierMask>,
        required: ModifierMask
    ): boolean {
        // Only check keys that are explicitly required
        if (required.shift !== undefined && mods.shift !== required.shift) return false;
        if (required.ctrl !== undefined && mods.ctrl !== required.ctrl) return false;
        if (required.alt !== undefined && mods.alt !== required.alt) return false;
        if (required.meta !== undefined && mods.meta !== required.meta) return false;
        return true;
    }

    // Helper to normalize whatever onXxx returns into a callable unsubscriber
    private toUnsubscribe(sub: any): (() => void) | null {
        if (!sub) return null;
        if (typeof sub === 'function') return sub;              // some APIs return a direct unsubscriber
        if (typeof sub.unsubscribe === 'function') {
            return () => sub.unsubscribe();                       // vtk.js returns { unsubscribe() { ... } }
        }
        return null; // unknown shape; ignore
    }

}
