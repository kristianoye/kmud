const
    Extensions = require('./Extensions'),
    GAMESTATE_STARTING = 1,
    GAMESTATE_INITIALIZING = 2,
    GAMESTATE_RUNNING = 3,
    GAMESTATE_SHUTDOWN = 4;

Error.stackTraceLimit = Infinity;

const
    MUDLogger = require('./MUDLogger'),
    MUDGlobals = require('./MUDGlobals');

const
    bcrypt = require('bcrypt'),
    fs = require('fs'),
    path = require('path'),
    ErrorTypes = require('./ErrorTypes'),
    GameSetup = require('./setup/GameSetup');

const
    MudSection = require('./config/MudSection'),
    DriverSection = require('./config/DriverSection'),
    MudlibSection = require('./config/MudlibSection'),
    MUDPasswordPolicy = require('./config/MUDPasswordPolicy');

var
    configInstance = false;

class MUDConfig {
    constructor() {
        if (configInstance) {
            throw new Error('Use MUDConfig.get() instead.');
        }
        /** @type {boolean} */
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
            raw = JSON.parse(this.stripBOM(fs.readFileSync(options.configFile, 'utf8')));
        }
        else {
            raw = JSON.parse(this.stripBOM(fs.readFileSync(path.resolve(__dirname, './setup/BaseConfig.json'), 'utf8')));
        }
        this.configFile = options.configFile;
        this['mudlibSection'] = new MudlibSection(raw.mudlib);
        this['driverSection'] = new DriverSection(raw.driver);
        this['mudSection'] = new MudSection(raw.mud);

        if (this.singleUser === true) {
            this.mud.features.intermud = false;
            this.mud.portBindings.forEach(binding => binding.address = '127.0.0.1');
        }
    }

    assertConfig(path, val, callback) {
        if (this.readValue(path) === val) {
            if (typeof callback === 'function') callback();
        }
    }

    assertValid() {
        this.driver.assertValid();
        this.mud.assertValid();
        this.mudlib.assertValid();
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
     * @returns {MudSection} The mud section from the config.
     */
    get mud() {
        return this['mudSection'];
    }

    /**
     * @returns {MudlibSection} The mudlib section from the config.
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
                        logger.log(`Using config file ${options.configFile}`);
                        break;

                    case 'help':
                        this.showHelp(-4);
                        break;

                    case 'setup':
                        logger.log('Running setup...');
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

    run() {
        if (!this.setupMode) {
            this.assertValid();
            let gameDriverType = require('./GameServer');
            let gameMaster = new gameDriverType(this);

            /** @type {GameServer} The game server instance */
            gameMaster
                .setLoginObject('/sys/lib/Login')
                .enableGlobalErrorHandler(true)
                .run(() => {
                    logger.log('Done with startup');
                });
        }
    }

    stripBOM(s) {
        return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
    }

    showHelp(exit) {
        logger.log(`
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

/**
 * Returns the active instance of the config.
 * @returns {MUDConfig}
 */
MUDConfig.get = function () {
    return configInstance;
};

/**
 * Strip off the utf8 byte order mark if it exists.
 * @param {string} s A string.
 * @returns {string} The string without the BOM. */
MUDConfig.stripBOM = function (s) {
    return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

/**
 * Indicates the game is starting but has not begun to initialize
 * @type {number}  */
MUDConfig.GAMESTATE_STARTING = global.GAMESTATE_STARTING = GAMESTATE_STARTING;

/**
 * The game driver is initiating the runtime environment and preparing to run.
 * @type {number} */
MUDConfig.GAMESTATE_INITIALIZING = global.GAMESTATE_INITIALIZING = GAMESTATE_INITIALIZING;
/**
 * The game driver is running mode and able to load objects and enforce security.
 * @type {number} */
MUDConfig.GAMESTATE_RUNNING = global.GAMESTATE_RUNNING = GAMESTATE_RUNNING;
/**
 * The game is shutting down.  No new objects should be created.
 * @type {number} */
MUDConfig.GAMESTATE_SHUTDOWN = global.GAMESTATE_SHUTDOWN = GAMESTATE_SHUTDOWN;

module.exports = MUDConfig;

