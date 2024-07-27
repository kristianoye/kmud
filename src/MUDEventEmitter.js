
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
     * @param {string} eventName The name of the event being fired.
     * @param {...any[]} args Arguments related to the event.
     */
    async emit(eventName, ...args) {
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

    eventNames() {
        return Object.keys(this.events);
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

    isListening(eventName, listener) {
        return this.#getListenerIndex(eventName, listener) > -1;
    }

    listeners(eventName) {
        return (this.events[eventName] || []).slice(0);
    }

    off(eventName, listener) {
        return this.removeListener(eventName, listener);
    }

    on(eventName, listener) {
        return this.addListener(eventName, listener, false, false);
    }

    once(eventName, listener) {
        return this.addListener(eventName, listener, false, true);
    }

    prependListener(eventName, listener) {
        return this.addListener(eventName, listener, true, false);
    }

    prependOnceListener(eventName, listener) {
        return this.addListener(eventName, listener, true, true);
    }

    rawListeners(eventName) {
        return this.listeners(eventName);
    }

    removeAllListeners(eventName) {
        delete this.events[eventName];
        return this;
    }

    removeListener(eventName, listener) {
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
}

const
    EVENT_STOP = 1 << 20,
    EVENT_REMOVELISTENER = 1 << 21;

global.MUDEVENT_STOP = EVENT_STOP;
global.MUDEVENT_REMOVELISTENER = EVENT_REMOVELISTENER;

module.exports = MUDEventEmitter;
