var MudConsole = (function ($, parent) {
    "use strict";

    function MudConsole(container, state) {
        parent.call(this, 'mudConsole', container, state);

        var self = this, historyIndex = 0;
        this.$element.addClass('mudConsole');
        this.helpIndex = 0;

        switch (state.role) {
            case 'input':
                container.setTitle('Console');
                var $input = $('<div class="userinput"><form autocomplete="off"></form></div>');
                this.$element.append($input);
                this['_inputHistory'] = [];
                this.$element.on('submit', '.userinput form', function (e) {
                    historyIndex = 0;
                    e.preventDefault();
                    try {
                        self.$element.find('.userinput input,select,textarea').prop('disabled', true);
                        var cmd = self.createCommand(),
                            $hist = self.createHistoryView();
                        self.$element.find('.viewport').append($hist);
                        self.socket.emit(cmd.type, cmd);
                        self.scrollToBottom();
                    }
                    catch (x) {
                        console.log(x);
                    }
                });
                this.$element.on('keyup', '.userinput form.simple input[type=text]', function (e) {
                    var $t = $(this), v = $t.val(),
                        hist = self['_inputHistory'];

                    if (!v || $t.hasClass('in-history')) {
                        switch (e.keyCode) {

                            case 38: /* up arrow */
                                e.preventDefault();
                                e.stopPropagation();

                                historyIndex--;

                                $t.val(hist.length > 0 ? hist[hist.length - historyIndex] : '');
                                $t.addClass('in-history');
                                $t.select();
                                break;

                            case 40: /* down arrow */
                                e.preventDefault();
                                e.stopPropagation();

                                if (historyIndex++ > 0) historyIndex = 0;

                                $t.val(hist.length > 0 ? hist[hist.length - 1 - historyIndex] : '');
                                $t.addClass('in-history');
                                $t.select();
                                break;
                        }
                    }
                });
                break;

            case 'viewer':
                container.setTitle('MUD');
                var $viewport = $('<div class="viewport"><div class="connecting">Connecting...</div></div>'),
                    $toggle = $('<div class="toggle-settings" title="Open Settings" />');

                $viewport.append($toggle);
                this.$element.append($viewport);
                this.$element.on('click', '.see-also-link', function (e) {
                    var $t = $(this),
                        $h = $t.closest('.help'),
                        topic = $t.data('topic');

                    self.socket.emit('kmud.client', {
                        eventType: 'help-query',
                        eventData: topic,
                        eventTarget: $h.attr('id')
                    });
                });
                this.client.on('kmud.clearScreen', function (e) {
                    $viewport.empty();
                });
                this.client.on('kmud.connected', function (e) {
                    $('.connecting').text('Connected');
                    container.parent.parent.parent.setTitle(e.eventData);
                });
                this.client.on('kmud.channel', function (e) {
                    self.renderMessage({ text: e.eventData });
                });
                $viewport.on('click', '.toggle-settings', function (e) {
                    var $sb = $('.top-container > .sidebar');
                    e.preventDefault();
                    if ($sb.length === 1) {
                        if ($sb.hasClass('is-visible')) {
                            self.closeSettings();
                        } else {
                            self.openSettings();
                        }
                    }
                });
                $(document).on('click', '.sidebar .options .apply-settings', function (e) {
                    var $sb = $('.sidebar .options');
                    $sb.find('input,select,textarea').each(function (i, ctrl) {
                        var $c = $(ctrl), n = $c.attr('name'),
                            tn = $c[0].tagName.toLowerCase(),
                            ct = $c.attr('type') || false, v;
                        switch (tn) {
                            case 'input':
                                v = ct === 'checkbox' ? $c.prop('checked') || false : v = $c.val();
                                break;
                            case 'select':
                                v = $c.find('option:selected').val();
                                break;
                            case 'textarea':
                                v = $c.val().trim();
                                break;
                        }
                        self.client.setPreference(n, v, false);
                    });
                    self.client.savePreferences();
                    self.closeSettings();
                });
                break;
        }

        this.client.on('connected', function () {
            self.socket.on('console.out', function (msg) {
                self.renderMessage(msg);
                self.scrollToBottom();
            });
            self.socket.on('console.prompt', function (msg) {
                self.renderPrompt(msg);
                self.scrollToBottom();
            });
            self.socket.on('kmud', function (msg) {
                switch (msg.eventType) {
                    case 'clearScreen':
                        self.$element.find('.viewport').empty();
                        break;

                    case 'console.disconnect':
                        container.parent.parent.parent.setTitle(msg.eventData);
                        try { self.socket.close(); } catch (e) { }
                        break;

                    case 'console.help':
                        self.displayHelp(msg);
                        break;

                    case 'console.webout':
                        self.renderMessage(msg.eventData, true);
                        break;
                }
            });
        });
        this.client.on('disconnected', function () {
            container.setTitle('*Disconnected*');
        });
    }

    MudConsole.prototype = Object.create(parent.prototype);

    MudConsole.prototype.closeSettings = function () {
        var $sb = $('.top-container > .sidebar')
            .removeClass('is-visible');
        $('.overlay').remove();
    };

    MudConsole.prototype.openSettings = function () {
        var prefs = this.client.getPreferences();
        $('body').append($('<div class="overlay"/>'));
        var $sb = $('.top-container > .sidebar');

        Object.keys(prefs).forEach(function (pref) {
            var $c = $sb.find('*[name="{0}"]'.fs(pref));
            if ($c.length) {
                console.log('Setting {0} to {1}'.fs(pref, prefs[pref]));
                switch ($c[0].tagName) {
                    case 'INPUT':
                        switch ($c.attr('type')) {
                            case 'text':
                                $c.val(prefs[pref]);
                                break;
                            case 'checkbox':
                                $c.prop('checked', !!prefs[pref]);
                                break;
                        }
                        break;
                    case 'SELECT':
                        $c.find('option[value={0}]'.fs(prefs[pref])).prop('selected', true);
                        break;
                }
            }
        });

        $sb.addClass('is-visible');
        $(document).on('click', '.overlay', function (e) {
            self.closeSettings();
        });
    };

    MudConsole.prototype.createCommand = function () {
        var T = this, $c = T.$element, $f = $c.find('.userinput form'),
            simple = $f.data('simpleform'), cmd = {
                simpleForm: simple,
                type: 'console.input',
                cmdline: '',
                args: {}
            };

        $f.find('input[type=text],input[type=password],input:checked,option:selected,select').each(function (i, c) {
            var $c = $(c), n = $c.attr('name'), v = $c.val(), t = $c.attr('type');
            cmd.args[n] = v;
            if (simple) {
                cmd.cmdline = v;
                if (t === 'text') T['_inputHistory'].push(v);
            }
        });
        return cmd;
    };

    MudConsole.prototype.createHistoryView = function () {
        var T = this,
            $result = $('<div/>'),
            $c = T.$element,
            $f = $c.find('.userinput form');

        $f.find('input[type=text],input[type=password],input:checked,option:selected,select').each(function (i, c) {
            var $c = $(c), n = $c.attr('name'), v = $c.val();
            if ($c.attr('type') === 'password') v = v.replace(/./g, '*');
            if (v.length > 20) v = v.substr(0, 17) + '...';

            if (n === 'UserChoice') return;
            $result.append($('<span class="userprompt"/>').text(n));
            $result.append($('<span class="userresponse"/>').text(v));
        });
        return $result;
    }

    MudConsole.prototype.displayHelp = function (msg) {
        var data = msg.eventData,
            $help;

        if (msg.eventTarget) {
            $help = $('#' + msg.eventTarget);
        } else {
            $help = $('<div class="help"><div class="category" /><div class="body" /><div class="see-also" /></div>');
            $help.attr('id', 'help' + this.helpIndex++);
        }

        $help.find('.body').html(data.text);

        if (data.see instanceof Array) {
            var $topics = data.see.map(function (s) {
                var $a = $('<a class="see-also-link" href="javascript:void(0)" /> ').text(s).attr('data-topic', s);
                return $a;
            });
            $help.find('.see-also').empty().append('<span>See also:</span>', $topics).show();
        }
        else $help.find('.see-also').hide();
        this.$element.find('.viewport').append($help);
        return this.scrollToBottom();
    };

    MudConsole.prototype.renderPrompt = function (prompt) {
        var T = this,
            $p = this.$element.find('.userinput'),
            $vp = this.$element.find('.viewport'),
            $f = $p.find('form'),
            $container = $('<div/>'),
            cname = prompt.name || 'UserChoice',
            needSubmit = false;

        T.$element.find('.userinput input,select,textarea').prop('disabled', false);

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
        $f.find('select,input,textarea').first().focus();

        return this;
    };

    /**
     * @param {Object} msg The message to render to the client.
     * @param {String} msg.text The message to render.
     * @returns {MudConsole} A reference to the console.
     */
    MudConsole.prototype.renderMessage = function (msg, flag) {
        var $view = this.$element.find('.viewport');
        if (flag) {
            $view.append($(this.expandColors(msg)));
        } else {
            $view.append($('<div style="white-space: pre; font-family: Courier New;" />').html(this.expandColors(msg.text)));
        }
        return this.scrollToBottom();
    };

    MudConsole.prototype.registerModule = function (client, ws) {
        var T = this;

        Object.defineProperty(this, 'socket', {
            get: function () { return ws; },
            set: function () { },
            enumerable: false
        });

        client.on('console.out', function (msg) { T.write(msg.text); });
        client.on('console.prompt', function (prompt) { T.renderPrompt(prompt); });

        $(document).on('submit', this.selector + ' form', function (e) {
            try {
                T.$console.find('input,select,textarea').prop('disabled', true);
                e.preventDefault();
                var cmd = T.createCommand(), $hist = T.createHistoryView();
                $('.viewport.main').append($hist);
                T.socket.emit(cmd.type, cmd);
            }
            catch (x) {
                console.log(x);
            }
        });

        return this;
    };

    MudConsole.prototype.scrollToBottom = function () {
        var $view = this.$element.find('.viewport');
        if ($view.length > 0) {
            $view[0].scrollTop = $view[0].scrollHeight;
        }
        return this;
    }

    MudConsole.colorLookups = {
        'RESET': '</span>',
        'BOLD': '<span style="font-weight: bold">',
        'BLACK': '<span style="color: black">',
        'RED': '<span style="color: red">',
        'BLUE': '<span style="color: blue">',
        'CYAN': '<span style="color: cyan">',
        'MAGENTA': '<span style="color: magenta">',
        'ORANGE': '<span style="color: orange">',
        'YELLOW': '<span style="color: yellow">',
        'GREEN': '<span style="color: green">',
        'WHITE': '<span style="color: #ccc">'
    };

    MudConsole.prototype.expandColors = function (s) {
        var c = s.indexOf('%^'), d = 0;

        while (c > -1 && c < s.length) {
            var l = s.indexOf('%^', c + 2);
            if (l > -1) {
                var org = s.substr(c + 2, l - c - 2), m = org.toUpperCase(),
                    r = MudConsole.colorLookups[m];
                // Increment or decrement RESET stack to determine 
                // how many resets to add to end
                d += m === 'RESET' ? -1 : (r ? 1 : 0);
                r = r || org;
                s = s.substr(0, c) + r + s.substr(l + 2);
                c = s.indexOf('%^', c + r.length);
            }
            else {
                c = s.indexOf('%^', c + 2);
            }
        }
        while (d-- > 0) {
            s += MudConsole.colorLookups['RESET'];
        }
        return s;
    }

    MudConsole.prototype.write = function (a) {
        var self = this, args = [].slice.apply(arguments).map(function (s) {
            return self.expandColors(s);
        });
        this.$view.append($('<div class="message"/>').append(args));
        return this.scrollToBottom();
    };

    return MudConsole;
})(jQuery, MudClientModule);
