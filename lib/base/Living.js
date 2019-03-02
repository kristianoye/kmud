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
    EmoteDaemon = efuns.loadObjectSync(Daemon.Emote);

class Living extends Body {
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
        this.tellEnvironment(this.displayName + ' ' + verb + ' ' + direction + '.');
        if (!this.movePlayer(destination))
            return false;
        else
            this.tellEnvironment(this.displayName + ' ' + verb + ' in.');
    }

    /**
     * Fetch information about the proficiency in a given language.
     * @param {string} lang
     */
    getLanguage(lang) {
        let skills = this.skills,
            skill = skills[lang];
        if (skill && skill.category === 'skill')
            return skill;
        return false;
    }

    get languages() {
        let skills = this.skills, langs = Object.keys(skills)
            .filter(sk => skills[sk].category === 'language');
        return langs;
    }

    get searchPath() {
        return get([DIR_CMDS_PLAYER, DIR_CMDS_COMMON]);
    }

    /** @type {Object.<string,{category:string, max:number, level:number, rate:number, points:number}>} */
    get skills() {
        return get({
            'basic melee': {
                category: 'combat',
                max: 20,
                level: 5,
                rate: 3,
                points: 0
            },
            common: {
                category: 'languages',
                max: 100,
                level: 100,
                rate: 3,
                points: 0
            }
        });
    }

    get stats() {
        return get({
            strength: 1,
            constitution: 1,
            dexterity: 1,
            intelligence: 1,
            wisdom: 1,
            charisma: 1,
            luck: 1,
            observation: 1
        });
    }
}

module.exports = Living;
