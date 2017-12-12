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
    configPath = path.join('./', 'mudconfig.json');

class GameSetup {
    get configExists() {
        this.config = {};
        return fs.existsSync(configPath);
    }

    getAdminEmail() {
        con.question('\nMUD Administrator\'s Email [Not Specified]: ', txt => {
            this.config.AdminEmail = txt.trim() || 'Not Specified]';
            con.write('Writing file... ');
            fs.writeFileSync(configPath, JSON.stringify(this.config, undefined, 3));
            con.write('Done.\n');
            process.exit(0);
        });
    }

    getAdminName() {
        con.question('\nMUD Administrator\'s Name [Not Specified]:', txt => {
            this.config.AdminName = txt.trim() || 'Not Specified';
            return this.getAdminEmail();
        })
    }

    getName() {
        con.question('\nName of your MUD [Another KMUD]: ', txt => {
            this.config.MudName = txt.trim() || 'Another KMUD';
            if (this.config.MudName.length < 3)
                con.write('That name is too short.');
            else if (this.config.MudName.length > 60)
                con.write('That name is too long.');
            else
                return this.getAdminName();
            this.getName();
        });
    }

    start() {
        if (!this.configExists) {
            con.write('File ' + configPath + ' does not exist...\n');
            con.write('\nIt looks like you are running your MUD for the first time\n');
            con.question('Would you like to set it up now? [y/N] ', txt => {
                var resp = txt.toLowerCase();
                if (resp.startsWith('n')) {
                    con.write('Good-bye then...\n');
                    process.exit();
                }
                else if (resp.startsWith('y')) {
                    this.getName();
                }
                else {
                    this.start();
                }
            });
        }
    }
}


var setup = module.exports = new GameSetup();

setup.start();
