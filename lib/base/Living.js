/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import Body from './Body';
import { COMMAND_D, EMOTE_D } from '@Daemon';
import { DIR_CMDS_PLAYER, DIR_CMDS_COMMON } from '@Dirs';

/** @typedef {'strength'|'constitution'|'dexterity'|'intelligence'|'wisdom'|'charisma'} StatName */
/** @typedef {'combat'|'language'|'magic'|'crafting'|'survival'} SkillCategory */
/** @typedef {{category:SkillCategory, max:number, level:number, rate:number, points:number}} Skill */

const
    ShellFlags = system.flags.shell.ShellFlags,
    ValidSkillCategories = [
        'combat',
        'language',
        'magic',
        'crafting',
        'survival'
    ],
    ValidStats = [
        'strength',
        'dexterity',
        'constitution',
        'intelligence',
        'wisdom',
        'charisma'
    ];

export default class Living extends Body {
    override create() {
        super.create();
        this.addSkill('common', 'language', 100);
        this.addSkill('basic melee', 'combat', 1, 25);
        this.setStat({
            strength: 1,
            constitution: 1,
            dexterity: 1,
            intelligence: 1,
            wisdom: 1,
            charisma: 1
        });
    }

    async postCreate() {
        let keyId = this.keyId;

        if (keyId) {
            efuns.living.enableLiving(keyId);
            efuns.living.setLivingName(keyId);
        }
    }

    //#region Environment

    protected get $environment() {
        return get({
            COLUMNS: 80,
            LINES:  24,
            ERRORCOLOR: 'RED',
            TERM: 'text'
        });
    }

    protected set $environment(vars) {
        if (typeof vars === 'object')
            set(vars);
    }

    /**
     * Exports the user's shell variables
     */
    exportEnv() {
        return { ...this.$environment };
    }

    /**
     * Get an environmental variable
     * @param {string} name The name of the variable to fetch
     * @param {any} defaultValue The default value if the value does not exist
     */
    getEnv(name, defaultValue) {
        let env = this.$environment;
        let val = env[name], result = val;
        if (val) {
            if (typeof val === 'function') {
                result = val();
            }
            return result || defaultValue || '';
        }
        return defaultValue || '';
    }

    protected async eventHeartbeat(length) {
        await this.emit('eventHeartbeat');
    }

    setEnv(varName, value) {
        let env = this.$environment,
            curEnv = env;
        if (typeof varName === 'object') {
            for (const [key, val] of Object.entries(varName)) {
                this.setEnv(key, val);
            }
        }
        if (typeof varName === 'string') {
            if (typeof value === 'undefined')
                delete env[varName];
            else {
                let parts = varName.split('.');

                if (parts.length > 1) {
                    varName = parts.pop();
                    for (let i = 0; i < parts.length; i++) {
                        let part = parts[i];

                        if (part in curEnv)
                            curEnv = curEnv[part];
                        else {
                            curEnv[part] = {};
                            curEnv = curEnv[part];
                        }
                    }
                }
                curEnv[varName] = value;
            }
            this.$environment = env;
            return value;
        }
    }

    protected override setKeyId(id) {
        if (typeof id === 'string') {
            super.setKeyId(id);
            efuns.living.setLivingName(id);
            efuns.living.enableLiving(true);
            efuns.living.enableHeartbeat(true);
        }
    }

    //#endregion

    /**
     * Adds a skill to this being
     * @param {string} name The name of the skill
     * @param {SkillCategory} category The skill category
     * @param {number} level The initial skill level
     * @param {number} max The initial skill max level
     * @param {number} rate
     */
    addSkill(name, category, level = 1, max = 5, rate = 3, points = 0) {
        if (String.notEmpty(name) && String.notEmpty(category)) {
            if (ValidSkillCategories.indexOf(category) > -1) {
                let skills = this.skills;

                if (name in skills === false) {
                    if (level > max)
                        max = level;

                    let skill = {
                        category,
                        level,
                        max,
                        rate,
                        points
                    };
                    skills[name] = skill;
                }
            }
        }
        return this;
    }

    /**
     * Adds usage points to a player's particular skill.
     * @param {string} skillName The name of the skill being exercised.
     * @param {number} points The number of usage points gained.
     */
    addSkillPoints(skillName, points = 0) {
        let skill = this.skills[skillName];

        if (typeof skill === 'object') {
            while (points > 0) {
                let cost = Math.pow(skill.level, skill.rate);

                if ((skill.points += points) > cost) {
                    //  Boo... no more gains for you
                    if (skill.level == skill.max) {
                        skill.points = cost;
                        points = 0;
                    }
                    else {
                        //  How many points are left over?
                        points = skill.points - cost;
                        skill.level++;
                        skill.points = 0;
                        this.receiveMessage('write', `You are now more proficient in ${skillName}`);
                    }
                }
            }
            return { ...skill };
        }
        return undefined;
    }

    /**
     * This driver apply is expected to return an object that describes:
     *   (1) What shell features to enable,
     *   (2) What (if any) environment variables are set,
     *   (3) What (if any) command aliases are set,
     *   (4) If the verb does not appear to be a verb this should return false
     *   
     * @param {string} verb An optional verb to consider
     * @param {CommandShellOptions} options
     * @returns {CommandShellOptions}
     */
    protected async getShellSettings(verb, options) {
        if (verb) {
            let cmd = await COMMAND_D->resolveAsync(verb, this.searchPath, this.getShellOption('allowpartialverb'));
            if (cmd) {
                if (Array.isArray(cmd)) {
                    let options = cmd.map(c => c.primaryVerb).join(' ');
                    return errorLine(`Ambiguous command: ${verb}: Could be: ${options}`);
                }
                let cmdOpts = {};
                if (typeof cmd.getShellSettings === 'function')
                    cmdOpts = await cmd.getShellSettings(verb, options) || {};

                options = Object.assign(options, cmdOpts, {
                    cwd: this.workingDirectory || '/',
                    variables: Object.assign({}, this.$environment || {}, options.variables),
                    history: this.history || []
                });

                if (typeof this.modifyShellSettings === 'function')
                    this.modifyShellSettings(verb, options);

                return options;
            }
            let emote = EMOTE_D->validVerbTarget(verb);
            if (emote)
                return { allowEnvironment: true, allowLineSpanning: true };
        }
        return Object.assign(options, {
            aliases: this.aliases || {},
            cwd: this.workingDirectory || '/',
            expandAliases: this.aliases && true,
            expandVariables: false,
            history: Array.isArray(this.history) && this.history || [],
            variables: this.$environment || {}
        });
    }

    protected isInternalCommand(verb) {
        return false;
    }

    /**
     * Can the object be forced to perform the specified command.
     * @param {any} liv
     * @param {any} command
     */
    directForceLivingToString(liv, command) {
        return true;
    }

    /**
     * Can the object perform the specified emote verb?
     * @param {any} verb
     * @param {any} rule
     */
    directVerbRule(verb, rule) {
        return EMOTE_D->validVerbTarget(verb, this);
    }

    directTellObjectInWordString(target, lang, msg) {
        var lang = this.getLanguage(lang);
        if (!lang || lang.level === 0)
            return 'You do not know how to speak ' + lang;
        return true;
    }

    directTellObjectString(target, msg) {
        return true;
    }

    /**
     * Change the object's environment
     * @param {any} verb
     * @param {any} direction
     * @param {any} destination
     */
    async eventMoveAsync(verb, direction, destination) {
        if (!await this.moveObjectAsync(destination))
            return false;
        else {
            let pverb = efuns.pluralize(verb);
            writeLine(this.environment.onGetDescription(this));
            this.tellEnvironment(this.displayName + ' ' + pverb + ' in.');
            return writeLine(`You ${verb} ${direction}`);
        }
    }

    /**
     * Dispatch a command
     * @param {MUDInputEvent} evt
     */
    protected async executeCommand(evt) {
        let cmdObj = false,
            cmdResult = undefined;

        if ((cmdObj = await COMMAND_D->resolveAsync(evt.verb, this.searchPath, this.getShellOption('allowpartialverb')))) {
            /** @type {function} */
            let method = evt.htmlEnabled && typeof cmdObj.webcmd === 'function' ?
                'webcmd' : 'cmd';

            if (efuns.isAsync(cmdObj[method]))
                return await cmdObj[method](evt.text, evt)
                    .catch(err => {
                        if (err.message && efuns.living.isWizard(this)) {
                            efuns.errorLine(`Error: ${err.message}`);
                            if (err.stack) efuns.errorLine(err.stack);
                        }
                        else
                            efuns.errorLine('An error occurred.');
                    });

            else
                return cmdObj[method](evt.text, evt);
        }
        else if ((cmdResult = await EMOTE_D->cmd(evt.verb, evt.args, evt)))
            return cmdResult;
        else
            return `What? (Command '${evt.verb}' not recognized)`;
    }

    /**
     * Returns all skills in a particular category.
     * @param {string} catName The category to fetch
     */
    getCategorySkills(catName) {
        let skills = this.skills;
        return Object.keys(skills)
            .filter(skillName => skills[skillName].category === catName)
            .sort((a, b) => a.localeCompare(b));
    }

    /**
     * Fetch information about the proficiency in a given language.
     * @param {string} lang
     */
    getLanguage(lang) {
        let skills = this.skills,
            skill = skills[lang];
        if (skill && skill.category === 'language')
            return skill;
        return false;
    }

    protected getShellOption(name) {
        return false;
    }

    /**
     * Get information about a particular skill
     * @param {string} skillName
     * @returns {Skill}
     */
    getSkill(skillName) {
        let skills = this.skills;

        if (skillName in skills) {
            let result = Object.assign({}, skills[skillName]);

            result.cost = Math.pow(result.level, result.rate);
            result.percent = Math.floor(result.points / result.cost * 100.0);

            return result;
        }
        return undefined;
    }

    /**
     * Return the being's current title
     */
    getTitle() {
        let titles = this.titles,
            activeTitle = this.getEnv && this.getEnv('TITLE') || titles['active'];

        if (!activeTitle || activeTitle.indexOf('$N') === -1)
            return this.displayName;
        else
            return activeTitle.replace('$N', this.displayName);
    }

    get languages() {
        let skills = this.skills, langs = Object.keys(skills)
            .filter(sk => skills[sk].category === 'language');
        return langs;
    }

    /** @type {string[]} */
    get searchPath() {
        let path = this.getEnv('PATH');
        if (typeof path === 'string' && path.length)
            return path.split(':').map(dir => {
                let cwd = this.workingDirectory || false;
                if (dir.charAt(0) !== '/' && cwd)
                    return efuns.resolvePath(dir, cwd);
                else
                    return dir;
            });
        return [DIR_CMDS_PLAYER, DIR_CMDS_COMMON];
    }

    /** @type {string[]} */
    private set searchPath(dirList) {
        if (Array.isArray(dirList))
            this.setEnv('PATH', dirList.join(':'));
    }

    /**
     * Add one or more directories to the search path
     * @param {...string} cmddir
     */
    searchPathAdd(...cmdDirList) {
        let searchPath = this.searchPath,
            count = searchPath.length;

        cmdDirList.forEach(cmddir => {
            if (typeof cmddir === 'string' && cmddir.length > 0) {
                if (searchPath.indexOf(cmddir) === -1) {
                    searchPath.push(cmddir);
                }
            }
        });

        if (searchPath.length !== count) {
            this.searchPath = searchPath;
            return true;
        }
        return false;
    }

    /**
     * Set a stat level
     * @param {StatName|Object.<StatName,number>} stat The stat to increment
     * @param {number} level The stat level to set to
     * @returns {Living} A reference to itself
     */
    setStat(stat, level) {
        if (typeof stat === 'object') {
            Object.keys(stat).forEach(s => {
                this.setStat(s, stat[s]);
            });
        }
        else if (ValidStats.indexOf(stat) > -1) {
            if (typeof level === 'number' && level > 0) {
                let stats = this.stats;
                stats[stat] = level;
            }
        }
        return this;
    }

    /** @type {string[]} */
    get skillCategories() {
        let skills = this.skills;
        /** @type {string[]} */ let result = [];

        Object.keys(skills).forEach(skillName => {
            let skill = skills[skillName];
            if (result.indexOf(skill.category) < 0)
                result.push(skill.category);
        });

        result.sort((a, b) => a.localeCompare(b));

        return result;
    }

    /** @type {string[]} */
    get skillNames() {
        return Object.keys(this.skills);
    }

    /** @type {Object.<string,Skill>} */
    protected get skills() {
        return get({});
    }

    protected get stats() {
        return get({});
    }

    /**
     * A collection of titles bestowed upon the being.
     * @type {Object.<string,string>}
     */
    get titles() {
        return get({ active: "$N the newbie" });
    }
}
