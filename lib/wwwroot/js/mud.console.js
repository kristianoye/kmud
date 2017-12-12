/**
 * The KMUD Client.  Responsible for providing the core communication with
 * the MUD/WMD server and for coordinating the rendering of game content.
 *
 * The MUD console is responsible for processing user commands and sending
 * them to the server.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var MudConsole = (function ($, parent) {
    function MudConsole(container, state) {
        parent.call(this, 'MudConsole', container, state);
        var self = this,
            viewPort = null,
            $console = this.client.buildTemplate('mudConsoleTemplate');

        this.$element.addClass('mudConsole').append($console)
            .on('submit', 'form', function (e) {
                e.preventDefault();
                self.sendCommand();
            });

        Object.defineProperties(this, {
            viewPort: {
                get: function () {
                    if (!viewPort) {
                        viewPort = this.client.getModulesByName('MudViewport', 0);
                    }
                    return viewPort;
                }
            }
        });

        container.setTitle('Console');
        this.history = [];

        function dispatchEvent(msg) {
            switch (msg.eventType) {
                case 'clearScreen':
                    return self.$element.find('.viewport').empty();

                case 'renderPrompt':
                    return self.renderPrompt(msg.eventData);
            }
        }

        this.client.on('connected', function () {
            container.setTitle('Console');
            self.socket.off('kmud', dispatchEvent).on('kmud', dispatchEvent);
        });
        this.client.on('disconnected', function () {
            container.setTitle('Console *Disconnected*');
            self.socket.off('kmud', dispatchEvent).on('kmud');
        });
        $(document).on('click', '.mudModule.mudViewPort .viewport:not(a)', function (e) {
            self.focus();
        });
        this.initializeContextMenu();
    }

    MudConsole.prototype = Object.create(parent.prototype);

    MudConsole.prototype.addHistory = function (cmd) {
        if (cmd.simpleForm) {
            var maxLength = this.client.getPreferences('console.maxInputHistory', 100),
                echoOn = this.client.getPreferences('console.echoCommands', false);
            this.history.push(cmd);
            if (this.history.length > maxLength)
                this.history.splice(0, this.history.length - maxLength);
            if (echoOn && cmd.simpleForm) {
                this.viewPort.renderMessage(this.renderCommandForHistory(cmd), true);
            }
        }
        return cmd;
    };

    MudConsole.prototype.canIssueCommand = function () {
        var $inp = this.$element.find('form.simple input.userinput');
        return $inp.length && $inp.prop('disabled') === false;
    };

    MudConsole.prototype.createCommand = function (opts) {
        return $.extend({
            simpleForm: false,
            type: 'console.input',
            cmdline: '',
            fields: [],
            args: {},
            types: {}
        }, opts);
    };

    MudConsole.prototype.createCommandFromInputs = function () {
        var self = this, $c = self.$element, $f = $c.find('form');
        var cmd = this.createCommand({ simpleForm: $f.data('simpleform') });
        $f.find('input[type=text], input[type=password], input:checked, option:selected, textarea').each(function (i, c) {
            var $c = $(c),
                n = $c.attr('name'),
                v = $c.val(),
                t = $c.attr('type');
            cmd.args[n] = v;
            cmd.types[n] = t;
            cmd.fields.push(n);
            if (cmd.simpleForm) cmd.cmdline = v;
            if (t === 'password') cmd.secure = true;
        });
        return cmd;
    };

    MudConsole.prototype.focus = function () {
        return this.$element.find('select, input, textarea').first().focus(), this;
    };

    MudConsole.prototype.initializeContextMenu = function () {
        var con = this;
        function canIssueCommand() { return con.canIssueCommand(); }
        function prepCommand(cmd) { con.prepareCommand(cmd); }
        function sendCommand(cmd) { con.issueCommand(cmd); }
        var menu = new BootstrapMenu('.ctx-menu', {
            fetchElementData: function ($elem) {
                return $.extend({
                    player: false
                }, $elem.data())
            },
            actionsGroups: [
                "gotoUser"
            ],
            actions: {
                tellUser: {
                    name: function (data) {
                        return 'Tell ' + data.player + ' something...';
                    },
                    iconClass: 'icon-finger',
                    isEnabled: canIssueCommand(),
                    isShown: function (data) { return !(data.player === false); },
                    onClick: function (data) { prepCommand('tell ' + data.player + ' '); }
                },
                fingerUser: {
                    name: function (data) {
                        return 'Finger ' + data.player + ' [Get Info]';
                    },
                    iconClass: 'icon-finger',
                    isEnabled: canIssueCommand(),
                    isShown: function (data) { return !(data.player === false); },
                    onClick: function (data) { sendCommand('finger ' + data.player); }
                },
                kickUser: {
                    name: function (data) {
                        return 'Kick ' + data.player;
                    },
                    iconClass: 'icon-finger',
                    isEnabled: canIssueCommand(),
                    isShown: function (data) { return !(data.player === false); },
                    onClick: function (data) { sendCommand('kick ' + data.player); }
                },
                gotoUser: {
                    name: function (data) {
                        return 'Goto ' + data.player;
                    },
                    iconClass: 'icon-finger',
                    isEnabled: canIssueCommand(),
                    isShown: function (data) {
                        return self.isWizard && !(data.player === false);
                    },
                    onClick: function (data) { sendCommand('goto ' + data.player); }
                }
            },
            menuEvent: 'click'
        });
    };

    MudConsole.prototype.issueCommand = function (cmd) {
        var cmd = this.createCommand({ cmdline: cmd, simpleForm: true });
        return this.sendCommand(cmd);
    };

    MudConsole.prototype.prepareCommand = function (cmd) {
        this.$element.find('form.simple input.userinput').val(cmd).focus();
    };

    MudConsole.prototype.renderCommandForHistory = function (cmd) {
        var $result = $('<div class="inputHistory" />');

        if (cmd.fields.length > 0) {
            $result.append(cmd.fields.map(function (name) {
                var $span = $('<span class="inputField" />'),
                    $fieldName = $('<span class="fieldName" />').text(name + ': '),
                    $fieldValue = $('<span class="fieldValue" />'),
                    displayValue = cmd.args[name],
                    fieldType = cmd.types[name];

                $fieldValue.text(fieldType === 'password' ? displayValue.replace(/./g, '*') : displayValue);
                return $span.append($fieldName, $fieldValue);
            }));
            return $result;
        }
        else if (cmd.cmdline.length > 0) {
            var $span = $('<span class="inputField" />'),
                $fieldName = $('<span class="fieldName" />').text('Command: '),
                $fieldValue = $('<span class="fieldValue" />').text(cmd.cmdline);
            return $result.append($span.append($fieldName, $fieldValue));
        }
    };

    MudConsole.prototype.renderPrompt = function (prompt) {
        var self = this,
            $e = this.$element,
            $p = $e.find('.userinput'),
            $f = $e.find('form'),
            $container = $('<div/>'),
            cname = prompt.name || 'Command',
            needSubmit = false;

        $e.find('input, select, textarea').prop('disabled', false);

        var simple = prompt.promptType !== 'structured';
        $f.data('simpleform', simple)[simple ? 'addClass' : 'removeClass']('simple');

        if (prompt.error) {
            $container.append($('<div class="usererror"/>').text(prompt.error));
        }

        if (prompt.type === 'yesno') {
            prompt.options = {
                yes: 'yes',
                no: 'no'
            };
        }

        switch (prompt.type) {
            case 'password':
                $container.append($('<input type="password" name="input" class="userinput" />')
                    .attr('placeholder', prompt.text || 'Enter a command...')
                    .attr('name', cname).prop('disabled', false));
                break;

            case 'radiolist':
            case 'yesno':
                var n = 0,
                    $inner = $('<fieldset/>').append(
                        $('<legend/>').text(prompt.text));

                for (var k in prompt.options) {
                    $inner.append(
                        $('<span class="useroption"/>').append(
                            $('<input type="radio" class="useroption" />')
                                .attr('name', cname)
                                .attr('value', prompt.options[k])
                                .attr('id', cname + n),
                            $('<label />')
                                .text(k)
                                .prop('for', cname + n)));
                    n++;
                }
                $container.append($inner);
                needSubmit = true;
                break;

            case 'text':
            default:
                $container.append($('<input autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="text" name="input" class="userinput" />')
                    .attr('placeholder', prompt.text || 'Enter a command...')
                    .attr('name', cname).prop('disabled', false));
                break;
        }
        if (needSubmit) {
            $container.append($('<input type="submit"/>').val('Go'));
        }
        $f.empty().append($container);

        return this.focus();
    };

    MudConsole.prototype.sendCommand = function (cmd) {
        cmd = this.addHistory(cmd || this.createCommandFromInputs());
        this.socket.emit('kmud', {
            eventType: 'consoleInput',
            eventData: cmd
        });
    };

    return MudConsole;
})(jQuery, MudClientModule);

