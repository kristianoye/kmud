/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Body = require(Base.Body);

const
    ChatDaemon = efuns.loadObjectSync(Daemon.Chat),
    CommandResolver = efuns.loadObjectSync(Daemon.Command),
    EmoteDaemon = efuns.loadObjectSync(Daemon.Emote);

class BaseShell extends MUDObject {
    constructor(user) {
        super();

        register(':user', user);
    }

    /**
     * Splits a command into verb and arguments
     * @param {string} text The command to split
     * @returns {{ verb: string, args: string[], text: string, original: string }} The parsed data
     */
    static splitCommand(text) {
        return efuns.input.splitCommand(text, true);
    }

    /**
     * Does not do much except split the command
     * @param {string} text
     */
    processInput(text) {
        return BaseShell.splitCommand(text);
    }

    /**
     * The shell's user
     * @type {MUDObject} 
     */
    get user() {
        return get(':user');
    }
}


class Living extends Body {
    constructor(data) {
        super(data);

        register({
            living: {
                attackers: [],
                experience: 0,
                languages: {
                    "common": { level: 1, max: 5, points: 0, rate: 2 }
                },
                level: 1,
                money: {
                    gold: 0,
                    silver: 0,
                    platinum: 0,
                    copper: 0
                },
                searchPath: [],
                skills: {
                    combat: {
                        "brawling": { level: 1, max: 5, points: 0, tier: 3 },
                        "club weapons": { level: 1, max: 5, points: 0, tier: 3 }
                    },
                    languages: {
                        "common": { level: 100, max: 100, points: 0, tier: 3 }
                    }
                },
                stats: {
                    strength: 1,
                    constitution: 1,
                    dexterity: 1,
                    intelligence: 1,
                    perception: 1,
                    wisdom: 1,
                    charisma: 1
                }
            }
        });
    }

    directForceLivingToString(liv, command) {
        return true;
    }

    directVerbRule(verb, rule) {
        return EmoteDaemon().validVerbTarget(verb, this);
    }

    addExperience(xp) {
        if (typeof xp === 'number') {
            this.setProperty('experience', this.getProperty('experience', 0) + xp);
        }
        return this;
    }

    /**
        * Adds the specified amount of health.
        * @param {number} hp
        * @param {string=} limb
        */
    addHP(hp, limb) {
        hp = this.HP + hp;
        base.addHP(hp, limb);
        if (hp > this.maxHP)
            hp = this.maxHP;
        else if (hp < 0) {
            this.writeLine('You have died.');
        }
        return this;
    }

    bindAction(verb, owner, callback) {
        var actions = this.getSymbol(_actions, {}),
            binding = actions[verb] || false;
        if (binding === false) {
            actions[verb] = binding = [];
        }
        binding.push({ owner: owner, callback: callback });
        return this;
    }

    eventForce(cmdline) {
        efuns.command(cmdline);
    }

    unbindAction(owner, verb) {
        var list, actions = this.getSymbol(_actions, {});
        if (typeof verb === 'string') {
            list = actions[verb] = actions[verb].filter(o => o.owner !== owner);
            if (list.length === 0) delete actions[verb];
        }
        else {
            Object.keys(actions).forEach(v => {
                list = actions[v].filter(o => o.owner !== owner);
                if (list.length === 0) delete actions[v];
            });
        }
    }

    getActions(verb) {
        var actions = this.getSymbol(_actions, {}),
            binding = actions[verb] || false;
        return binding;
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
        this.tellEnvironment(this.displayName + ' ' + verb + ' ' + direction + '.');
        this.movePlayer(destination);
        this.tellEnvironment(this.displayName + ' ' + verb + ' in.');
    }

    get HP() {
        return this.getProperty('curHP', 0);
    }

    isLiving() {
        return true;
    }

    get languages() {
        var langs = this.getProperty('languages', {});
        return Object.keys(langs);
    }

    getLanguage(lang) {
        var langs = this.getProperty('languages', {}),
            skill = langs[lang];
        if (skill) {
            return {
                level: skill.level,
                max: skill.max,
                points: skill.points || 0
            };
        }
        return { level: 0, max: 0 };
    }

    getLevel() {
        return this.getProperty('level', 1);
    }

    get maxHP() {
        return this.getProperty('maxHP', 0);
    }

    get searchPath() {
        return [DIR_CMDS_PLAYER, DIR_CMDS_COMMON];
    }

    get skills() {
        var skills = this.getProperty('skills', {});
        return Object.keys(skills);
    }

    getSkill(name) {
        var skills = this.getProperty('skills', {});
        if (typeof skills === 'object' && name in skills) {
            return efuns.merge({}, skills[name]);
        }
    }

    getStat(name) {
        var stats = this.getProperty('stats');
        if (typeof stats === 'object' && typeof stats[name] === 'number')
            return stats[name];
        return -1;
    }

    getTitle() {
        var str = this.getProperty('title', '$N the newbie');
        return str.replace('$N', this.displayName);
    }

    hasId(id) {
        var foo = id.toLowerCase().replace(/[^a-z]+/g, '');
        if (foo === this.getName()) return true;
        return super.hasId(id);
    }

    /**
        * 
        * @param {string} name
        * @param {number=} level
        * @param {max=} max
        */
    setLanguage(name, level, max) {
        var langs = this.getProperty('languages', {}),
            lang = langs[name];
        if (!lang) {
            langs[name] = {
                level: level || 1,
                max: max || level || 1
            };
        } else {
            if (typeof level === 'number' && level > 0) lang['level'] = level;
            if (typeof max === 'number' && max > 0) lang['max'] = max;
        }
        return this;
    }

    setLevel(level) {
        if (typeof level === 'number' && level > 0) {
            this.setProperty('level', level);
        }
        return this;
    }

    setStat(stat, level) {
        var stats = this.getProperty('stats');
        if (typeof stat === 'string' && typeof level === 'number' && level > 0) {
            stats[stat] = level;
        }
        return this;
    }

    setTitle(title) {
        if (typeof title === 'string' && title.indexOf('$N') > -1)
            this.setProperty('title', title);
        return this;
    }
}

module.exports = { Living, BaseShell };

