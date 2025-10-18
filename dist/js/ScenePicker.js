// Lightweight utility for vtk.js picking with key modifiers.
// Works with vtkCellPicker / vtkPointPicker (or your own compatible "picker").
// NOTE: seems that vtkPropPicker is not (yet?) implemented
export class ScenePicker {
    // private currentRenderer: vtkObject | undefined = undefined
    constructor(interactor, picker, opts = {}) {
        this.subUnsub = [];
        this.listeners = new Set();
        this.interactor = interactor;
        // this.currentRenderer = renderer
        this.picker = picker;
        this.opts = {
            button: opts.button ?? 'left',
            requireModifiers: opts.requireModifiers ?? {},
        };
        this.attach();
    }
    dispose() {
        // call all uninstallers safely
        while (this.subUnsub.length) {
            const off = this.subUnsub.pop();
            try {
                off && off();
            }
            catch { /* ignore */ }
        }
        this.listeners.clear();
    }
    onPick(cb) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }
    attach() {
        const add = (sub) => {
            const u = this.toUnsubscribe(sub);
            if (u)
                this.subUnsub.push(u);
        };
        const handler = (button) => (callData) => {
            const { position, pokedRenderer } = callData || {};
            if (!pokedRenderer || !position)
                return;
            // if (callData.pokedRenderer && callData.pokedRenderer !== this.currentRenderer) return;
            // Normalize modifiers from vtk.js callData
            const mods = {
                shift: !!callData.shiftKey,
                ctrl: !!callData.controlKey,
                alt: !!callData.altKey,
                meta: !!callData.metaKey,
            };
            // Enforce required modifiers if provided
            if (!this.modifiersMatch(mods, this.opts.requireModifiers))
                return;
            const displayPos = [position.x, position.y, 0];
            // Run the injected picker
            this.picker.pick(displayPos, pokedRenderer);
            const picked = this.computePicked(this.picker);
            const baseEvt = {
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
            const evt = Object.assign(baseEvt, norm);
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
    computePicked(p) {
        if (typeof p.getActors === 'function' && (p.getActors()?.length ?? 0) > 0)
            return true;
        if (typeof p.getProp3Ds === 'function' && (p.getProp3Ds()?.length ?? 0) > 0)
            return true;
        if (typeof p.getActor === 'function' && p.getActor())
            return true;
        if (typeof p.getViewProp === 'function' && p.getViewProp())
            return true;
        if (typeof p.getCellId === 'function' && typeof p.getCellId() === 'number' && p.getCellId() >= 0)
            return true;
        if (typeof p.getPointId === 'function' && typeof p.getPointId() === 'number' && p.getPointId() >= 0)
            return true;
        // Some pickers expose prop/composite ids
        if (typeof p.getPropId === 'function' && typeof p.getPropId() === 'number' && p.getPropId() >= 0)
            return true;
        if (typeof p.getCompositeID === 'function' && typeof p.getCompositeID() === 'number' && p.getCompositeID() >= 0)
            return true;
        return false;
    }
    // Normalize result so your UI code doesn't have to care about picker type
    normalizePick(p) {
        // Actor / prop
        let actor = null;
        if (typeof p.getActor === 'function' && p.getActor())
            actor = p.getActor();
        else if (typeof p.getViewProp === 'function' && p.getViewProp())
            actor = p.getViewProp();
        else if (typeof p.getActors === 'function' && p.getActors()?.length)
            actor = p.getActors()[0];
        else if (typeof p.getProp3Ds === 'function' && p.getProp3Ds()?.length)
            actor = p.getProp3Ds()[0];
        // World position (present on Cell/Point pickers)
        const world = typeof p.getPickPosition === 'function' ? p.getPickPosition() : null;
        // IDs (may be -1 or undefined depending on picker)
        const cellId = typeof p.getCellId === 'function' ? p.getCellId() : undefined;
        const pointId = typeof p.getPointId === 'function' ? p.getPointId() : undefined;
        return { actor, world, cellId, pointId };
    }
    modifiersMatch(mods, required) {
        // Only check keys that are explicitly required
        if (required.shift !== undefined && mods.shift !== required.shift)
            return false;
        if (required.ctrl !== undefined && mods.ctrl !== required.ctrl)
            return false;
        if (required.alt !== undefined && mods.alt !== required.alt)
            return false;
        if (required.meta !== undefined && mods.meta !== required.meta)
            return false;
        return true;
    }
    // Helper to normalize whatever onXxx returns into a callable unsubscriber
    toUnsubscribe(sub) {
        if (!sub)
            return null;
        if (typeof sub === 'function')
            return sub; // some APIs return a direct unsubscriber
        if (typeof sub.unsubscribe === 'function') {
            return () => sub.unsubscribe(); // vtk.js returns { unsubscribe() { ... } }
        }
        return null; // unknown shape; ignore
    }
}
