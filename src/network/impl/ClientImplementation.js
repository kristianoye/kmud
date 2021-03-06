﻿const
    SkippedExports = ['registerMethods', 'updateFlags', 'constructor'];

class ClientImplementation {
    constructor(caps) {
        this.caps = caps;
        this.client = caps.client;
    }

    /**
     * Initialize the implementation.
     */
    init() { }

    /**
     * Allows the implementation to enumerate the methods available.
     * @param {Object.<string,object>} methods
     * @returns {ClientImplementation} A reference to the implementation.
     */
    registerMethods(methods) {
        let myType = this.constructor.prototype, self = this;

        Object.getOwnPropertyNames(myType)
            .forEach(fn => {
                if (SkippedExports.indexOf(fn) === -1 && typeof myType[fn] === 'function') {
                    methods[fn] = function() {
                        return self[fn].apply(self, arguments);
                    };
                }
            });

        return this;
    }

    /**
     * Updates the cap flags to let the mudlib know what features are available.
     * @param {Object.<string,boolean>} caps 
     */
    updateFlags(caps) {
        return this;
    }
}

ClientImplementation.create = function (caps, /** @type {Object.<string,boolean>} */ flags, /** @type {Object.<string,function>} */ methods, /** @type {string[]} */ interfaces) {
    /**
     * @type {ClientImplementation[]} 
     */
    let components = [];
    switch (caps.terminalType) {
        case 'ansi':
        case 'linux':
        case 'vt100':
            components.push(
                require('./ansi/TerminalColorAnsi'),
                require('./MudHtmlImplementation'));
            break;

        case 'cmud':
            components.push(
                require('./zmud/MXPSupport'),
                require('./zmud/TerminalColorZmud'),
                require('./zmud/ZmudHtmlSupport'),
                require('./zmud/MXPRoomSupport'));
            break;

        case 'kmud':
            components.push(
                require('./kmud/KmudColorSupport'),
                require('./kmud/KmudHtmlSupport'),
                require('./kmud/KmudSoundSupport'),
                require('./kmud/KmudVideoSupport'));
            break;

        case 'xterm':
            components.push(
                require('./MudHtmlImplementation'),
                require('./xterm/TerminalColorXterm'));
            break;

        case 'zmud':
            components.push(
                require('./ansi/TerminalColorAnsi'),
                require('./zmud/ZmudExitSupport'));
            break;

        default:
            components.push(
                require('./MudColorImplementation'),
                require('./MudHtmlImplementation'));
            break;
    }
    components.forEach(comp => {
        /**
         *  @type {ClientImplementation}
         */
        let impl = new comp(caps),
            iface = comp.__proto__ && comp.__proto__.name !== 'ClientImplementation' ? comp.__proto__.name : comp.name;

        impl.updateFlags(flags)
            .registerMethods(methods)
            .init();

        if (iface) interfaces.push(iface);
    });
};

module.exports = ClientImplementation;
