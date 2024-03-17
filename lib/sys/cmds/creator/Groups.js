/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 14, 2024
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

const
    OP_VIEWGROUPS = 1,
    OP_VIEWMEMBERS = 2,
    OP_CREATEGROUP = 3,
    OP_ADDMEMBER = 4,
    OP_RMMEMBER = 5,
    OP_DELETEGROUP = 6,
    OP_LISTGROUPS = 7,
    FLAG_SYSTEM = 1,
    FLAG_FORCE = 1 << 1,
    FLAG_DOMAIN = 1 << 2,
    FLAG_DETAILS = 1 << 3,
    FLAG_PLAYER = 1 << 4,
    FLAG_REALM = 1 << 5;


export default final singleton class GroupsCommand extends Command {
    /**
     * Interact with security groups
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    override async cmd(txt, cmdline) {
        let op = OP_VIEWGROUPS,
            flags = 0,
            userOrDomain = false,
            groupName = '',
            securityType = efuns.security.securityManagerType,
            /** @type {string[]} */ args = cmdline.args,
            members = [];

        if (!txt) {
            let perms = await efuns.security.getSafeCredentialAsync(thisPlayer());
            writeLine(perms.groups.map(g => g.id).join(' '));
        }
        else {
            for (let i = 0; i < args.length; i++) {
                let arg = args[i];

                if (arg.charAt(0) === '-') {
                    switch (arg = arg.slice(1)) {
                        case '-add':
                            if ((i + 1) === args.length || args[i + 1].charAt('-'))
                                return errorLine(`${cmdline.verb}: Group name is required for -${arg}`);
                            op = OP_ADDMEMBER;
                            break;
                        case '-create':
                            op = OP_CREATEGROUP;
                            break;

                        case '-delete':
                        case '-del':
                        case '-rm':
                            op = OP_DELETEGROUP;
                            break;

                        case '-details':
                            flags |= FLAG_DETAILS;
                            break;

                        case '-domain':
                            if (++i >= args.length || args[i].charAt(0) === '-')
                                return errorLine(`${cmdline.verb}: Domain name is required for -${arg}`);
                            userOrDomain = args[i];
                            flags &= ~(FLAG_SYSTEM | FLAG_REALM);
                            flags |= FLAG_DOMAIN;
                            break;

                        case '-force':
                            flags |= FLAG_FORCE;
                            break;

                        case '-help':
                            return this.showHelp(cmdline.verb);

                        case '-list':
                            op = OP_LISTGROUPS;
                            break;

                        case '-members':
                            op = OP_VIEWMEMBERS;
                            break;

                        case '-player':
                            // target player, not wizard
                            flags |= FLAG_PLAYER;
                            break;

                        case '-realm':
                            flags |= FLAG_REALM;
                            flags &= ~(FLAG_DOMAIN | FLAG_SYSTEM);
                            break;

                        case '-remove':
                            op = OP_RMMEMBER;
                            break;

                        case '-system':
                            flags |= FLAG_SYSTEM;
                            flags &= ~(FLAG_DOMAIN | FLAG_REALM);
                            break;

                        case '-user':
                            if (++i >= args.length || args[i].charAt(0) === '-')
                                return errorLine(`${cmdline.verb}: Username is required for -${arg}`);
                            userOrDomain = args[i];
                            flags &= ~FLAG_SYSTEM;
                            flags &= ~FLAG_DOMAIN;
                            break;

                        case '-wizard':
                            flags &= ~FLAG_PLAYER;
                            break;

                        default:
                            if (arg.charAt(0) === '-')
                                return `${cmdline.verb}: Unknown option -${arg}`;
                            else {
                                let flagList = arg.split('');
                                for (const flag of flagList) {
                                    switch (flag) {
                                        case 'a':
                                            op = OP_ADDMEMBER;
                                            break;
                                        case 'c':
                                            op = OP_CREATEGROUP;
                                            break;
                                        case 'd':
                                            op = OP_DELETEGROUP;
                                            break;
                                        case 'f': // force
                                            flags |= FLAG_FORCE;
                                            break;
                                        case 'i':
                                            flags |= FLAG_DETAILS;
                                            break;
                                        case 'l':
                                            op = OP_LISTGROUPS;
                                            break;
                                        case 'm': // View members
                                            op = OP_VIEWMEMBERS;
                                            break;
                                        case 'p':
                                            flags |= FLAG_PLAYER;
                                            break;
                                        case 'r':
                                            op = OP_RMMEMBER;
                                            break;
                                        case 's': // System
                                            flags &= ~(FLAG_DOMAIN | FLAG_REALM);
                                            flags |= FLAG_SYSTEM;
                                            break;
                                        case 'w':
                                            flags &= ~FLAG_PLAYER;
                                            break;
                                        default:
                                            return `${cmdline.verb}: Unknown switch -${flag}`;
                                    }
                                }
                            }
                            break;
                    }
                }
                else {
                    if (groupName) {
                        members.push(arg);
                    }
                    else {
                        groupName = arg;

                        if (['~', '@', '$'].indexOf(arg.charAt(0)) > -1)
                            continue;
                        else if ((flags & FLAG_SYSTEM) > 0) {
                            groupName = arg.charAt(0) === '$' ? `${arg.toUpperCase()}` : `$${arg.toUpperCase()}`;
                        }
                        else if ((flags & FLAG_DOMAIN) > 0) {
                            if (!userOrDomain)
                                return `${cmdline.verb}: A domain name is required to add a domain group`;
                            groupName = arg.charAt(0) === '@' ? `${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}` : `@${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}`;
                        }
                        else {
                            if (!userOrDomain) {
                                userOrDomain = thisPlayer().keyId;
                            }
                            if (op === OP_VIEWGROUPS || op === OP_LISTGROUPS)
                                userOrDomain = arg;
                            groupName = arg.charAt(0) === '~' ? `${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}` : `~${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}`;
                        }
                    }
                }
            }
        }

        if (!groupName && [OP_ADDMEMBER, OP_CREATEGROUP, OP_DELETEGROUP, OP_VIEWMEMBERS, OP_RMMEMBER].indexOf(op) > -1)
            return errorLine(`${cmdline.verb}: Group name required`);

        switch (op) {
            case OP_ADDMEMBER:
                if (!await this.addMembers(groupName, flags, members))
                    return false;
                break;

            case OP_CREATEGROUP:
                if (!await this.createGroup(groupName, flags, members))
                    return false;
                break;

            case OP_DELETEGROUP:
                if (!await this.deleteGroup(groupName, flags))
                    return false;
                break;

            case OP_LISTGROUPS:
                this.listGroups(userOrDomain, flags);
                break;

            case OP_RMMEMBER:
                if (!await this.removeMembers(groupName, flags, members))
                    return false;
                break;

            case OP_VIEWGROUPS:
                await this.viewGroups(userOrDomain, flags);
                break;

            case OP_VIEWMEMBERS:
                await this.viewGroupMembers(groupName, flags);
                break;
        }

        return true;
    }

    /**
     * Add one or more IDs to a group
     * @param {string} id The group to add members to
     * @param {numbers} flags Flags for the operation
     * @param {string[]} members A list of members to add
     * @returns {Promise<boolean>}
     */
    private async addMembers(id, flags, members) {
        let group = efuns.security.getSecurityGroup(id),
            addList = [],
            isForced = (flags & FLAG_FORCE) > 0;

        if (!group) {
            errorLine(`Group ${id} does not exist`);
            return false;
        }
        if (members.length === 0 && !isForced) {
            do {
                let name = await promptAsync('text', `(optional) Name of user to add to ${id} [Leave blank to continue]: `);
                if (name.length === 0)
                    break;

                let p = await this.validIdentifier(name);
                if (p) {
                    if (group.members.indexOf(p) > -1)
                        errorLine(`${name} is already a member of the group`);
                    else {
                        writeLine(`Adding ${p} to group ${id}`);
                        addList.push(p);
                    }
                }
            }
            while (true);
        }
        for (const m of members) {
            let p = await this.validIdentifier(m, flags);
            if (p) addList.push(p);
        }
        if (addList.length === 0) {
            if (isForced)
                return true;
            else
                return errorLine(`No members were added to group ${id}; Aborting`);
        }
        else {
            let result = await efuns.security.addGroupMembers(id, addList);
            return isForced || result;
        }
    }

    /**
     * Create a new security group
     * @param {string} id The group ID to create
     * @param {number} flags
     * @param {string[]} members
     * @returns {Promise<boolean>}
     */
    private async createGroup(id, flags, members) {
        let group = efuns.security.getSecurityGroup(id);

        if (group) {
            if ((flags & FLAG_FORCE) > 0)
                return true;
            else
                return errorLine(`groups: Group ${id} already exists`);
        }
        group = { id, members: [] };

        do {
            group.name = await promptAsync('text', `Enter a name for group ${id}: `);
            if (group.name.length === 0)
                return errorLine('Aborting');
            else
                break;
        }
        while (true);

        do {
            group.description = await promptAsync('text', `Enter a description for group ${id}: `);
            if (group.description.length === 0)
                return errorLine('Aborting');
            else
                break;
        }
        while (true);

        if (members.length > 0) {
            for (const m of members) {
                let p = await this.validIdentifier(m, flags);
                if (p)
                    group.members.push(p);
            }
        }

        if (group.members.length === 0) {
            do {
                let name = await promptAsync('text', `(optional) Name of user to add to ${id} [Leave blank to continue]: `);
                if (name.length === 0)
                    break;

                let p = await this.validIdentifier(name);
                if (p) {
                    if (group.members.indexOf(p) > -1)
                        errorLine(`${name} is already a member of the group`);
                    else {
                        writeLine(`Adding ${p} to group ${id}`);
                        group.members.push(p);
                    }
                }
            }
            while (true);
        }

        try {
            let result = await efuns.security.createSecurityGroup(group);
            if (result === true)
                return writeLine(`Group ${id} added successfully`);
            else
                return errorLine(`groups: Failed to create group ${id}`);
        }
        catch (e) {
            return errorLine(`groups: Failed to create group ${id}: ${e}`);
        }
    }

    private async deleteGroup(id, flags) {
        let group = efuns.security.getSecurityGroup(id);

        if (!group) {
            if ((flags & FLAG_FORCE) > 0)
                return true;
            else
                return errorLine(`groups: Group ${id} does not exist`);
        }
        if ((flags & FLAG_FORCE) === 0) {
            do {
                let p = await promptAsync('text', id.charAt(0) === '$' ?
                    `!!! ATTENTION !!! Group ${groupName} is a SYSTEM group; Are you sure you want to delete it? [y/N] ` :
                    `Are you sure you want to delete group ${id}? [y/N] `);
                if (p.length === 0 || p.toLowerCase() === 'n')
                    return errorLine('Aborting');
                else if (p.toLowerCase() === 'y')
                    break;
            }
            while (true);
        }
        try {
            let result = await efuns.security.deleteSecurityGroup(id);
            if (result === true)
                return writeLine(`Group ${id} deleted successfully`);
            else
                return errorLine(`groups: Failed to delete group ${id}`);
        }
        catch (e) {
            return errorLine(`groups: Failed to delete group ${id}: ${e}`);
        }
    }

    /**
     * List groups matching the specified pattern
     * @param {string} expr
     * @param {number} flags
     */
    private listGroups(expr, flags) {
        let groups = efuns.security.listSecurityGroups(expr);

        if (groups.length === 0)
            return errorLine(`groups: No groups matching ${expr}`);

        if ((flags & FLAG_SYSTEM) > 0)
            groups = groups.filter(g => g.id.charAt(0) === '$');
        else if ((flags & FLAG_DOMAIN) > 0)
            groups = groups.filter(g => g.id.charAt(0) === '@');
        else if ((flags & FLAG_REALM) > 0)
            groups = groups.filter(g => g.id.charAt(0) === '~');

        groups.sort();

        if ((flags & FLAG_DETAILS) > 0) {
            let n = 0;
            for (const group of groups) {
                if (n++ > 0) {
                    let caps = efuns.clientCaps(),
                        width = caps.width || 80;
                    writeLine('-'.repeat(width - 2));
                }
                writeLine(`Group ID:          ${group.id}`);
                writeLine(`Group Name:        ${group.name}`);
                writeLine(`Group Description: ${group.description}`);
                writeLine(`Group Members:     ${group.members.join(' ')}`);
            }
        }
        else {
            for (const group of groups) {
                writeLine(group.id);
            }
        }
        return true;
    }

    /**
     * 
     * @param {string} id
     * @param {number} flag
     * @param {string[]} members
     * @returns {Promise<boolean>}
     */
    private async removeMembers(id, flags, members) {
        let group = efuns.security.getSecurityGroup(id),
            removeList = [],
            isForced = (flags & FLAG_FORCE) > 0;

        if (!group) {
            errorLine(`Group ${id} does not exist`);
            return false;
        }
        if (members.length === 0 && !isForced) {
            do {
                let name = await promptAsync('text', `(optional) Name of user/group to remove to ${id} [Leave blank to continue]: `);
                if (name.length === 0)
                    break;

                let p = await this.validIdentifier(name, flags);
                if (p) {
                    if (group.members.indexOf(p) === -1)
                        errorLine(`${name} is not a member of the group`);
                    else {
                        writeLine(`Removing ${p} from group ${id}`);
                        removeList.push(p);
                    }
                }
            }
            while (true);
        }
        for (const m of members) {
            let p = await this.validIdentifier(m, flags);
            if (p) removeList.push(p);
        }
        if (removeList.length === 0) {
            if (isForced)
                return true;
            else
                return errorLine(`No members were removed from group ${id}; Aborting`);
        }
        else {
            let result = await efuns.security.removeGroupMembers(id, removeList);
            return isForced || result;
        }
    }

    private showHelp(verb) {
        return writeLine(`
Usage:
    ${verb} Shows current user's groups
    ${verb} [IDENTIFIER] Shows what groups the IDENTIFIER is in
    ${verb} [OPTIONS] [GROUP] [MEMBERS...]


Options:
--add, -a           Add one or more members to an existing group
--create, -c        Create a new security group
--delete, -d        Delete an existing group
--details, -i       Show additional information
--domain            Perform operation on a domain group
--force, -f         Force operations without causing errors
--help              Show this information and exit
--list [expr], -l   List groups matching the specified expression
--members           List the members in an existing group
--player            Assume identities are players and not wizards
--realm             Perform operation on a realm group
--remove, -r        Remove one or more members from a group
--system, -s        Perform operation on a SYSTEM group
--user              Clears domain and system flags
--wizard, -w        Assume identities are wizards and not players

Examples:
    groups -cs Testers
        Creates a system group named '$TESTERS'

    groups -as Testers tester
        Adds user 'tester' to '$TESTERS' group

    groups -rs Testers tester
        Removes user 'tester' from '$TESTERS' group
`);
    }

    /**
     * Validate an identifier
     * @param {string} name
     * @param {number} flags
     * @returns
     */
    private async validIdentifier(name, flags) {
        let norm = efuns.normalizeName(name);
        if (norm.length === 0)
            return false;
        else if (['@', '~', '$'].indexOf(name.charAt(0)) > -1) {
            let groupCheck = await efuns.security.getSecurityGroup(name.toUpperCase());
            if (!groupCheck) {
                errorLine(`${name} does not appear to be a valid username or group ID`);
                return false;
            }
            return name.toUpperCase();
        }
        else if ((flags & FLAG_PLAYER) === 0) {
            if (!await efuns.living.wizardExists(norm)) {
                errorLine(`${name} does not appear to be a valid wizard name`);
                return false;
            }
            else {
                return `creators\\${norm}`;
            }
        }
        else if (!await efuns.living.playerExists(norm)) {
            errorLine(`${name} does not appear to be a valid player name`);
            return false;
        }
        else {
            return `players\\${norm}`;
        }
    }

    private async viewGroupMembers(id, flags) {
        let group = efuns.security.getSecurityGroup(id);

        if (!group)
            return errorLine(`groups: No such group '${id}'`);
        else {
            if ((flags & FLAG_DETAILS) > 0) {
                writeLine(`Group ID:          ${group.id}`);
                writeLine(`Group Name:        ${group.name}`);
                writeLine(`Group Description: ${group.description}`);
                return writeLine(`Group Members:     ${group.members.join(' ')}`);
            }
            return writeLine(`${group.id} : ${group.members.join(' ')}`);
        }
    }

    private async viewGroups(id, flags) {
        let perms = await efuns.security.getSafeCredentialAsync(id, true),
            groups = Array.isArray(perms.groups) ? perms.groups.map(g => g.id) : ['none'];

        return writeLine(`${id} : ` + groups.join(' '));
    }
}
