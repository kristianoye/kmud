const
    ConfigUtil = require('../ConfigUtil');

class DriverNetworkingEndpointHandlerConfig {
    constructor(data, protoIndex, handlerIndex, protocol) {
        /** @type {boolean} */
        this.default = typeof data.default === "boolean" ? data.default : false;

        /** @type {number} */
        this.handlerIndex = handlerIndex;

        /** @type {string} */
        this.protocol = protocol;

        /** @type {number} */
        this.protocolIndex = protoIndex;

        /** @type {string} */
        this.file = data.file;

        /** @type {string} */
        this.id = data.id;

        /** @type {string} */
        this.name = data.name;

        /** @type {Object.<string,boolean>} */
        this.options = data.options || {};

        /** @type {string|boolean} */
        this.type = data.type || false;
    }

    assertValid() {
        if (!this.name)
            new Error(`Endpoint handler for protocol ${this.protocol} at position ${this.handlerIndex} has no name.`);
        if (!this.id)
            new Error(`Endpoint handler with name ${this.name} [position ${this.handlerIndex}] for protocol ${this.protocol} has no id.`);
        if (!this.file)
            new Error(`Endpoint handler with name ${this.name} [position ${this.handlerIndex}] for protocol ${this.protocol} has no module file specified.`);
        if (!ConfigUtil.resolvePath(this.file))
            new Error(`Endpoint handler with name ${this.name} [position ${this.handlerIndex}] for protocol ${this.protocol} points to non-existant file: ${this.file}`);
        if (typeof this.type === 'string' && !this.type.match(/^\w+$/)) {
            new Error(`Endpoint handler with name ${this.name} [position ${this.handlerIndex}] for protocol ${this.protocol} has invalid type specifier: ${this.type}`);
        }
    }
}

class DriverNetworkingEndpointConfig {
    /**
     * 
     * @param {Object} data
     * @param {number} protoIndex
     * @param {string} protocol
     */
    constructor(data, protoIndex, protocol) {
        /** @type {boolean} */
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

        /** @type {number} */
        this.maxCommandLength = data.maxCommandLength || 512;

        /** @type {string} */
        this.protocol = protocol;

        /** @type {DriverNetworkingEndpointHandlerConfig|boolean} */
        this.default = false;

        /** @type {DriverNetworkingEndpointHandlerConfig[]} */
        this.handlers = data.handlers.map((handlerData, handlerIndex) => {
            var handler = new DriverNetworkingEndpointHandlerConfig(handlerData, protoIndex, handlerIndex, protocol);
            if (handler.default) {
                if (this.default !== false)
                    throw new Error(`Protocol at position ${protoIndex} has specified multiple default handlers.`);
                this.default = handler;
            }
            return handler;
        });

        /** @type {number} */
        this.protoIndex = protoIndex;
    }

    assertValid() {
        if (!this.protocol)
            throw new Error(`Protocol at position ${this.protoIndex} must specify a protocol parameter (e.g. http)`);
        if (this.handlers.length === 0)
            throw new Error(`Protocol ${this.protocol} at position ${this.protoIndex} did not specify any handlers!`);
        this.handlers.forEach(handler => handler.assertValid());
    }

    /**
     * 
     * @param {string} id The ID of required handler.
     * @returns {DriverNetworkingEndpointHandlerConfig} The handler
     */
    getHandler(id) {
        if (typeof id !== 'string' || id.length === 0) {
            if (this.default === false)
                throw new Error(`getHandler() request for protocol "${this.protocol}" failed; No id requested and no default specified.`);
            return this.default;
        }
        var handler = this.handlers.filter(handler => handler.id === id);
        if (handler.length === 0)
            throw new Error(`getHandler() request for protocol "${this.protocol}" failed; Handler ID ${id} was not found.`);
        else if (handler.length > 1)
            throw new Error(`getHandler() request for protocol "${this.protocol}" failed; Handler ID ${id} was ambiguous.`);
        return handlers[0];
    }
}

class DriverNetworkingEndpointsConfig {
    constructor(data) {
        /** @type {Object.<string,DriverNetworkingEndpointConfig>} */
        this.protocols = {};
        Object.keys(data).forEach((protocol, index) => {
            if (!protocol.match(/^(?:http[s]*|telnet)$/i)) {
                throw new Error(`Unknown network protocol type specified in config at index ${index}: ${protocol}`);
            }
            this.protocols[protocol] = new DriverNetworkingEndpointConfig(data[protocol], index, protocol.toLowerCase());
        });
    }

    assertValid() {
        Object.keys(this.protocols).forEach(protocol => {
            this.protocols[protocol].assertValid();
        });
    }

    /**
     * 
     * @param {string} protocol The name of the protocol requested.
     * @returns {DriverNetworkingEndpointConfig} Information for the specified protocol.
     */
    getEndpointConfig(protocol) {
        if (typeof protocol !== 'string' || protocol.length === 0)
            throw new Error('Bad request to MUDNetworkingEndpointsSection.getEndpointConfig(); Requires non-zero length string.');
        var protocolConfig = this.protocols[protocol] || false;
        if (protocolConfig === false)
            throw new Error(`No such protocol defined in configuration: ${protocol}`);
        else if (!protocolConfig.enabled)
            throw new Error(`Protocol ${protocolConfig.protocol} is not enabled.`);
        return protocolConfig;
    }
}

class DriverNetworking {
    constructor(data) {
        this.endpoints = new DriverNetworkingEndpointsConfig(data.endpoints);
    }

    assertValid() {
        this.endpoints.assertValid();
    }
}

module.exports = {
    DriverNetworking,
    DriverNetworkingEndpointConfig,
    DriverNetworkingEndpointsConfig,
    DriverNetworkingEndpointHandlerConfig
};
