/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import Living from './Living';

export default class Monster extends Living {

    //#region Non-Combat Actions

    /**
     * @returns {{ action: string|function, id:string, chance: number }[]}
     */
    protected get actions() {
        return get([]);
    }

    protected set actions(actions) {
        if (Array.isArray(actions)) {
            set(actions);
        }
    }

    /**
     * Can this mob perform random actions?
     * @returns {boolean}
     */
    protected get actionsEnabled() {
        return get(false);
    }

    /**
     * @param {boolean} flag If true, then this mob may perform random, non-combat actions
     */
    protected set actionsEnabled(flag) {
        set(flag === true);
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
        this.actionsEnabled = existing.length > 0;
        return this;
    }

    /**
     * Get a list of actions 
     * @param {number} rand If specified, returns all actions with a chance greater than the value
     * @returns
     */
    getActions(rand = undefined) {
        if (typeof rand === 'number') {
            return this.actions.filter(a => a.chance > rand);
        }
        else
            return this.actions;
    }

    /**
     * Remove an action
     * @param {string|number} id The action to remove
     */
    removeAction(id) {
        let actions = this.actions;
        let index = actions.findIndex(a => a.id == id);

        if (index < 0 && typeof id === 'number' && id < actions.length)
            index = id;

        if (index > -1) {
            actions = actions.splice(index, 1);
            if (actions.length === 0)
                this.actionsEnabled = false;
        }
    }

    /**
     * Replaces any existing actions
     * @param {number} chance
     * @param {...any} actions
     * @returns
     */
    setActions(chance, ...actions) {
        this.actions = [];
        return this.addActions(chance, ...actions);
    }

    //#endregion

    //#region Combat Actions

    /**
     * @returns {{ action: string|function, id:string, chance: number }[]}
     */
    protected get combatActions() {
        return get([]);
    }

    protected set combatActions(actions) {
        if (Array.isArray(actions)) {
            set(actions);
        }
    }

    /**
     * Can this mob perform random actions during combat?
     * @returns {boolean}
     */
    protected get combatActionsEnabled() {
        return get(false);
    }

    /**
     * @param {boolean} flag If true, then this mob may perform random, combat actions
     */
    protected set combatActionsEnabled(flag) {
        set(flag === true);
    }

    /**
     * Add possible combat action(s)
     * @param {number} chance The chance an action might occur.  The higher the number the more likely.
     * @param {...string | function | { id: string, action: string | function, chance: number }} actions
     * @returns
     */
    addCombatActions(chance, ...actions) {
        let existing = this.combatActions;

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
        this.combatActionsEnabled = existing.length > 0;
        return this;
    }

    /**
     * Get a list of actions 
     * @param {number} rand If specified, returns all actions with a chance greater than the value
     * @returns
     */
    getCombatActions(rand = undefined) {
        if (typeof rand === 'number') {
            return this.combatActions.filter(a => a.chance > rand);
        }
        else
            return this.combatActions;
    }

    /**
     * Remove an action
     * @param {string|number} id The action to remove
     */
    removeAction(id) {
        let actions = this.combatActions;
        let index = actions.findIndex(a => a.id == id);

        if (index < 0 && typeof id === 'number' && id < actions.length)
            index = id;

        if (index > -1) {
            actions = actions.splice(index, 1);
            if (actions.length === 0)
                this.combatActionsEnabled = false;
        }
    }

    /**
     * Replaces any existing combat actions
     * @param {number} chance
     * @param {...any} actions
     * @returns
     */
    setCombatActions(chance, ...actions) {
        this.combatActions = [];
        return this.addCombatActions(chance, ...actions);
    }

    //#endregion

    /**
     * Execute the heartbeat
     * @param {number} length The heartbeat interval
     */
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
                    await selected.action(this);
                }
            }
        }
    }
}

