﻿/// <reference path="ansi/TerminalColorAnsi.js" />

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
        let myType = this.constructor.prototype;
        Object.getOwnPropertyNames(myType)
            .slice(1).forEach(fn => {
                if (fn === 'registerMethods' || fn === 'updateFlags')
                    return;
                else if (typeof myType[fn] === 'function')
                    methods[fn] = this;
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

ClientImplementation.create = function (caps, flags, methods) {
    /**
     * @type {ClientImplementation[]} 
     */
    let components = [];
    switch (caps.terminalType) {
        case 'ansi':
            components.push(
                require('./ansi/TerminalColorAnsi'),
                require('./MudHtmlImplementation'));
            break;

        case 'cmud':
            components.push(
                require('./zmud/TerminalColorZmud'),
                require('./zmud/ZmudHtmlSupport'),
                require('./zmud/ZmudExitSupport'));
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
        let impl = new comp(caps);
        impl.updateFlags(flags)
            .registerMethods(methods)
            .init();
    });
};

module.exports = ClientImplementation;
