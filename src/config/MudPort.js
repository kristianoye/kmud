
const
    path = require('path');

class MudPort {
    constructor(data) {
        /** @type {string} */
        this.address = typeof data.address === 'string' ? data.address : '0.0.0.0';

        /** @type {boolean} */
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

        /** @type {Object.<string,boolean>} */
        this.options = data.options || {};

        /** @type {number} */
        this.port = parseInt(data.port) || 8000 + Math.floor(Math.random() * 1000) + 1;

        /** @type {string} */
        this.type = data.type || 'http';

        /** @type {boolean} */
        this.wizardsOnly = typeof data.wizardsOnly === 'boolean' ? data.wizardsOnly : false;

        /** @type {number} */
        this.maxConnections = parseInt(data.maxConnections) || -1; // default to unlimited


        let defaultClient = this.type === 'http' ?
                './src/network/clients/http/HTTPClientInstance' :
                './src/network/clients/telnet/RanvierTelnetInstance';
        /** @type {string} */
        this.client = path.resolve(data.client || defaultClient);

        /** @type {string} */
        let defaultServer = this.type === 'http' ?
                './src/network/clients/http/HTTPClientEndpoint' :
                './src/network/clients/telnet/RanvierTelnetEndpoint';
        this.server = path.resolve(data.server || defaultServer);
    }

    static createDefaults() {
        return [new MudPort({
            address: '0.0.0.0',
            enabled: true,
            port: 8000,
            maxConnections: 50,
            wizardsOnly: false
        })];
    }

    /**
     * Determine if the port object is a default
     * @param {MudPort} mudport
     */
    static isDefault(mudport) {
        return (
            mudport.address === '0.0.0.0' &&
            mudport.enabled === true &&
            mudport.port === 8000 &&
            mudport.maxConnections === 50 &&
            mudport.wizardsOnly === false);
    }

    createExport() {
        return {
            address: this.address,
            client: this.client,
            enabled: this.enabled,
            options: this.options,
            maxConnections: this.maxConnections,
            port: this.port,
            server: this.server,
            type: this.type,
            wizardsOnly: this.wizardsOnly
        };
    }

    assertValid(index) {
        if (typeof this.port !== 'number')
            throw new Error(`Invalid setting for port entry #${index}; Value must be numeric and not ${typeof index}`);
        if (paseInt(this.port) !== this.port)
            throw new Error(`Invalid setting for port entry #${index}; Value must be integer [${parseInt(this.port)} vs ${this.port}]`);
        if (this.port < 1 || this.port > 65535)
            throw new Error(`Invalid port setting for entry #${index}; Value must be between 1 and 65535 and not ${this.port}`);
    }

    /**
     * Merge options from protocol section.
     * @param {Object.<string,boolean>} options
     */
    mergeOptions(options) {
        Object.keys(options).forEach(opt => {
            let exists = opt in this.options;
            if (!exists) {
                this.options[opt] = options[opt];
            }
        });
        return this;
    }
}

/**
 * Configure a single port
 * @param {MudPort} mudport
 */
MudPort.createDialog = function (mudport) {
    const Dialog = require('../Dialog');
    let dlg = new Dialog.MainMenu({
        prompt: 'MUD Port Menu',
        text: 'Use this menu to configure details of one, specific port.',
        help: 'This menu allows you to configure the ports, protocols, and options associated with each client port.'
    });

    dlg.add({
        text: () => `Set Port Address [${mudport.address}]`,
        char: 'a',
        control: new Dialog.SimplePrompt({
            question: () => `Port Number [${mudport.address}]: `,
            defaultValue: () => mudport.address,
            type: 'string'
        }),
        callback: (address) => {
            mudport.address = address;
        }
    });

    dlg.add({
        text: () => `Set Client Type [${mudport.type}; ${mudport.client}]`,
        char: 't',
        control: new Dialog.SimplePrompt({
            question: () => {
                return '\r\n\r\nSelect binding type:\r\n\r\n' +
                    '\t1) Telnet\r\n' +
                    '\t2) Basic HTTP\r\n' +
                    '\t3) Desktop HTTP\r\n\r\n' +
                `Client  [${mudport.client}]: `;
            },
            defaultValue: () => mudport.client,
            type: (resp) => {
                switch (resp.trim()) {
                    case '1':
                        mudport.type = 'telnet';
                        mudport.client = path.resolve(__dirname, '../network/clients/telnet/RanvierTelnetInstance');
                        mudport.server = path.resolve(__dirname, '../network/clients/telnet/RanvierTelnetEndpoint');
                        return true;

                    case '2':
                        mudport.type = 'http';
                        mudport.client = path.resolve(__dirname, './src/network/clients/http/HTTPClientInstance');
                        mudport.server = path.resolve(__dirname, './src/network/clients/http/HTTPClientEndpoint');
                        return true;

                    case '3':
                        mudport.type = 'http';
                        mudport.client = path.resolve(__dirname, './src/network/clients/desktop/DesktopClient');
                        mudport.server = path.resolve(__dirname, './src/network/clients/desktop/DesktopServer');
                        return true;

                    default:
                        return undefined;
                }
            }
        }),
        callback: (validResponse) => {
            return validResponse;
        }
    });

    dlg.add({
        text: () => `Set Max Connections [${mudport.maxConnections}]`,
        char: 'x',
        control: new Dialog.SimplePrompt({
            question: () => `Max Connections [${mudport.maxConnections}; 0=Unlimited]: `,
            defaultValue: () => mudport.maxConnections,
            min: 0,
            type: 'number'
        }),
        callback: (maxConnections) => {
            mudport.maxConnections = maxConnections;
        }
    });

    dlg.add({
        text: () => `Enable Port [${mudport.enabled}]`,
        char: 'e',
        control: new Dialog.SimplePrompt({
            question: () => `Enable Port [${mudport.enabled}]: `,
            defaultValue: () => mudport.address,
            type: 'string'
        }),
        callback: (enabled) => {
            mudport.enabled = enabled !== 'false';
        }
    });

    dlg.add({
        text: () => `Wizards Only [${mudport.wizardsOnly}]`,
        char: 'w',
        control: new Dialog.SimplePrompt({
            question: () => `Enable Wizards Only [${mudport.wizardsOnly}]: `,
            defaultValue: () => mudport.wizardsOnly,
            type: 'string'
        }),
        callback: (wizardsOnly) => {
            mudport.wizardsOnly = wizardsOnly !== 'false';
        }
    });

    dlg.add({
        text: () => `Set Port Number [${mudport.port}]`,
        char: 'p',
        control: new Dialog.SimplePrompt({
            question: () => `Port Number [${mudport.port}]: `,
            defaultValue: () => mudport.port,
            type: 'number',
            min: 22,
            max: 65000
        }),
        callback: (portNumber) => {
            mudport.port = portNumber;
        }
    });

    dlg.add({
        text: 'Return to Port Menu',
        char: 'm',
        callback: () => {
            Dialog.writeLine('Returning to Port Menu');
            return Dialog.DlgResult.OK;
        }
    });

    return dlg;
};

/**
 * Create UI to manage the port bindings.
 * @param {MudPort[]} ports The existing collection of port bindings.
 */
MudPort.createConfigUI = function (ports) {
    const Dialog = require('../Dialog');
    let dlg = new Dialog.MainMenu({
        prompt: 'MUD Ports',
        text: 'Use this menu to manage the TCP ports that players and wizards connect to the MUD.',
        help: 'This menu allows you to configure the ports, protocols, and options associated with each client port.'
    });

    dlg.getOptions = () => {
        dlg.options = {};

        for (let i = 0; i < ports.length; i++) {
            let p = ports[i];

            dlg.add({
                char: `#${p.type}://${p.address}:${p.port}`,
                text: `Port ${p.type}://${p.address}:${p.port}`,
                control: MudPort.createDialog(p)
            });
        }

        dlg.add({
            text: 'Add Port',
            char: 'a',
            callback: () => {
                ports.push(new MudPort({}));
            }
        });

        dlg.add({
            text: 'Delete Port',
            char: 'd',
            callback: () => {
            }
        });

        dlg.add({
            text: 'Return to MUD Menu',
            char: 'm',
            callback: () => {
                Dialog.writeLine('Returning to MUD Menu');
                return Dialog.DlgResult.OK;
            }
        });
    };


    return dlg;
};

module.exports = MudPort;
