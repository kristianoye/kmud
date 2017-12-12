interface CmdLineInfo {
    input: string;
    verb: string;
    raw: string;
}

interface Command extends GameObject {
    cmd(args: string[], cmdline: CmdLineInfo): boolean|string; 
}

/// <reference path="GameObject.d.ts"/>
