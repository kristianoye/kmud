const
    bcrypt = require('bcrypt'),
    fs = require('fs'),
    path = require('path'),
    MUDData = require('./MUDData'),
    ErrorTypes = require('./ErrorTypes'),
    GameSetup = require('./setup/GameSetup'),
    NetUtil = require('./network/NetUtil');

const
    DriverSection = require('./config/DriverSection'),
    MUDPasswordPolicy = require('./config/MUDPasswordPolicy');

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

        /** @type {MUDPasswordPolicy} */
        this.passwordPolicy = new MUDPasswordPolicy(data.passwordPolicy || { minLength: 5 });

        /** @type {MUDConfigPort[]} */
        this.portBindings = data.portBindings.map(p => new MUDConfigPort(p));
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

class MUDConfig {
    constructor() {
        this.singleUser = false;
        /** @type {boolean} */
        this.skipStartupScripts = false;

        var options = this.processCommandLine({
            configFile: path.resolve(__dirname, '../mudconfig.json')
        });
        let exists = fs.existsSync(options.configFile),
            raw = {};

        if (!this.setupMode && !exists)
            throw new ErrorTypes.MissingConfigError(`File ${options.configFile} not found!`);
        else if (exists) {
            raw = JSON.parse(MUDData.StripBOM(fs.readFileSync(options.configFile, 'utf8')));
        }
        else {
            raw = JSON.parse(MUDData.StripBOM(fs.readFileSync(path.resolve(__dirname, './setup/BaseConfig.json'), 'utf8')));
        }
        this.configFile = options.configFile;
        this['mudlibSection'] = new MUDLibConfigSection(raw.mudlib);
        this['driverSection'] = new DriverSection(raw.driver);
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

    createRunOnce(data) {
        fs.writeFileSync(path.resolve(__dirname, '../runOnce.json'), JSON.stringify(data), { flags: 'a', encoding: 'utf8' });
    }

    /**
     * @returns {DriverSection} The driver section from the config.
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

                    case 'skip-startup-scripts':
                        this.skipStartupScripts = true;
                        break;

                    case 'single-user':
                        this.singleUser = true;
                        break;
                }
            }
        }
        if (this.setupMode) this.runSetup.runSetup(options, this);
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

    --skip-startup-scripts
        Skips any startup scripts (e.g. runOnce scripts).

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
