/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_VERB } from '@Base';
import Verb from LIB_VERB;

export default singleton class Smell extends Verb {
    override create() {
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

