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
    FLAG_SYSTEM = 1,
    FLAG_FORCE = 1 << 1,
    FLAG_DOMAIN = 1 << 2,
    FLAG_DETAILS = 1 << 3;


export default final singleton class WhichCommand extends Command {
    /**
     * Interact with security groups
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    override async cmd(txt, cmdline) {
        let op = OP_VIEWGROUPS,
            flags = 0,
            userOrDomain = false,
            securityType = efuns.security.securityManagerType,
            /** @type {string[]} */ args = cmdline.args;

        if (args.length === 0) {
            let perms = await efuns.security.getSafeCredentialAsync(thisPlayer());
            writeLine(perms.groups.map(g => g.id).join(' '));
        }
        else {
            for (let i = 0; i < args.length; i++) {
                let arg = args[i];

                if (arg.charAt(0) === '-') {
                    switch (arg = arg.slice(1)) {
                        case '-create':
                            op = OP_CREATEGROUP;
                            break;

                        case '-details':
                            flags |= FLAG_DETAILS;
                            break;

                        case '-domain':
                            if (++i >= args.length || args[i].charAt(0) === '-')
                                return errorLine(`${cmdline.verb}: Domain name is required for -${arg}`);
                            userOrDomain = args[i];
                            flags &= ~FLAG_SYSTEM;
                            flags |= FLAG_DOMAIN;
                            break;

                        case '-force':
                            flags |= FLAG_FORCE;
                            break;

                        case '-members':
                            op = OP_VIEWMEMBERS;
                            break;

                        case '-system':
                            flags |= FLAG_SYSTEM;
                            break;

                        case '-user':
                            if (++i >= args.length || args[i].charAt(0) === '-')
                                return errorLine(`${cmdline.verb}: Username is required for -${arg}`);
                            userOrDomain = args[i];
                            flags &= ~FLAG_SYSTEM;
                            flags &= ~FLAG_DOMAIN;
                            break;

                        default:
                            if (arg.charAt(0) === '-')
                                return `${cmdline.verb}: Unknown or unsupported option -${arg}`;
                            else {
                                let flagList = arg.split('');
                                for (const flag of flagList) {
                                    switch (flag) {
                                        case 'c':
                                            op = OP_CREATEGROUP;
                                            break;
                                        case 'f': // force
                                            flags |= FLAG_FORCE;
                                            break;
                                        case 'i':
                                            flags |= FLAG_DETAILS;
                                            break;
                                        case 'm': // View members
                                            op = OP_VIEWMEMBERS;
                                            break;
                                        case 's': // System
                                            flags &= ~FLAG_DOMAIN;
                                            flags |= FLAG_SYSTEM;
                                            break;
                                        default:
                                            return `${cmdline.verb}: Unknown or unsupported switch -${flag}`;
                                    }
                                }
                            }
                            break;
                    }
                }
                else {
                    let groupName = arg;

                    if ((flags & FLAG_SYSTEM) > 0) {
                        if (arg.charAt(0) === '@' || arg.charAt(0) === '~')
                            arg = arg.slice(1);
                        groupName = arg.charAt(0) === '$' ? `${arg.toUpperCase()}` : `$${arg.toUpperCase()}`;
                    }
                    else if ((flags & FLAG_DOMAIN) > 0) {
                        if (arg.charAt(0) === '$' || arg.charAt(0) === '~')
                            arg = arg.slice(1);
                        if (!userOrDomain)
                            return `${cmdline.verb}: A domain name is required to add a domain group`;
                        groupName = arg.charAt(0) === '@' ? `${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}` : `@${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}`;
                    }
                    else {
                        if (!userOrDomain) {
                            userOrDomain = thisPlayer().keyId;
                        }
                        if (arg.charAt(0) === '$' || arg.charAt(0) === '@')
                            arg = arg.slice(1);
                        groupName = arg.charAt(0) === '~' ? `${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}` : `~${userOrDomain.toUpperCase()}\\${arg.toUpperCase()}`;
                    }

                    switch (op) {
                        case OP_CREATEGROUP:
                            if (!await this.addGroup(groupName, flags))
                                return false;
                            break;

                        case OP_VIEWGROUPS:
                            await this.viewGroups(arg, flags);
                            break;

                        case OP_VIEWMEMBERS:
                            await this.viewGroupMembers(groupName, flags);
                            break;
                    }
                }
            }
        }

        return true;
    }

    private async addGroup(id, flags) {
        let group = efuns.security.getSecurityGroup(id);

        if (group) {
            if ((flags & FLAG_FORCE) > 0)
                return true;
            else
                return errorLine(`groups: Group ${id} already exists`);
        }
        writeLine(`Adding group ${id}`);
        return true;
    }

    async viewGroupMembers(id, flags) {
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

    async viewGroups(id, flags) {
        let perms = await efuns.security.getSafeCredentialAsync(id),
            groups = Array.isArray(perms.groups) ? perms.groups.map(g => g.id) : ['none'];

        return writeLine(`${id} : ` + groups.join(' '));
    }
}
