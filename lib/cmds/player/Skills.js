/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class SkillsCommand extends Command {
    cmd(args, cmdline) {
        var tp = thisPlayer,
            skills = tp.skills
                .map(name => efuns.merge({ name: name }, tp.getSkill(name)))
                .sort((a, b) => {
                    if (a.level === b.level) {
                        return (a.name < b.name) ? -1 : 1;
                    }
                    return a.level < b.level ? 1 : -1;
                })
                .map(skill => efuns.sprintf('%-20s : %3d/%3d', skill.name, skill.level, skill.max));

        if (skills.length === 0)
            return "You have zero skills; Amazing!";
        else
            tp.writeLine(skills.join('\n'));
        return true;
    }

    getHelp() {
        return {
            category: 'Commands > Player Commands > Status Commands',
            description: `
                <p><strong>Syntax:</strong> skills [LIVING]</p>
                <p>The <strong>skills</strong> command will display your trainable skills and how proficient you are with each.</p>`,
            see: ['score', 'body', 'languages']
        };
    }
}

module.exports = new SkillsCommand();
