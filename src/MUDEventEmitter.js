/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.callType
 * Date: October 1, 2017
 *
 * Description: Event emitter for in-game types
 */
const { ExecutionContext, CallOrigin } = require("./ExecutionContext");

class MUDEventEmitter {
    constructor() {
        /** @type {Object.<string,{ handleId: number, listener: function(string, ...args): number, onlyOnce: boolean}[]>} */
        this.events = {};
        this.#nextHandlerId = 1;
    }

    /**
     * Each handler receives a unique ID to allow easier removal
     * @type {number}
     */
    #nextHandlerId;

    addListener(eventName, listener, prepend = false, onlyOnce = false) {
        let eventListeners = this.events[eventName],
            listenerFunc = listener;

        if (!eventListeners) {
            eventListeners = this.events[eventName] = [];
        }

        if (this.isListening(eventName, listener))
            return true;

        let handleId = this.#getHandleId();

        prepend === true ?
            eventListeners.unshift({ handleId, listener: listenerFunc, onlyOnce }) :
            eventListeners.push({ handleId, listener: listenerFunc, onlyOnce });

        return handleId;
    }

    /**
     * Emit an event that listeners can detect and act on.
     * @param {ExecutionContext} ecc The callstack
     * @param {string} eventName The name of the event being fired.
     * @param {...any[]} args Arguments related to the event.
     */
    async emit(ecc, eventName, ...args) {
        const frame = ecc.push({ object: this, method: 'emit', file: this.filename || __filename, lineNumber: __line, isAsync: true, callType: CallOrigin.LocalCall });
        try {
            let event = this.events[eventName],
                handlesToRemove = [];

            if (event) {
                event = event.slice(0);
                for (let i = 0, max = event.length; i < max; i++) {
                    let listener = event[i].listener,
                        isAsync = driver.efuns.isAsync(listener),
                        result = undefined;

                    if (isAsync) {
                        result = await listener(...args);
                    }
                    else
                        result = listener(...args);

                    if (event[i].onlyOnce)
                        handlesToRemove.push(event[i].handleId);

                    // Check event state
                    if (typeof result === 'number') {
                        if ((result & EVENT_REMOVELISTENER) === EVENT_REMOVELISTENER)
                            event[i] = null;

                        if ((result & EVENT_STOP) === EVENT_STOP)
                            break;
                    }
                }
                handlesToRemove.forEach(id => this.removeListener(id));
                return true;
            }
            return false;
        }
        finally {
            frame?.pop();
        }
    }

    eventNames(ecc) {
        const frame = ecc.push({ file: __filename, method: 'eventNames', lineNumber: __line, isAsync: true, className: MUDEventEmitter, callType: CallOrigin.LocalCall });
        try {
            return Object.keys(this.events);
        }
        finally {
            frame.pop();
        }
    }

    #getHandleId() {
        return this.#nextHandlerId++;
    }

    #getListenerIndex(eventName, listener) {
        let event = this.events[eventName];
        if (typeof listener === 'function') {
            let index = event.findIndex(e => e.listener === listener);
            return index;
        }
        if (typeof listener === 'number') {
            let index = event.findIndex(e => e.handleId === listener);
            return index;
        }
        return -1;
    }

    isListening(ecc, eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'isListening', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.#getListenerIndex(eventName, listener) > -1;
        }
        finally {
            frame.pop();
        }
    }

    listeners(ecc, eventName) {
        const frame = ecc.push({ file: __filename, method: 'listeners', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return (this.events[eventName] || []).slice(0);
        }
        finally {
            frame.pop();
        }
    }

    off(ecc, eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'off', lineNumber: __line, isAsync: isAsync, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.removeListener(eventName, listener);
        }
        finally {
            frame.pop();
        }
    }

    on(ecc, eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'on', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.addListener(eventName, listener, false, false);
        }
        finally {
            frame.pop();
        }
    }

    once(ecc, eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'once', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.addListener(eventName, listener, false, true);
        }
        finally {
            frame.pop();
        }
    }

    prependListener(ecc, eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'prependListener', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.addListener(eventName, listener, true, false);
        }
        finally {
            frame.pop();
        }
    }

    prependOnceListener(ecc, eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'prependOnceListener', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.addListener(eventName, listener, true, true);
        }
        finally {
            frame.pop();
        }
    }

    rawListeners(eventName) {
        const frame = ecc.push({ file: __filename, method: 'rawListeners', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            return this.listeners(eventName);
        }
        finally {
            frame.pop();
        }
    }

    removeAllListeners(ecc, eventName = false) {
        const frame = ecc.push({ file: __filename, method: 'removeAllListeners', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            if (typeof eventName === 'string') {
                delete this.events[eventName];
                return this;
            }
            else if (eventName === false) {
                const types = this.eventNames(frame.branch());
                for (const et of types) {
                    this.removeAllListeners(frame.branch(), et);
                }
            }
        }
        finally {
            frame.pop();
        }
    }

    removeListener(eventName, listener) {
        const frame = ecc.push({ file: __filename, method: 'removeListener', lineNumber: __line, isAsync: false, className: MUDEventEmitter, callType: CallOrigin.CallOther });
        try {
            let event = this.events[eventName];
            if (event) {
                let index = this.#getListenerIndex(eventName, listener);
                if (index > -1) {
                    event.splice(index, 1);
                    if (event.length === 0) {
                        delete this.events[eventName];
                    }
                }
            }
            return true;
        }
        finally {
            frame.pop();
        }
    }
}

const
    EVENT_STOP = 1 << 20,
    EVENT_REMOVELISTENER = 1 << 21;

global.MUDEVENT_STOP = EVENT_STOP;
global.MUDEVENT_REMOVELISTENER = EVENT_REMOVELISTENER;

module.exports = MUDEventEmitter;
