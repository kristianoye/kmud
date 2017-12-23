
class MUDEventEmitter {
    constructor() {
        this.events = {};
    }

    addListener(eventName, listener, prepend, onlyOnce) {
        let event = this.events[eventName],
            listenerFunc, self = this;

        if (!event) {
            event = this.events[eventName] = [];
        }
        listenerFunc = onlyOnce === true ?
            function () {
                let index = event.indexOf(listener);
                event[index] = null;
                return listener.apply(self, arguments);
            } : listener;
        prepend === true ? event.unshift(listenerFunc) : event.push(listenerFunc);
        return this;
    }

    emit(eventName, ...args) {
        let event = this.events[eventName];
        if (event) {
            for (let i = 0, max = event.length; i < max; i++) {
                let listener = event[i],
                    result = typeof listener === 'object' ?
                        listener.processEvent(this, eventName, ...args) :
                        listener.apply(this, args);

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
