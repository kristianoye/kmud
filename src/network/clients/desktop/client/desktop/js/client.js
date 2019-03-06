/// <reference path="jquery-3.3.1.js" />
/// <reference path="ventus.js" />

/** @typedef {{ type: string, data: any, target: string|string[]|boolean }} MUDEvent */


const { BaseComponent, DesktopClientClass } = (function (Ventus) {
    'use strict';

    const
        _windowManager = new Ventus.WindowManager(),
        SessionCookie = '_sess';

    var
        _components = [],
        _componentById = {},
        _connected = false,
        _eventData = {},
        _windowTypes = {},
        _webSocket = false;

    class EventData {
        /**
         * Construct a new event instance
         * @param {EventSenderPrivateData} owner The object that owns this event.
         * @param {string} type The type of event being represented.
         */
        constructor(owner, type) {
            this.owner = owner;
            this.type = type;

            /** @type {{ handler: function(...any), onlyOnce: boolean }[]} */
            this.listeners = [];
        }

        addListener(handler, onlyOnce = false, prepend = false) {
            return this.listeners[prepend ? 'unshift' : 'push']({
                handler,
                onlyOnce
            });
        }

        compact() {
            this.listeners = this.listeners.filter(l => !!l);
            if (this.length === 0)
                this.owner.removeEvent(this);
        }

        emit(...args) {
            for (let i = 0, m = this.listeners.length; i < m; i++) {
                let listener = this.listeners[i];
                try {
                    if (listener) {
                        let result = listener.handler(...args);

                        if (listener.onlyOnce === true)
                            this.listeners[i] = undefined;

                        if (result === 1)
                            this.listeners[i] = undefined;
                        else if (result === 2)
                            break;
                    }
                }
                catch (err) {
                    console.log('emit error', err);
                }
            }
            this.compact();
        }

        get length() {
            return this.listeners.length;
        }

        /**
         * Remove an event listener
         * @param {any} handler
         */
        removeListener(handler) {
            let handlerId = this.listeners
                .map(l => l.handler)
                .indexOf(handler);

            if (handlerId > 0) {
                this.listeners[handlerId] = undefined;
                this.compact();
                return true;
            }
            return false;
        }
    }

    class EventSenderPrivateData {
        constructor() {
            /** @type {Object.<string,EventData>} */
            this.events = {};
        }

        addListener(type, handler, onlyOnce = false, prepend = false) {
            let event = this.get(type, true);
            return event.addListener(handler, onlyOnce, prepend);
        }

        emit(type, ...args) {
            let event = this.get(type);
            if (event)  event.emit(...args);
        }

        /**
         * Get the 
         * @param {any} type
         */
        get(type, createIfMissing = false) {
            let result = this.events.hasOwnProperty(type) ? this.events[type] : false;
            if (result === false && createIfMissing === true) {
                result = this.events[type] = new EventData(this, type);
            }
            return result;
        }

        removeListener(type, handler) {
            let event = this.get(type);
            return !!event && event.removeListener(handler);
        }

        removeEvent(type) {
            delete this.events[type];
            return true;
        }
    }

    /**
     * Fetch the private data store for a component.
     * @param {EventSender} ob The event sender to fetch a store for
     * @returns {EventSenderPrivateData} A private data instance
     */
    EventSenderPrivateData.get = function (ob) {
        if (_eventData.hasOwnProperty(ob.id))
            return _eventData[ob.id];
        return _eventData[ob.id] = new EventSenderPrivateData();
    }

    class EventSender {
        constructor() {
            Object.defineProperty(this, 'id', {
                value: uuidv1(),
                writable: false,
                enumerable: false
            });
        }

        /**
         * Emit a particular event to all listenes
         * @param {string} type The event type
         * @param {...any} args Arguments to go with the event
         */
        emit(type, ...args) {
            let store = EventSenderPrivateData.get(this);
            
            if (store) {
                return store.emit(type, ...args);
            }
        }

        /**
         * Returns true if the passed id is a match for this component.
         * @param {string|string[]} id The class name or UUID to match on.
         */
        match(id) {
            if (Array.isArray(id)) {
                return id.filter(i => this.match(i)).length > 0;
            }
            else if (typeof id === 'string')
                return this.id === id || this.constructor.name === id;
            else if (id === true) // Match all
                return true;
            else
                return false;
        }

        off(type, handler) {
            return EventSenderPrivateData.get(this).removeListener(type, handler);
        }

        on(type, handler, prepend = false) {
            return EventSenderPrivateData.get(this).addListener(type, handler, false, prepend);
        }

        once(type, handler, prepend = false) {
            return EventSenderPrivateData.get(this).addListener(type, handler, true, prepend);
        }
    }

    class BaseComponent extends EventSender {
        /**
         * 
         * @param {DesktopClientClass} client The client who owns this component
         * @param {Ventus.Window} window The window this component will enhabit
         * @param {Object.<string,string>} options Options used to construct this component instance
         */
        constructor(client, window, options = {}) {
            super();

            Object.defineProperties(this, {
                $content: {
                    get: () => $(window.$content.el)
                },
                $titlebar: {
                    get: () => $(window.$titlebar.el)
                },
                client: {
                    value: client,
                    writable: false
                },
                window: {
                    value: window,
                    writable: false
                }
            });

            client.on('kmud', event => {
                try {
                    console.log('Component received event', event);
                    if (this.match(event.target)) {
                        let handler = 'on' + event.type.charAt(0).toUpperCase() + event.type.slice(1);

                        if (typeof this[handler] === 'function')
                            return this[handler].call(this, event);
                    }
                }
                catch (err) {

                }
            });
        }

        /**
         * The server has suggested a window hint
         * @param {MUDEvent} event The event data
         */
        onWindowHint(event) {

        }

        setTitle(s) {
            this.window.$titlebar.find('h1').el.textContent = s;
        }
    }

    class MainWindow extends BaseComponent {
        constructor(desktop, window, options = {}) {
            super(desktop, window, options);

            this.mudName = 'Unknown MUD';
            this.setTitle(`${this.mudName} - Connected`);
            this.connected = true;
        }

        onConnect() {
            this.connected = true;
            this.setTitle(`${this.mudName} - Connected`);
        }

        onConnected(event) {
            this.connected = true;
            this.mudName = event.data;
            this.setTitle(`${this.mudName} - ${this.connected ? 'Connected' : 'Disconnected'}`);
        }

        onDisconnect() {
            this.connected = false;
            this.setTitle(`${this.mudName} - Disconnected`);
        }
    }

    /**
     * 
     * @param {DesktopClientClass} desktop The client
     * @param {Object.<string,any>} options The initial options
     */
    MainWindow.createWindowOptions = function (desktop, options = {}) {
        let deskSize = desktop.desktopSize;
        return options = Object.assign({
            animations: false,
            title: 'Main Window',
            classname: 'MainWindow',
            x: deskSize.width / 4,
            y: deskSize.height / 4,
            stayinspace: true,
            width: deskSize.width / 2,
            height: deskSize.height / 2
        }, options);
    };
    
    class DesktopClientClass extends EventSender {
        /**
         * Construct a new client
         * @param {string} url The base URL of the MUD to connect to
         */
        constructor(url) {
            super();

            this.baseUrl = url;
            this.sessionCookie = '';

            if (navigator.cookieEnabled) {
                let sessionId = this.cookies[SessionCookie];
            }
            this.defineWindowType(MainWindow);
        }

        /**
         * Adds a cookie 
         * @param {any} key
         * @param {any} value
         * @param {any} maxAge
         * @param {any} expires
         */
        addCookie(key, value, maxAge = false, expires = false) {
            let values = [`${key}=${value}`];

            if (typeof maxAge === 'number' && maxAge > 0)
                values.push(`;max-age=${maxAge}`);

            if (expires)
                values.push(`;expires=${expires}`);

            document.cookie = values.join('');
        }

        /** 
         * Returns the current cookie collection
         * @type {Object.<string, string>} */
        get cookies() {
            let cookies = {};
            document.cookie.split('; ').forEach(ch => {
                let [key, value] = ch.split('=', 2);
                cookies[key] = value;
            });
            return cookies;
        }

        /**
         * Connect to the remote MUD
         */
        connect() {
            _webSocket = io({
                transportOptions: {
                    polling: {
                        extraHeaders: {
                            'X-Mud-Client': 'KMUD v1.0'
                        },
                    }
                },
                transports: ['websocket']
            });

            _webSocket.on('connect', () => {
                _connected = true;

                //  Only create a new window if we have to
                if (this.getComponentOfType('MainWindow').length === 0)
                    this.createWindow('MainWindow');

                this.emit('kmud', { type: 'connect', target: true });
            });

            _webSocket.on('disconnect', () => {
                _connected = false;
                this.emit('kmud', { type: 'disconnect', target: true });
            });

            _webSocket.on('kmud', evt => this.emit('kmud', evt));
            return this;
        }

        /**
         * Is the client connected?
         * @type {boolean}
         */
        get connected() {
            return _connected;
        }

        /**
         * Create a new window on the desktop and register it with the server.
         * @param {string} type The type of window/component to create
         * @param {Object.<string,any>} options Creation options
         * @returns {DesktopClientClass} Returns the client.
         */
        createWindow(type, options = {}) {
            if (typeof type === 'object') {
                options = Object.assign(type, options);
                type = options.type;
            }
            let targetType = _windowTypes[type] || false;

            if (typeof targetType !== 'function')
                throw new Error('DesktopClientClass could not find suitable window type');

            if (typeof targetType.createWindowOptions === 'function')
                options = targetType.createWindowOptions(this, options);

            options.windowId = uuidv1();

            let window = _windowManager.createWindow(options),
                component = new targetType(this, window, options);

            _components.push(component);
            _componentById[options.windowId] = component;


            _webSocket.emit('kmud', { type: 'windowRegister', data: [options.windowIdm, type] });
            component.on('kmud', event => {
                _webSocket.emit('kmud', event);
            });

            window.open();

            return this;
        }

        /**
         * Define a new window type
         * @param {any} type
         * @returns {DesktopClientClass} Returns the client.
         */
        defineWindowType(type) {
            _windowTypes[type.name] = type;
            return this;
        }

        /** @type {{ height: number, width: number }} */
        get desktopSize() {
            return { height: $(window).height(), width: $(window).width() };
        }

        /**
         * Get all the components of a specific type.
         * @param {any} nameOrType
         */
        getComponentOfType(nameOrType) {
            if (nameOrType === 'function') nameOrType = nameOrType.name;
            return _components.filter(c => c.constructor.name === nameOrType);
        }

        /**
         * Get a reference to the window manager
         */
        get windowManager() {
            return _windowManager;
        }
    }

    return { BaseComponent, DesktopClientClass };
})(Ventus);
