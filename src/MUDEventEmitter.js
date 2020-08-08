
class MUDEventEmitter {
    constructor() {
        /** @type {Object.<string,Function>} */
        this.events = {};
    }

    addListener(eventName, listener, prepend = false, onlyOnce = false) {
        let eventListeners = this.events[eventName],
            listenerFunc = listener, self = this;

        if (!eventListeners) {
            eventListeners = this.events[eventName] = [];
        }
        if (onlyOnce === true) {
            listenerFunc = () => {
                let index = eventListeners.indexOf(listener),
                    args = [].slice.call(arguments);
                eventListeners[index] = null;
                return listener(...args);
            };
        }
        prepend === true ?
            eventListeners.unshift(listenerFunc) :
            eventListeners.push(listenerFunc);
        return this;
    }

    /**
     * Emit an event that listeners can detect and act on.
     * @param {string} eventName The name of the event being fired.
     * @param {...any[]} args Arguments related to the event.
     */
    emit(eventName, ...args) {
        let event = this.events[eventName];
        if (event) {
            for (let i = 0, max = event.length; i < max; i++) {
                let listener = event[i],
                    isAsync = listener.toString().startsWith('async '),
                    result = undefined;

                if (isAsync) {
                    setImmediate(async () => await listener(...args));
                    continue;
                }
                listener(...args); // listener.apply(this, args);

                // Check event state
                if (typeof result === 'number') {
                    if ((result & EVENT_REMOVELISTENER) === EVENT_REMOVELISTENER)
                        event[i] = null;

                    if ((result & EVENT_STOP) === EVENT_STOP)
                        break;
                }
            }
            event = this.events[eventName] = event.filter(l => l !== null);
            if (event.length === 0) delete this.events[eventName];
            return true;
        }
        return false;
    }

    eventNames() {
        return Object.keys(this.events);
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

    removeAllListeners(eventName) {
        delete this.events[eventName];
        return this;
    }

    removeListener(eventName, listener) {
        let event = this.events[eventName];
        if (event) {
            let index = event.indexOf(listener);
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
