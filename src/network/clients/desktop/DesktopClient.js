/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Desktop client
 */

const
    ClientInstance = require('../../ClientInstance'),
    ClientCaps = require('../../ClientCaps'),
    MUDHtml = require('../../../MUDHtml');

class DesktopClient extends ClientInstance {
    constructor(endpoint, client) {
        super(endpoint, client, client.conn.remoteAddress);
        this.eventQueue = [];
        this.eventTimer = false;
        this.windows = {};

        client.on('disconnect', () => this.remoteDisconnect());
        client.on('kmud', async evt => await this.receiveEvent(evt));

        this.emit('kmud', {
            type: 'terminalType',
            data: 'kmud'
        });
        this.caps = new ClientCaps(this);
    }

    get clientProtocol() { return 'http'; }

    get clientType() { return 'html'; }

    close(reason) {
        this.eventSend({
            type: 'disconnect',
            data: reason || '[No Reason Given]'
        });
        this.client.disconnect();
    }

    createAuthToken(event) {
        let token = this.endpoint.createAuthToken(event.data.username, event.data.password);
        if (token)
            return Object.assign(event, { data: token });
        return false;
    }

    get defaultTerminalType() { return 'kmud'; }

    /**
     * Keep sending events until they are none left
     */
    dispatchEvents() {
        try {
            this.client.emit('kmud', this.eventQueue.shift());
        }
        catch (ex) {

        }
        finally {
            if (this.eventQueue.length > 0 && this.eventTimer === false) {
                this.eventTimer = setTimeout(() => {
                    try {
                        this.dispatchEvents();
                    }
                    finally {
                        this.eventTimer = false;
                    }
                }, 1);
            }
        }
    }

    /**
     * Send an event to the client
     * @param {{ type: string, data: any, target: string }} event
     */
    eventSend(event) {
        if (event.data instanceof MUDHtml.MUDHtmlComponent) {
            event.data = event.data.render();
        }
        let eventOut = Object.assign({
            type: 'write',
            target: 'MainWindow',
        }, event);

        this.eventQueue.push(eventOut);
        this.dispatchEvents();
    }

    /**
     * Receive an event from the client
     * @param {{ type: string, data: any, target: string }} event
     */
    async receiveEvent(event) {
        try {
            switch (event.type) {
                case 'windowDelete':
                    {
                        let index = this.components.findIndex(v => v.id === event.data);
                        this.components[index].remoteDisconnect('disconnected');
                    }
                    break;

                case 'windowRegister':
                    ClientInstance.registerComponent(this, event.data);
                    break;

                default:
                    this.emit('kmud', event);
                    break;
            }
        }
        catch (err) {
        }
    }

    toggleEcho(echoOn = true) {
        this.eventSend({
            type: 'enableEncho',
            target: 'MainWindow',
            data: echoOn
        });
        return this.echoEnabled = echoOn;
    }

    /**
     * Write some text to the client
     * @param {any} text
     */
    write(text) {
        let test = this.caps.do('expandColors', text);
        this.eventSend({ type: 'write', data: text });
        return this;
    }

    /**
     * Write a line of text to the client.
     * @param {any} text
     */
    writeLine(text) {
        this.eventSend({ type: 'writeLine', data: text });
        return this;
    }

}

module.exports = DesktopClient;
