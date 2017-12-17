const
    fs = require('fs'),
    path = require('path'),
    MUDData = require('./MUDData'),
    ErrorTypes = require('./ErrorTypes'),
    GameSetup = require('./setup/GameSetup'),
    NetUtil = require('./network/NetUtil');

var
    nextComponentId = 1;

function resolvePath(p1, ext) {
    var p2 = path.join(__dirname, p1);
    return p2.endsWith(ext || '.js') ? p2 : p2 + (ext || '.js'); 
}

class MUDCompilerComponentConfig {
    constructor(data) {
        /** @type {string} */
        this.id = data.id || 'Component #' + nextComponentId;
        /** @type {string} */
        this.name = data.name || 'Unnamed Component #' + nextComponentId;
        /** @type {string} */
        this.file = data.file;
        /** @type {boolean} */
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

        if (!fs.existsSync(resolvePath(this.file = data.file)))
            throw new Error(`Component ${this.name} [id ${this.id}] has invalid filename: ${this.file}`);
        nextComponentId++;
    }
}

class MUDCompilerSection {
    constructor(data) {
        /** @type {string} */
        this.virtualMachine = data.virtualMachine || 'vm';
        /** @type {MUDCompilerComponentConfig[]} */
        this.components = Array.isArray(data.components) ?
            data.components.map(c => new MUDCompilerComponentConfig(c)) : [];
        /** @type {Object.<string,MUDCompilerLanguageSection>} */
        this.languages = {};
        Object.keys(data.languages).forEach(ext => {
            this.languages[ext] = new MUDCompilerLanguageSection(data.languages[ext], ext);
        });
        /** @type {Object.<string,MUDLoaderConfig>} */
        this.loaders = {};
        Object.keys(data.loaders).forEach(id => {
            this.loaders[id] = new MUDLoaderConfig(data.loaders[id], id);
        });
    }
}

class MUDCompilerLanguageSection {
    constructor(data, ext) {
        this.id = data.id;
        this.extension = ext;
        this.loader = data.loader || 'MUDLoader';
        this.name = data.name || 'Unknown Language';
        this.pipeline = data.pipeline;
    }
}

class MUDConfigPort {
    constructor(data) {
        this.address = typeof data.address === 'string' ? data.address : '0.0.0.0';
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;
        this.port = parseInt(data.port);
        this.type = data.type || 'http';
        this.wizardsOnly = typeof data.wizardsOnly === 'boolean' ? data.wizardsOnly : false;
        this.maxConnections = parseInt(data.maxConnections) || -1; // default to unlimited
    }
}

class MUDConfigSection {
    constructor(data) {
        this.name = data.name || 'Another KMUD';
        this.adminName = data.adminName || '[Unspecified]';
        this.adminEmail = data.adminEmail || '[Unspecified]';

        /** @type {Object.<string,boolean>} */
        this.features = data.features || {};

        /** @type {MUDConfigPort[]} */
        this.portBindings = data.portBindings.map(p => new MUDConfigPort(p));
    }
}

class MUDDriverConfigSection {
    constructor(data) {
        /** @type {string} */
        this.core = data.core;

        /** @type {boolean} */
        this.useObjectProxies = typeof data.useObjectProxies === 'boolean' ? data.useObjectProxies : true;

        /** @type {boolean} */
        this.useRevocableProxies = typeof data.useRevocableProxies === 'boolean' ? data.useRevocableProxies : false;

        /** @type {string} */
        this.objectCreationMethod = typeof data.objectCreationMethod === 'string' ? data.objectCreationMethod : 'inline';
        if (['inline', 'thinWrapper', 'fullWrapper'].indexOf(this.objectCreationMethod) === -1) {
            throw new Error(`Invalid setting for driver.objectCreationMethod: Got ${data.objectCreationMethod} [valid values: inline, thinWrapper, fullWrapper`);
        }

        /** @type {MUDCompilerSection} */
        this.compiler = new MUDCompilerSection(data.compiler);

        /** @type {MUDNetworkingSection} */
        this.networking = new MUDNetworkingSection(data.networking);
    }

    assertValid() {
        this.networking.assertValid();
        return this;
    }
}

class MUDLibConfigSection {
    constructor(data) {

        /** @type {Object.<string,string>} */
        this.applyNames = data.applyNames;

        this.base = data.base;
        this.heartbeatInterval = parseInt(data.heartbeatInterval) || 1000;
        this.includePath = Array.isArray(data.includePath) ? data.includePath : [];
        /** @type {MUDMasterObjectConfig} */
        this.inGameMaster = new MUDMasterObjectConfig(data.inGameMaster);
        this.logDirectory = data.logDirectory || '/log';
        this.loginObject = data.loginObject;
        this.simulEfuns = data.simulEfuns || false;
    }
}

class MUDLoaderConfig {
    constructor(data, id) {
        this.enabled = true;
        this.id = id;
        this.name = data.name;
        this.file = data.file;
    }

    assertValid() {
        if (!this.name)
            throw new Error(`Loader with ID ${this.id} did not specify a name.`);
        if (!this.id)
            throw new Error(`Loader with name ${this.name} did not specify an ID.`);
        if (!fs.existsSync(resolvePath(this.file)))
            throw new Error(`Failed to locate specified loader: ${this.file}`);
    }
}

class MUDMasterObjectConfig {
    constructor(data) {
        this.path = data.path;
        this.parameters = data.parameters || {};
    }
}

class MUDNetworkingEndpointConfig {
    constructor(data, protoIndex, protocol) {
        /** @type {boolean} */
        this.enabled = typeof data.enabled === 'boolean' ? data.enabled : true;

        /** @type {string} */
        this.protocol = protocol;

        /** @type {MUDNetworkingEndpointHandlerConfig|boolean} */
        this.default = false;

        /** @type {MUDNetworkingEndpointHandlerConfig[]} */
        this.handlers = data.handlers.map((handlerData, handlerIndex) => {
            var handler = new MUDNetworkingEndpointHandlerConfig(handlerData, protoIndex, handlerIndex, protocol);
            if (handler.default) {
                if (this.default !== false)
                    throw new Error(`Protocol at position ${protoIndex} has specified multiple default handlers.`);
                this.default = handler;
            }
            return handler;
        });
    }

    assertValid() {
        if (!this.protocol)
            throw new Error(`Protocol at position ${protoIndex} must specify a protocol parameter (e.g. http)`);
        if (this.handlers.length === 0)
            throw new Error(`Protocol ${this.protocol} at position ${protoIndex} did not specify any handlers!`);
        this.handlers.forEach(handler => handler.assertValid());
    }

    /**
     * 
     * @param {string} id The ID of required handler.
     * @returns {MUDNetworkingEndpointHandlerConfig} The handler
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

class MUDNetworkingEndpointHandlerConfig {
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
        if (!resolvePath(this.file))
            new Error(`Endpoint handler with name ${this.name} [position ${this.handlerIndex}] for protocol ${this.protocol} points to non-existant file: ${this.file}`);
        if (typeof this.type === 'string' && !this.type.match(/^\w+$/)) {
            new Error(`Endpoint handler with name ${this.name} [position ${this.handlerIndex}] for protocol ${this.protocol} has invalid type specifier: ${this.type}`);
        }
    }
}

class MUDNetworkingEndpointsSection {
    constructor(data) {
        /** @type {Object.<string,MUDNetworkingEndpointConfig>} */
        this.protocols = {};
        Object.keys(data).forEach((protocol, index) => {
            if (!protocol.match(/^(?:http[s]*|telnet)$/i)) {
                throw new Error(`Unknown network protocol type specified in config at index ${index}: ${protocol}`);
            }
            this.protocols[protocol] = new MUDNetworkingEndpointConfig(data[protocol], index, protocol.toLowerCase());
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
     * @returns {MUDNetworkingEndpointConfig} Information for the specified protocol.
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

class MUDNetworkingSection {
    constructor(data) {
        this.endpoints = new MUDNetworkingEndpointsSection(data.endpoints);
    }

    assertValid() {
        this.endpoints.assertValid();
    }
}

function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}

class MUDConfig {
    constructor() {
        this.singleUser = false;

        var options = this.processCommandLine({
            configFile: path.resolve(__dirname, '../mudconfig.json')
        });
        let exists = fs.existsSync(options.configFile),
            raw = {};

        if (!this.setupMode && !exists)
            throw new ErrorTypes.MissingConfigError(`File ${options.configFile} not found!`);
        else if (exists) {
            raw = JSON.parse(fs.readFileSync(options.configFile));
        }
        else {
            raw = JSON.parse(stripBOM(fs.readFileSync(path.resolve(__dirname, './setup/BaseConfig.json'), 'utf8')));
        }
        this.configFile = options.configFile;
        this['mudlibSection'] = new MUDLibConfigSection(raw.mudlib);
        this['driverSection'] = new MUDDriverConfigSection(raw.driver);
        this['mudSection'] = new MUDConfigSection(raw.mud);

        if (this.singleUser === true) {
            this.mud.features.intermud = false;
            this.mud.portBindings.forEach(binding => binding.address = '127.0.0.1');
        }

        MUDData.Config = this;
    }

    assertConfig(path, val, callback) {
        if (this.readValue(path) === val) {
            if (typeof callback === 'function') callback();
        }
    }

    assertValid() {
        this.driver.assertValid();
        return this;
    }

    /**
     * @returns {MUDDriverConfigSection} The driver section from the config.
     */
    get driver() {
        return this['driverSection'];
    }

    loadFallback() {

    }

    /**
     * @returns {MUDConfigSection} The mud section from the config.
     */
    get mud() {
        return this['mudSection'];
    }

    /**
     * @returns {MUDLibConfigSection} The mudlib section from the config.
     */
    get mudlib() {
        return this['mudlibSection'];
    }

    processCommandLine(options) {
        var isSwitch = /^(?:[-]{1,2}|[\/]{1})(.+)/,
            runSetup = false;

        for (var i = 1, max = process.argv.length; i < max; i++) {
            var arg = process.argv[i],
                m = isSwitch.exec(arg);

            if (m) {
                var opt = m[1].toLowerCase();
                switch (opt) {
                    case 'config':
                        if (typeof (options.configFile = process.argv[++i]) !== 'string') {
                            throw new Error(`KMUD: Option ${arg} is missing parameter [filename]`);
                        }
                        console.log(`Using config file ${options.configFile}`);
                        break;

                    case 'help':
                        this.showHelp(-4);
                        break;

                    case 'setup':
                        console.log('Running setup...');
                        this.runSetup = new GameSetup();
                        this.setupMode = true;
                        break;

                    case 'single-user':
                        this.singleUser = true;
                        break;
                }
            }
        }
        if (this.setupMode) this.runSetup.runSetup(options);
        return options;
    }

    /**
     * 
     * @param {string} key The value to read from the config.
     */
    readValue(key, defaultValue) {
        let path = key.split('.'),
            ptr = this;

        while (path.length) {
            let key = path.shift();
            ptr = ptr[key];
        }
        return typeof ptr === 'undefined' ? defaultValue : ptr;
    }

    showHelp(exit) {
        console.log(`
Usage: server.js [options]

Where options include:
    --config [config file]
        Specify an alternate location to the MUD configuration file.

    --setup
        Run setup mode to pick common MUD options.

    --single-user
        Run the MUD in "single user" mode.  This will disable any of the
        external network interfaces and only allow traffic from the loopback
        interface (localhost).  External sockets will also be disabled.

    --wizLock
        Start the MUD in wizard lock mode.  Normal players will not be 
        allowed to connect.
`.trim() + '\n');
        process.exit(exit);
    }
}

module.exports = {
    MUDConfig: new MUDConfig(),
    MUDConfigPort: MUDConfigPort
};
