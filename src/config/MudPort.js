
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
        this.port = parseInt(data.port);

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

module.exports = MudPort;
