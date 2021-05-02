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
    }

    /**
     * Add a mapping
     * @param {MUDObject} target The object containing the action
     * @param {(text: string, evt:MUDInputEvent)=>boolean} callback The action callback
     */
    addMapping(target, callback) {
        this.mapping[target.filename] = { callback, target };
    }

    /**
     * Execute an action
     * @param {MUDInputEvent} evt
     * @returns {boolean}
     */
    execute(evt) {
        let files = Object.keys(this.mapping);
        for (let i = 0; i < files.length; i++) {
            let entry = this.mapping[files[i]];
            let result = entry.callback.apply(entry.target, [evt.text, evt]);

            if (result === true) return true;
        }
        return false;
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
        this.environment = {};

        /** @type {Object.<string,ActionEntry>} */
        this.inventory = {};
    } 

    /**
     * Bind an action defined by an object in the environment.
     * 
     * @param {string} verb The verb to invoke the action
     * @param {MUDObject} target The verb to invoke the action
     * @param {(text: string, evt:MUDInputEvent)=>boolean} callback The verb to invoke the action
     * @return {ActionBinder}
     */
    bindEnvironmentalAction(verb, target, callback) {
        if (verb in this.environment === false)
            this.environment[verb] = new ActionEntry(verb);
        this.environment[verb].addMapping(target, callback);
        return this;
    }

    /** 
     * Bind an action defined by an object in the player's inventory
     * 
     * @param {string} verb The verb to invoke the action
     * @param {MUDObject} target The verb to invoke the action
     * @param {(text: string, evt:MUDInputEvent)=>boolean} callback The verb to invoke the action
     * @return {ActionBinder}
     */
    bindInventoryAction(verb, target, callback) {
        if (verb in this.environment === false)
            this.inventory[verb] = new ActionEntry(verb);
        this.inventory[verb].addMapping(target, callback);
        return this;
    }

    /**
     * Get an environmental action entry
     * @param {string} verb The verb being invoked
     */
    getEnvironmentAction(verb) {
        return this.environment[verb];
    }

    /**
     * Get an environmental action entry
     * @param {string} verb The verb being invoked
     */
    getInventoryAction(verb) {
        return this.inventory[verb];
    }

    /**
     * Try and execute a command as an added action
     * @param {MUDInputEvent} evt The command to execute
     * @returns {boolean} Returns true on success
     */
    tryAction(evt) {
        let inv = this.getInventoryAction(evt.verb);
        let env = this.getEnvironmentAction(evt.verb);

        if (inv && inv.execute(evt))
            return true;
        else if (env && env.execute(evt))
            return true;
        else
            return false;
    }

    /** Unbinds all actions  */
    unbindActions() {

    }
}

module.exports = ActionBinder;
