import Living from './Living';

export default class Monster extends Living {

    //#region Action Logic

    /**
     * @returns {{ action: string|function, id:string, chance: number }[]}
     */
    protected get actions() {
        return get([]);
    }

    protected get actionsEnabled() {
        return get(true);
    }

    protected set actionsEnabled(flag) {
        set(flag === true);
    }

    protected set actions(actions) {
        if (Array.isArray(actions)) {
            set(actions);
        }
    }

    /**
     * Add a possible action
     * @param {number} chance The chance an action might occur.  The higher the number the more likely.
     * @param {...string | function | { id: string, action: string | function, chance: number }} actions
     * @returns
     */
    addActions(chance, ...actions) {
        let existing = this.actions;

        for (const action of actions) {
            if (typeof action === 'string') {
                existing.push({ action, id: existing.length, chance });
            }
            else if (typeof action === 'object') {
                existing.push(Object.assign({ chance, id: existing.length }, action));
            }
            else if (typeof action === 'function') {
                existing.push({ chance, id: existing.length, action });
            }
        }
        return this;
    }

    getActions(rand = undefined) {
        if (typeof rand === 'number') {
            return this.actions.filter(a => a.chance > rand);
        }
        else
            return this.actions;
    }

    setActions(chance, ...actions) {
        this.actions = [];
        return this.addActions(chance, ...actions);
    }

    //#endregion

    protected override async eventHeartbeat(length) {
        await super.eventHeartbeat(length);

        if (this.actionsEnabled) {
            let chance = efuns.random(0, 100),
                choices = this.getActions(chance),
                max = choices.length;

            if (max > 0) {
                let selected = max === 1 ? choices[0] : choices[efuns.random(0, max)];

                if (typeof selected.action === 'string') {
                    if (selected.action.charAt(0) === '!') {
                        await efuns.command(selected.action.slice(1));
                    }
                    if (selected.action.startsWith('@')) {
                        let fn = selected.action.slice(1);
                        if (typeof this[fn] === 'function')
                            await this[fn]();
                    }
                    else if (selected.action.length > 0) {
                        this.tellEnvironment(selected.action);
                    }
                }
                else if (typeof selected.action === 'function') {
                    let action = selected.action;
                    await action();
                }
            }
        }
    }
}

