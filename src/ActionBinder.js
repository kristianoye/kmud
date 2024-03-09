/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: May 1, 2021
 *
 * Description: Module contains data storage for in-game objects.
 */

class ActionEntry {
    /**
     * Construct an entry
     * @param {string} verb The verb used to invoke these actions
     */
    constructor(verb) {
        this.verb = verb;

        /** @type {Object.<string,{ target: MUDObject, callback: (text: string, evt:MUDInputEvent)=>boolean>>}} */
        this.mapping = {};
        this.count = 0;
    }

    /**
     * Add a mapping
     * @param {MUDObject} target The object containing the action
     * @param {(text: string, evt:MUDInputEvent)=>boolean} callback The action callback
     */
    addMapping(target, callback) {
        this.mapping[target.filename] = { callback, target: wrapper(target), filename: target.filename };
        this.count++;
    }

    /**
     * Execute an action
     * @param {MUDInputEvent} evt
     * @returns {Promise<boolean>}
     */
    async execute(evt) {
        let files = Object.keys(this.mapping);

        for (let i = 0; i < files.length; i++) {
            let entry = this.mapping[files[i]];
            let result = false;

            if (efuns.isAsync(entry.callback))
                result = await entry.callback.apply(entry.target(), [evt.text, evt]);
            else
                result = entry.callback.apply(entry.target(), [evt.text, evt]);

            return result;
        }
        return false;
    }

    /**
     * Returns the number of mappings to this verb
     */
    get length() {
        return this.count;
    }

    /**
     * Unbind actions that map to the specified filename.
     * @param {string} filename
     */
    unbind(filename) {
        delete this.mapping[filename];
        this.count--;
    }
}

/**
 * A binder that contains a dictionary mapping custom verbs to  
 */
class ActionBinder {
    /**
     * Construct a new action binder
     */
    constructor() {
        /** @type {Object.<string,ActionEntry>} */
        this.actions = {};
    } 

    /**
     * Create an action binding.
     * 
     * @param {string} verb The verb to invoke the action
     * @param {MUDObject} target The verb to invoke the action
     * @param {(text: string, evt:MUDInputEvent)=>boolean} callback The verb to invoke the action
     * @return {ActionBinder}
     */
    bindAction(verb, target, callback) {
        if (verb in this.actions === false)
            this.actions[verb] = new ActionEntry(verb);
        this.actions[verb].addMapping(target, callback);
        return this;
    }

    /**
     * Clear all actions out of the binder
     */
    clear() {
        this.actions = {};
    }

    /**
     * Get an environmental action entry
     * @param {string} verb The verb being invoked
     */
    getAction(verb) {
        return this.actions[verb];
    }

    /**
     * Get all actions as an array 
     */
    getActions() {
        return Object.keys(this.actions)
            .map(a => this.actions[a]);
    }

    /**
     * Try and execute a command as an added action
     * @param {MUDInputEvent} evt The command to execute
     * @returns {boolean} Returns true on success
     */
    async tryAction(evt) {
        let action = this.getAction(evt.verb);

        if (action)
            return await action.execute(evt);
        else
            return undefined;
    }

    /** 
     * Unbinds all actions implemented by the specified object 
     * @param {MUDObject} obj The object to unbind from
     */
    unbindActions(obj) {
        let actions = this.getActions();

        for (let i = 0, m = actions.length; i < m; i++) {
            let a = actions[i];

            a.unbind(obj.filename);
            if (a.length === 0)
                delete this.actions[a.verb];
        }
    }
}

module.exports = ActionBinder;
