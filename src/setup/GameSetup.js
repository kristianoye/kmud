/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    readline = require('readline'),
    fs = require('fs'),
    path = require('path'),
    con = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    }),
    configPath = path.join('./', 'mudconfig.json'),
    MudSectionSetup = require('./MudSectionSetup');


function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}

class GameSetup {
    constructor() {
        var self = this;

        this.config = {};
        this.console = con;
        this.options = {};
        this.sections = [];
    }

    /**
     * Write a config value 
     * @param {any} key The key of the value to set
     * @param {any} newValue The new value associated with the key.
     */
    assignValue(key, newValue) {
        var ptr = this.config, parts = key.split('.');
        while (parts.length) {
            ptr = ptr[parts.shift()];
            if (parts.length === 1) {
                ptr[parts[0]] = newValue;
                break;
            }
        }
    }

    /**
     * @returns {boolean} Returns true if the config file exists.
     */
    get configExists() {
        return fs.existsSync(configPath);
    }

    /**
     * Get a value from the current configuration data.
     * @param {string} key Setting to pull from current config
     * @param {any} defaultValue The default value should the key not be found.
     * @returns {any} The value if found or defaultValue if not foundf.
     */
    getCurrentValue(key, defaultValue) {
        var ptr = this.config, result = defaultValue, parts = key.split('.');
        while (parts.length) {
            ptr = ptr[parts.shift()];
            if (!ptr) return defaultValue;
        }
        return ptr;
    }

    finalize() {
        this.console.write('\nSetup complete.\n');

        this.console.question(`\n\nWrite settings to file '${this.options.configFile}'? [yn]`, resp => {
            if (!resp.match(/^[yn]/i))
                this.finalize();
            else {
                if (resp.charAt(0).toLowerCase() === 'y') {
                    fs.writeFileSync(this.options.configFile, JSON.stringify(this.config, null, 3));
                }
                con.write('\nExiting\n');
                process.exit(-3);
            }
        });
    }

    nextSection() {
        if (this.sections.length === 0)
            this.finalize();
        else
            this.sections[0].runSection(() => {
                this.sections.shift();
                this.nextSection();
            });
    }

    runSetup(options) {
        this.options = options;

        if (!options.configFile) {
            options.configFile = 'mudconfig.json';
        }
        if (!this.configExists) {
            this.config  = JSON.parse(stripBOM(fs.readFileSync(path.resolve(__dirname, './BaseConfig.json'), 'utf8')));
        }
        else {
            this.config  = JSON.parse(stripBOM(fs.readFileSync(path.resolve(__dirname, '../../', options.configFile), 'utf8')));
        }
        this.sections = [
            new MudSectionSetup(this)
        ];
        return this.nextSection();
    }
}

module.exports = GameSetup;
