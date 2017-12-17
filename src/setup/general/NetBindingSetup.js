
const
    MudSetupStep = require('../MudSetupTypes').MudSetupStep,
    { NetUtil, NetworkInterface } = require('../../network/NetUtil');

class NetBindingSetup extends MudSetupStep {
    /**
     * 
     * @param {object} spec
     * @param {NetworkInterface[]} list
     * @param {number} index
     */
    changeBindingAddress(spec, list, index) {
        let addressList = list.map((item, i) => `\t[${(i + 1)}] - ${item.address}:${spec.port} [inet access: ${(item.internetAccess ?  'yes' : 'no')}, local: ${(item.isLocal ? 'yes' : 'no')}]`).join('\n');
        this.console.question(`
Select address to bind:
        [0] - 0.0.0.0:${spec.port} - [Available on all Interfaces]
${addressList}

MUD Settings:Bindings:${spec.type} port:Address>`, resp => {
                var n = parseInt(resp);
                if (n === 0) {
                    spec.address = '0.0.0.0';
                    return this.addPort(spec, index);
                }
                else if (--n < list.length) {
                    spec.address = list[n].address;
                    return this.addPort(spec, index);
                }
                else {
                    this.console.write('\n\nInvalid selection.\n');
                    return this.changeBindingAddress(spec, list, index);
                }
            });
    }

    addPort(spec, index) {
        var self = this;
        this.console.question(`
Settings:
    Binding Type:       ${spec.type}
    Binding Address:    ${spec.address}
    Binding Port:       ${spec.port}
    Max Players:        ${spec.maxConnections} [-1 for unlimited]
    Wizards Only:       ${(spec.wizardsOnly ? 'true' : 'false')}

Commands:
    Change [t]ype [telnet|http]
    Change [p]ort [port number]
    Change [a]dress
    Set [m]ax players [count]
    Toggle [w]izards only
    Return to bindings men[u]
    
MUD Settings:Bindings:${spec.type} port> `, resp => {
                var m = /^([^\d\s]+)\s*(.+)*$/.exec(resp);
                if (m) {
                    switch (m[1].toLowerCase()) {
                        case 'a':
                            NetUtil.discovery(list => {
                                return self.changeBindingAddress(spec, list, index);
                            });
                            return;

                        case 'm': case 'max':
                            let players = parseInt(m[2]);
                            if (typeof players !== 'number' || (players < 1 && players !== -1)) {
                                this.console.write(`\n\nInvalid port value: ${m[2]}; Port must be numeric and between 1024 and 60000.\n`);
                            }
                            else {
                                spec.maxConnections = players;
                            }
                            return this.addPort(spec, index);

                        case 'menu': case 'u':
                            if (spec.port < 1024 || spec.port > 54000) {
                                this.console.write('\n\nInvalid port number.\n');
                                return this.addPort(spec, index);
                            }
                            this.config.mud.portBindings[index] = spec;
                            return this.menu();

                        case 'p': case 'port':
                            let port = parseInt(m[2]);
                            if (!port || (port < 1024 || port > 60000)) {
                                this.console.write(`\n\nInvalid port value: ${m[2]}; Port must be numeric and between 1024 and 60000.\n`);
                            }
                            else {
                                spec.port = port;
                            }
                            return this.addPort(spec, index);

                        case 't': case 'type':
                            if (m[2] === 'telnet' || m[2] === 'http') {
                                spec.type = m[2];
                            }
                            else {
                                this.console.write(`\n\nInvalid port type ${m[2]}; Valid types are: telnet and http.\n`);
                            }
                            return this.addPort(spec, index);

                        case 'w':
                            spec.wizardsOnly = !spec.wizardsOnly;
                            return this.addPort(spec, index);
                    }
                }
                return this.addPort(spec, index);
            });
    }

    menu() {
        let opts = {}, bindingCount = 0,
            lines = ['\n\nExisting Network Bindings:\n'];

        lines.push(...this.config.mud.portBindings.map((binding, index) => {
                bindingCount++;
                return `\t\t[${index}] - ${binding.type} port ${binding.port} ${(binding.wizardsOnly ? ' [Wizards Only]' : '')}\n`;
            }));

        if (lines.length === 1)
            lines = ['No network ports configured, yet\n'];

        lines.push('\nCommands:\n')
        lines.push('\t\t[d]elete # - Delete an existing binding\n');
        lines.push('\t\tAdd new [w]eb binding\n')
        lines.push('\t\tAdd new [t]elnet binding\n');
        lines.push('\t\t[e]dit # - Change an existing binding\n');
        if (bindingCount > 0) lines.push('\t\tD[o]ne with bindings\n')

        this.console.write(`
Network bindings are what control how players can connect to your MUD.  You
may define HTTP ports for web browsers and Telnet ports for older, legacy 
clients.  You may limit the number of players and type of allowed players on
each binding entry.
`)
        this.console.question(lines.join('') + '\n\nMUD Settings:Bindings> ', resp => {
            var m = /^([^\s]+)\s*([\d]+)*/.exec(resp);
            if (m) {
                let index = parseInt(m[2]) || -1,
                    max = this.config.mud.portBindings.length;

                if (index >= max)
                    index = -1;

                switch (m[1].toLowerCase()) {
                    case 'd': case 'del': case 'delete':
                        if (index === -1) {
                            this.console.write('\n\nInvalid entry.\n');
                            return this.menu();
                        }
                        this.console.write('\n\nDeleting entry # ' + m[2] + '\n');
                        this.config.mud.portBindings.splice(index, 1);
                        return this.menu();

                    case 'e': case 'edit':
                        if (index === -1) {
                            this.console.write('\n\nInvalid entry.\n');
                            return this.menu();
                        }
                        this.console.write('\n\nEditing entry # ' + m[2] + '\n');
                        return this.addPort(this.config.mud.portBindings[index], index);

                    case 'o': case 'done':
                        return this.callback();

                    case 't': case 'telnet':
                        this.console.write('\n\nAdd telnet port...\n');
                        return this.addPort({ type: 'telnet', port: -1, maxConnections: 100, wizardsOnly: false, address: '0.0.0.0' }, max);

                    case 'w': case 'web':
                        this.console.write('\n\nAdd web port');
                        return this.addPort({ type: 'http', port: -1, maxConnections: 100 , wizardsOnly: false, address: '0.0.0.0' }, max);

                    default:
                        index = parseInt(m[1]);
                        if (index > -1 && index < max) {
                            return this.addPort(this.config.mud.portBindings[index], index);
                        }
                        return this.menu();
                }
            }
            return this.menu();
        });
    }

    run(owner, callback) {
        this.callback = callback;
        this.config = owner.config;
        this.console = owner.console;
        if (owner.config.mud.portBindings.length === 0) {
            return this.menu();
        }
        else {
            this.console.question('\n\nWould you like to set up MUD server ports? [yN] ', resp => {
                if (resp.length === 0 || resp.match(/^n/i)) {
                    return this.callback();
                }
                else if (resp.match(/^y/i)) {
                    return this.menu();
                }
                else {
                    return this.run(owner, callback);
                }
            });
        }
    }
}

module.exports = NetBindingSetup;
