﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 20, 2019
 *
 * Description: Server side representation of a remote client component.
 */

const CommandShell = require('./CommandShell');

const
    events = require('events'),
    ComponentData = {};

/**
 * Returns the component storage.
 * @param {ClientComponent} arg The component to get data for
 * @returns {Object.<string,any>} The component data.
 */
function $(arg) {
    if (arg.id in ComponentData === false)
        throw new Error('Component is invalid!  [It was probably destructed]');
    return ComponentData[arg.id];
}

class ClientComponent extends events.EventEmitter {
    /**
     * Constructs a new client component
     * @param {ClientInstance} client The client this component is registered with
     * @param {Object.<string,any>} options Options and flags indicating what the component is capable of.
     */
    constructor(client, options = {}) {
        super();

        if (!options.id)
            throw new Error('ClientComponent requires parameter id');
        else if (!client)
            throw new Error('ClientComponent requires parameter client');

        this.#client = client;
        this.#id = options.id;

        if (typeof this.id !== 'string' || this.id.length < 10)
            throw new Error('Invalid component ID');

        if (client.addComponent(this)) {
            ComponentData[this.id] = Object.assign({
                shell: false,
                attachTo: false,
                requiresShell: false
            }, options);

            client.on('kmud', /** @param {MUDEvent} event */ event => {
                if (this.matchId(event.origin)) {
                    switch (event.type) {
                        case 'input':
                            this.emit('data', event.data);
                            break;
                    }
                }
            });
        }
    }

    attachShell(shell) {
        if (this.requiresShell) {
            // TODO: Disconnect old shell if exists?
            this.#shell = shell;
            return shell;
        }
        return false;
    }

    get attachTo() {
        return $(this).attachTo || false;
    }

    get body() {
        return $(this).body || false;
    }

    set body(body) {
        $(this).body = body;
    }

    get caps() {
        return $(this).caps || this.client.caps;
    }

    /** @type {ClientInstance} */
    #client;

    /** @type {ClientInstance} */
    get client() {
        return this.#client;
    }

    //  Something in the game told the remote client to delete this component.
    localDisconnect(reason) {
        return this.client.eventSend(Object.assign({
            target: this.id,
            type: 'disconnect',
            data: reason || 'None given'
        }));
    }

    // Indicates the remote client disconnected the component (maybe by closing the window)
    // In this case we trigger netdeath but leave the shell in place in case the client comes back.
    remoteDisconnect(reason) {
        this.emit('remoteDisconnect', reason);
    }

    /**
     * The unique GUID of this component
     * @type {string} */
    #id;

    /** @type {string} */
    get id() {
        return this.#id;
    }

    matchId(id) {
        return this.id === id || $(this).type === id;
    }

    /**
     * Does this component serve a particular role?
     * @param {any} role
     */
    matchRole(role) {
        return this.roles.indexOf(role) > -1;
    }

    /**
     * Release the component; It is no longer needed.
     */
    release() {
        delete ComponentData[this.id];
    }

    /**
     * Does this component require a command shell?
     * @type {boolean}
     */
    get requiresShell() {
        return $(this).requiresShell === true;
    }

    /**
     * What roles does this component serve?
     * @type {string[]}
     */
    get roles() {
        let rolls = $(this).roles || [];
        return Array.isArray(rolls) ? rolls.slice(0) : [];
    }

    /**
     * Send an event through the client
     * @param {MUDEvent} event The event to send to the client.
     */
    eventSend(event) {
        switch (event.type) {
            case 'windowAuth':
                {
                    event = this.client.createAuthToken(event);
                    if (!event)
                        return;
                }
                break;
        }
        return this.client.eventSend(Object.assign({
            target: this.id
        }, event));
    }

    /**
     * Get the remote address of the component (client)
     */
    get remoteAddress() {
        return this.client.remoteAddress;
    }

    /**
     * Render a prompt for the client
     * @param {{ type: string, text: string }} input
     */
    renderPrompt(input) {
        return this.client.eventSend({
            type: 'prompt',
            data: input,
            target: this.id
        });
    }

    /** 
     * @type {CommandShell}
     */
    #shell;

    /**
     * Return the shell object associated with this component (if any)
     */
    get shell() {
        return this.#shell || false;
    }

    get storage() {
        return $(this).storage || false;
    }

    set storage(storage) {
        $(this).storage = storage;
    }

    get writable() {
        return true;
    }

    write(textOrBuffer) {
        let caps = this.caps;

        let colorized = this.caps.do('expandColors', textOrBuffer) || textOrBuffer;
        return this.client.eventSend({
            type: 'write',
            data: colorized,
            target: this.id
        });
    }

    writeLine(textOrBuffer) {
        if (!textOrBuffer.endsWith(efuns.eol))
            textOrBuffer = textOrBuffer + efuns.eol;
        return this.write(textOrBuffer);
    }

    /**
     * Get a component by unique ID
     * @param {string} id The GUID/UUID of the component to find
     * @returns {ClientComponent}
     */
    static getComponentById(id) {
        if (id in ComponentData)
            return ComponentData[id];
        else
            return false;
    }
}

module.exports = ClientComponent;
