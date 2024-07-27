/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class SkillsCommand extends Command {
    override cmd(args, cmdline) {
        let tp = thisPlayer();
        /** @type {string[]} */ let cats = tp.skillCategories;
        let caps = efuns.clientCaps(tp);
        /** @type {string[]} */ let lines = [];
        let width = caps.clientWidth || 80, colsLeft = 0, skillCount = 0;

        cats.forEach((catName, catIndex) => {
            let text = [];

            if (catIndex > 0)
                lines.push('');

            lines.push('%^GREEN%^' + catName.charAt(0).toUpperCase() + catName.slice(1) + ' skills:%^RESET%^');
            colsLeft = 0;

            /** @type {string[]} */ let skills = tp.getCategorySkills(catName);

            skills.forEach(skillName => {
                let skill = tp.getSkill(skillName);
                let output = skillName.padRight(20) + `${skill.level}/${skill.max} (${skill.percent.toFixed(2)})`;

                if (colsLeft > output.length) {
                    colsLeft -= output.length;
                    text[text.length - 1] += output;
                }
                else {
                    colsLeft = width - output.length;
                    text.push(output);
                }
                skillCount++;
            });

            if (text.length > 0)
                lines.push(...text);
            else
                lines.push('\tNo skills in specified category!');
        });

        if (skillCount === 0)
            return "You have zero skills; Amazing!";
        else
            efuns.text.more(lines);

        return true;
    }

    override getHelp() {
        return {
            category: 'Commands > Player Commands > Status Commands',
            description: `
                <p><strong>Syntax:</strong> skills [LIVING]</p>
                <p>The <strong>skills</strong> command will display your trainable skills and how proficient you are with each.</p>`,
            see: ['score', 'body', 'languages']
        };
    }
}
