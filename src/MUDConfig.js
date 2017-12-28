const
    bcrypt = require('bcrypt'),
    fs = require('fs'),
    path = require('path'),
    MUDData = require('./MUDData'),
    ErrorTypes = require('./ErrorTypes'),
    GameSetup = require('./setup/GameSetup'),
    NetUtil = require('./network/NetUtil');

const
    MudSection = require('./config/MudSection'),
    DriverSection = require('./config/DriverSection'),
    MudlibSection = require('./config/MudlibSection'),
    MUDPasswordPolicy = require('./config/MUDPasswordPolicy');

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
        this['mudlibSection'] = new MudlibSection(raw.mudlib);
        this['driverSection'] = new DriverSection(raw.driver);
        this['mudSection'] = new MudSection(raw.mud);

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

module.exports = new MUDConfig();
