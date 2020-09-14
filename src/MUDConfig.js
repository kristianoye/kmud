const
    GAMESTATE_STARTING = 1,
    GAMESTATE_INITIALIZING = 2,
    GAMESTATE_RUNNING = 3,
    GAMESTATE_SHUTDOWN = 4;

Error.stackTraceLimit = Infinity;
global.logger = require('./MUDLogger');

const
    fs = require('fs'),
    path = require('path'),
    ErrorTypes = require('./ErrorTypes'),
    MudSection = require('./config/MudSection'),
    DriverSection = require('./config/DriverSection'),
    MudlibSection = require('./config/MLibSection');

class MUDConfig {
    constructor() {
        if (configInstance) 
            throw new Error('Use MUDConfig.get() instead.');

        this.setupMode = false;
        this.singleUser = false;
        this.skipStartupScripts = false;

        var options = this.processCommandLine({
            configFile: path.resolve(__dirname, '../mudconfig.json')
        });
        let exists = fs.existsSync(options.configFile), raw = {};

        if (!this.setupMode && !exists)
            throw new ErrorTypes.MissingConfigError(`File ${options.configFile} not found!`);

        else if (exists) {
            raw = JSON.parse(this.stripBOM(fs.readFileSync(options.configFile, 'utf8')));
            if (typeof raw.mud !== 'object')
                throw new Error(`Config file '${options.configFile}' did not define section 'mud'`);
        }
        else {
            let baseConfig = path.resolve(__dirname, '../baseconfig.json');

            if (fs.existsSync(baseConfig)) {
                raw = JSON.parse(this.stripBOM(fs.readFileSync(baseConfig, 'utf8')));
            }
        }

        this.configFile = options.configFile || path.join(this.entryDirectory, 'mudconfig.json');

        this.mudlib = new MudlibSection(raw.mudlib || {});
        this.driver = new DriverSection(raw.driver || {});
        this.mud = new MudSection(raw.mud || {});

        if (this.setupMode) {
            const ConfigApp = require('./config/ConfigApp');

            let app = new ConfigApp(this, options);
            return app.start();
        }

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

    createDefaultConfig() {
        this.mudlibSection = MudlibSection
    }

    createExport() {
        let configExport = {
            mud: this.mud.createExport(),
            mudlib: Object.assign({}, this.mudlib),
            driver: Object.assign({}, this.driver)
        };

        return configExport;
    }

    createRunOnce(data) {
        fs.writeFileSync(path.resolve(__dirname, '../runOnce.json'), JSON.stringify(data), { flags: 'a', encoding: 'utf8' });
    }

    /** Returns the config singleton */
    static get() {
        return configInstance;
    }

    loadFallback() {

    }

    processCommandLine(options) {
        let isSwitch = /^(?:[-]{1,2}|[\/]{1})(.+)/,
            runSetup = false;

        for (let i = 1, max = process.argv.length; i < max; i++) {
            let arg = process.argv[i],
                m = isSwitch.exec(arg);

            if (m) {
                let opt = m[1].toLowerCase();

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
                        //this.runSetup = new GameSetup();
                        this.runSetup = true;
                        this.setupMode = true;
                        break;

                    case 'test':
                        this.runTests = true;
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
    
        return options;
    }

    /**
     * Read an arbitrary value from the configuration.
     * @param {string} key The value to read from the config.
     * @param {any} [defaultValue] The default value if the config is not found.
     * @returns {any} Returns the value or the default value.
     */
    readValue(key, defaultValue) {
        let path = key.split('.'), ptr = this;

        while (path.length) {
            let key = path.shift();
            ptr = ptr[key];
            if (!ptr) break;
        }
        return typeof ptr === 'undefined' || path.length ? defaultValue : ptr;
    }

    async run() {
        if (!this.setupMode) {
            this.assertValid();
            let gameDriverType = require('./GameServer');
            let gameMaster = new gameDriverType(this);

            gameMaster.enableGlobalErrorHandler(true);
            await gameMaster
                .run(() => {
                    logger.log('Done with startup');
                    if (this.runTests === true) {

                    }
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

/** @type {MUDConfig} */
var configInstance;

module.exports = MUDConfig;
