/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */


/** @typedef {'strength'|'constitution'|'dexterity'|'intelligence'|'wisdom'|'charisma'|'luck'|'observation'} StatName */
/** @typedef {'combat'|'language'|'magic'|'crafting'|'survival'} SkillCategory */
/** @typedef {{category:SkillCategory, max:number, level:number, rate:number, points:number}} Skill */

const
    Base = await requireAsync('Base'),
    Daemon = await requireAsync('Daemon'),
    Body = await requireAsync(Base.Body),
    Dirs = await requireAsync('Dirs');

const
    CommandResolver = await efuns.loadObjectAsync(Daemon.Command),
    EmoteDaemon = await efuns.loadObjectAsync(Daemon.Emote),
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
        'charisma',
        'luck',
        'perception'
    ];

class Living extends Body {
    constructor() {
        super();

        this.addSkill('common', 'language', 100);
        this.addSkill('basic melee', 'combat', 1, 25);
        this.setStat({
            strength: 1,
            constitution: 1,
            dexterity: 1,
            intelligence: 1,
            wisdom: 1,
            charisma: 1,
            observation: 1,
            luck: 1
        });
    }

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
            return Object.assign({}, skill);
        }
        return undefined;
    }

    directForceLivingToString(liv, command) {
        return true;
    }

    directVerbRule(verb, rule) {
        return EmoteDaemon().validVerbTarget(verb, this);
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

    eventMove(verb, direction, destination) {
        if (!this.movePlayer(destination))
            return false;
        else {
            let pverb = efuns.pluralize(verb);
            this.tellEnvironment(this.displayName + ' ' + pverb + ' in.');
            return writeLine(`You ${verb} ${direction}`);
        }
    }

    /**
     * Dispatch a command
     * @param {MUDInputEvent} evt
     */
    protected async executeCommand(evt) {
        let cmdObj = false, cmdResult = undefined;

        if ((cmdObj = CommandResolver().resolve(evt.verb, this.searchPath))) {
            /** @type {function} */
            let method = evt.htmlEnabled && typeof cmdObj.webcmd === 'function' ?
                cmdObj.webcmd : cmdObj.cmd;

            if (efuns.isAsync(method))
                return await method.call(cmdObj, evt.text, evt);
            else
                return method.call(cmdObj, evt.text, evt);
        }
        else if ((cmdResult = EmoteDaemon().cmd(evt.verb, evt.args, evt)))
            return cmdResult;
        else
            return efuns.errorLine(`What? (Command '${evt.verb}' not recognized)`);
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

    /**
     * Get information about a particular skill
     * @param {string} skillName
     * @returns {Skill}
     */
    getSkill(skillName) {
        let result = Object.assign({}, this.skills[skillName]);

        result.cost = Math.pow(result.level, result.rate);
        result.percent = Math.floor(result.points / result.cost * 100.0);

        return result;
    }

    /**
     * Return the being's current title
     */
    getTitle() {
        let titles = this.titles,
            activeTitle = titles['active'];
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

    /**
     * Allows custom overriding of shell settings based on the first verb
     * @param {string} verb The first verb to execute.
     */
    private prepareCommand(verb) {
        let searchPath = this.searchPath || false,
            cmd = CommandResolver().resolve(verb, searchPath);

        if (cmd && typeof cmd.prepareCommand === 'function')
            return cmd.prepareCommand(this);

        return {
            allowAliases: true,
            allowChaining: false,
            allowEnvironment: true,
            allowFileExpressions: false,
            allowLineSpanning: false,
            allowEscaping: false,
            allowFileIO: false,
            allowHistory: true,
            allowObjectShell: false
        };
    }

    /** @type {string[]} */
    get searchPath() {
        return get([Dirs.DIR_CMDS_PLAYER, Dirs.DIR_CMDS_COMMON]);
    }

    /** @type {string[]} */
    private set searchPath(dirList) {
        if (Array.isArray(dirList))
            set(dirList.filter(s => typeof s === 'string' && s.length > 0));
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
        return get({ active: "$N" });
    }
}

module.exports = Living;
