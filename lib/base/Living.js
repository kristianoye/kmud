/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

/** @typedef {'strength'|'constitution'|'dexterity'|'intelligence'|'wisdom'|'charisma'|'luck'|'observation'} StatName */
/** @typedef {'combat'|'language'|'magic'|'crafting'|'survival'} SkillCategory */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Body = require(Base.Body),
    Dirs = require('Dirs');

const
    EmoteDaemon = efuns.loadObjectSync(Daemon.Emote),
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
    constructor(...args) {
        super(...args);
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
     * @param {number} level THe initial skill level
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

    /** @type {Object.<string,{category:string, max:number, level:number, rate:number, points:number}>} */
    get skills() {
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
