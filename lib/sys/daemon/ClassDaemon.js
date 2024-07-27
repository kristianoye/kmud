/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { DIR_CLASSES } from '@Dirs';
import { LIB_CHARCLASS } from '@Base';
import CharacterClass from LIB_CHARCLASS;

export default singleton class ClassDaemon {
    private async create() {
        await this.loadClasses();
    }

    private set loadedClasses(spec) {
        if (typeof spec === 'object')
            set(spec);
    }

    private get loadedClasses() {
        return get({});
    }

    /**
     * Load class types
     */
    private async loadClasses() {
        let classDir = await efuns.fs.getObjectAsync(DIR_CLASSES),
            files = classDir && await classDir.readDirectoryAsync(),
            newClasses = {};

        if (files) {
            for (const file of files) {
                if (file.isLoadable) {
                    let classObject = await file.loadObjectAsync(),
                        inst = classObject && classObject.instance;

                    if (inst && inst.enabled && inst instanceof CharacterClass) {
                        newClasses[inst.className] = classObject;
                    }
                }
            }
            this.loadedClasses = newClasses;
        }
    }
}