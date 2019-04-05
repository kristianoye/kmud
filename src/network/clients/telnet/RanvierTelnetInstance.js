/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */

const
    ClientInstance = require('../../ClientInstance'),
    ClientCaps = require('../../ClientCaps'),
    uuidv1 = require('uuid/v1');

class RanvierTelnetInstance extends ClientInstance {
    constructor(endpoint, client) {
        super(endpoint, client, client.remoteAddress);

        this.caps = new ClientCaps(this);

        let mainWindow = this.mainWindow = ClientInstance.registerComponent(this, {
            type: 'MainWindow',
            attachTo: 'newLogin',
            id: uuidv1(),
            requiresShell: true
        });
        this.client.on('data', (buffer) => {
            this.emit('kmud', {
                type: 'input',
                data: buffer.toString('utf8'),
                origin: mainWindow.id
            });
        });
        this.client.on('close', () => this.remoteDisconnect());
        this.client.on('drain', () => this.emit('drain'));
        this.closed = false;
        this.client.on('kmud', event => this.emit('kmud', event));
        this.client.on('window size', evt => {
            this.emit('kmud', {
                type: 'windowSize',
                data: evt
            });
        });
    }

    eventSend(event) {
        switch (event.type) {
            case 'clearScreen':
                this.write("%^INITTERM%^");
                break;

            case 'connected':
                this.writeLine(`Connected to ${event.data}`);
                break;

            case 'prompt':
                this.renderPrompt(event.data);
                break;

            case 'write':
                this.write(event.data);
                break;

            default:
                break;
        }
    }

    /*
     *  Programatically disconnect the client from the server.
     */
    close() {
        this.writeLine('Good-bye!');
        this.closed = true;
        this.client.end();
    }

    displayPrompt(evt) {
        if (this.inputStack.length === 0 && evt.prompt) {
            this.write(evt.prompt.text);
        }
        else if (this.inputStack.length === 1) {
            this.renderPrompt(this.inputStack[0]);
        }
    }

    transmit(buffer) {
        if (!this.closed) this.client.transmit(buffer);
    }

    get writable() {
        return !this.closed && this.client.writable;
    }

    write(text) {
        if (!this.closed) {
            text = this.caps.html.renderHtml(text);
            text = this.caps.color.expandColors(text);
            return this.client.write(text);
        }
        return false;
    }

    /**
     * Render a line of text to the client.
     * @param {string} text The text to render on the client.
     */
    writeLine(text) {
        this.write(!efuns.text.trailingNewline(text) ?
            text + efuns.eol : text);
    }
}

module.exports = RanvierTelnetInstance;
