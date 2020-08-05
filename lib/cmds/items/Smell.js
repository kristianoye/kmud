/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Verb = await requireAsync(Base.Verb);


class Smell extends Verb {
    create() {
        this
            .setVerb("smell")
            .addRules(
            "",
            "OBJECT in OBJECT",
            "STRING",
            "STRING on OBJECT");
    }

    canSmell() { return true; }

    canSmellObjectInObject() { }

    canSmellString() { }

    canSmellStringOnObject() { }

    doSmell() { return true; }

    doSmellObjectInObject() { }

    doSmellString() { }

    doSmellStringOnObject() { }
}

module.exports = new Smell();

