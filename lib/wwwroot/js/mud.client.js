/**
 * The KMUD Client.  Responsible for providing the core communication with
 * the MUD/WMD server and for coordinating the rendering of game content.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
(function () {
    "use strict";
    if (typeof String.prototype.fs !== 'function') {
        String.prototype.fs = function () {
            var a = [].slice.call(arguments), s = this;
            for (var i = 0; i < a.length; i++) {
                var aa = a[i];
                if (typeof aa === 'object') {
                    Object.keys(aa).forEach(k => {
                        var re = new RegExp('\\{\\{' + k + '\\}\\}', 'g');
                        s = s.replace(re, typeof aa[k] === 'undefined' ? '[undefined]' : aa[k].toString());
                    });
                }
                else {
                    var re = new RegExp('\\{' + i + '\\}', 'g');
                    s = s.replace(re, typeof a[i] === 'undefined' ? '[undefined]' : a[i].toString());
                }
            }
            return s;
        }
    }
})();

var MudClientModule = (function ($) {
    "use strict";

    function MudClientModule(name, container, state) {
        var self = this,
            _client = state.owner,
            _socket = _client.socket || null,
            _container = container;

        Object.defineProperties(this, {
            container: {
                get: function () { return _container; },
                set: function (c) {
                    _container = c;
                }
            },
            $element: {
                value: container.getElement(),
                writable: false
            },
            client: {
                value: state.owner,
                writable: false
            },
            id: {
                value: state.id || name + '.' + state.owner.nextInstanceId(name),
                writable: false
            },
            name: {
                value: name,
                writable: false
            },
            socket: {
                get: function () { return _socket; }
            }
        });
        this.client.addModuleInstance(this);
        this.$element.addClass('mudModule').data(this.name, this);
        this.client.on('socket.created', function (socket) {
            _socket = socket;
        });
        this.container.on('destroy', function () {
            self.client.destroyModuleInstance(self);
            container = null;
        });
    }

    MudClientModule.colorLookups = {
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

    MudClientModule.prototype.close = function () {
        if (this.container != null) {
            this.container.close();
        }
    };

    MudClientModule.prototype.expandColors = function (s) {
        var c = s.indexOf('%^'), d = 0;

        while (c > -1 && c < s.length) {
            var l = s.indexOf('%^', c + 2);
            if (l > -1) {
                var org = s.substr(c + 2, l - c - 2), m = org.toUpperCase(),
                    r = MudClientModule.colorLookups[m];
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
            s += MudClientModule.colorLookups['RESET'];
        }
        return s;
    }

    return MudClientModule;
})(jQuery);

var MudContextMenu = (function ($) {
    function MudContextMenu(selector) {

    }

    return MudContextMenu;
})(jQuery);

var MudClient = (function ($) {
    "use strict";
    var
        _clientData = {},
        _defaultPrefs = {
            'console.echoCommands': true,
            'console.showSplash': true,
            'console.maxViewHistory': 1000,
            'console.maxInputHistory': 100,
            'console.scrollToBottom': 'always',

            'comms.chan': 'chatWindow',
            'comms.tell': 'chatWindow',
            'comms.say': 'mudConsole'
        },
        _hasStorage = typeof localStorage === 'object',
        _modules = {},
        _nextInstance = 1;

    /**
     * Get the protected data for the specified client instance.
     * @param {MudClient} client
     * @param {string=} key The optional key to return.
     * @param {any=} defaultValue The default value for the key if not found.
     */
    function getClientData(client, key, defaultValue) {
        if (client instanceof MudClient) {
            var data = _clientData[client.instanceId];
            if (typeof key === 'string') {
                return (key in data) ? data[key] : defaultValue;
            }
            return data;
        }
        return false;
    }

    /**
     *
     * @param {MudClient} client
     * @param {string} key
     * @param {any} value
     */
    function setClientValue(client, key, value) {
        if (client instanceof MudClient) {
            var data = _clientData[client.instanceId];
            if (typeof data !== 'object') {
                data = _clientData[client.instanceId] = {};
            }
            if (typeof key === 'string') {
                data[key] = value;
            }
        }
        return client;
    }

    function MudClient(o) {
        var T = this,
            modules = {},
            opts = o || {},
            prefs = _defaultPrefs;

        Object.defineProperty(this, 'instanceId', {
            value: _nextInstance++,
            writable: false
        });

        if (_hasStorage) {
            var rawPrefs = localStorage.getItem('MUDClientPreferences') || false;
            if (rawPrefs) {
                try {
                    prefs = JSON.parse(rawPrefs);
                } catch (e) {
                    prefs = _defaultPrefs
                }
            }
        }

        setClientValue(this, '_listeners', {});
        setClientValue(this, '_preferences', prefs);

        T['_listeners'] = {};
        T['_options'] = opts;

        var config = {
            settings: {
                showPopoutIcon: false
            },
            content: [{
                type: 'row',
                id: 'client main',
                isClosable: false,
                content: [{
                    type: 'stack',
                    content: [{
                        type: 'column',
                        title: 'Connecting...',
                        id: 'console main window',
                        isClosable: false,
                        content: [{
                            type: 'component',
                            componentName: 'MudViewport',
                            componentState: { owner: T },
                            isClosable: false,
                            height: 80
                        },
                        {
                            type: 'stack',
                            id: 'console stack',
                            isClosable: false,
                            content: [{
                                type: 'component',
                                id: 'foobar',
                                componentName: 'MudConsole',
                                componentState: { owner: T }
                            }]
                        }]
                    }]
                }]
            }]
        };

        var myLayout = new GoldenLayout(config, $('#mudclient'));

        Object.defineProperties(this, {
            isWizard: {
                get: function () { return getClientData(T, 'wizardMode', false); }
            },
            layout: {
                value: myLayout,
                writable: false
            },
            modules: {
                value: modules,
                writable: false
            },
            socket: {
                get: function () {
                    return getClientData(this, 'socket');
                }
            }
        });

        if (this.getPreferences('client.soundEnabled', true)) {
            this.addClientScript('js/ion.sound.js', function () {
                ion.sound({
                    sounds: [
                        {
                            name: 'beer_can_opening',
                            volume: 0.9
                        }
                    ],
                    volume: parseFloat(this.getPreferences('client.soundVolume', 50)) / 100,
                    path: 'sound/'
                });
                ion.sound.play('beer_can_opening');
            });
        }
    }

    MudClient.prototype.addModuleInstance = function(module) {
        if (module instanceof MudClientModule) {
            var name = module.name,
                inst = this.modules[name] || false;
            if (!inst) {
                inst = this.modules[name] = { length: 0 };
            }
            inst[inst.length++] = module;
            this.emit('moduleAdded', module);
        }
    }

    MudClient.prototype.addClientScript = function (script, callback) {
        var scriptList = script instanceof Array ? script : [script],
            c = scriptList.length, self = this;

        function appendScript(src) {
            var $existing = $('script').filter(function (i, s) { return s.src === src; });
            if ($existing.length > 0) {
                if (c-- === 1) callback.apply(self);
            }
            else {
                var script = document.createElement('script');
                script.src = src;
                script.onload = function () {
                    if (c-- === 1) callback.apply(self);
                };
                try {
                    document.head.appendChild(script);
                }
                catch (e) {
                    document.head.removeChild(script);
                }
            }
        }

        function appendTemplate(src) {
            var $existing = $('script').filter(function (i, s) { return $(s).data('source') === src; });
            if ($existing.length > 0) {
                if (c-- === 1) callback.apply(self);
            }
            else {
                $.ajax(src).done(function (content) {
                    try {
                        var $content = $(content).attr('data-source', src).data('source', src);
                        $('body').append($content);
                    }
                    catch (e) {
                    }
                    if (c-- === 1) callback.apply(self);
                });
            }
        }

        for (var i = 0, max = c; i < max; i++) {
            if (scriptList[i].endsWith('.html')) {
                appendTemplate(scriptList[i]);
            }
            else if (scriptList[i].endsWith('.js')) {
                appendScript(scriptList[i]);
            }
        }
        return this;
    };

    MudClient.prototype.buildTemplate = function (id, data) {
        var $source = $('#' + id);
        if ($source.length === 1) {
            var tmpl = $source.text().replace(/xscript/g, 'script');

            tmpl = Array.isArray(data) ?
                String.prototype.fs.apply(tmpl, data) :
                String.prototype.fs.apply(tmpl, [].slice.call(arguments, 1));
            return $(tmpl);
        }
    }

    MudClient.prototype.destroyModuleInstance = function (module) {
        var modules = this.modules,
            instances = modules[module.name] || false;
        if (instances) {
            var targets = Object.keys(instances)
                .filter(function (key, index) { return (instances[key] === module) });
            if (targets.length === 1) {
                delete instances[targets[0]];
                instances['length'] -= 1;
            }
        }
    }

    MudClient.prototype.emit = function (eventName) {
        var _args = [].slice.apply(arguments),
            _event = _args.shift(),
            _events = this['_listeners'],
            _listeners = _events[eventName] || false,
            _this = this;

        if (_listeners) {
            _listeners.forEach(function (listener) {
                listener.apply(_this, _args);
            });
        }
        return this;
    };

    MudClient.prototype.eventChatMessage = function (chat) {
        return this.getChatHandler(chat.channelName, function (chatWindow) {
            if (chatWindow) {
                var $chat = $('<div class="chatHistory msg" />').data({ event: chat, channel: chat.channelName }),
                    $sender = $('<span class="mc chatSender" />').html(chatWindow.expandColors(chat.eventPlayer || '')),
                    $channel = $('<span class="mc chatChannel" />').html(chatWindow.expandColors(chat.channelDisplay)),
                    $message = $('<span class="mc chatMessage" />').html(chatWindow.expandColors(chat.eventData));

                if (!chat.eventPlayer)
                    $chat.append($channel, $message);
                else
                    chat.eventEmote ?
                        $chat.append($channel, $sender, $message) :
                        $chat.append($sender, $channel, $message);
                return chatWindow.eventChat($chat);
            }
        });
    };

    MudClient.prototype.eventMigrateChat = function ($msgList) {
        if ($msgList.length > 0) {
            var pref = this.getPreferences('comms.chan', 'chatWindow'),
                self = this;
            if (pref === 'distinctWindows') {
                var channels = {};
                $msgList.each(function (i, item) {
                    var $item = $(item),
                        name = $item.data('channel'),
                        list = channels[name] || false;
                    if (!list) {
                        list = channels[name] = [];
                    }
                    list.push($item);
                });
                Object.keys(channels).forEach(function (name) {
                    self.getChatHandler(name, function (chatWindow) {
                        chatWindow.eventMigrateChat(channels[name]);
                    });
                });
            }
            else {
                return this.getChatHandler('any', function (chatWindow) {
                    return chatWindow.eventMigrateChat($msgList);
                });
            }
        }
    };

    MudClient.prototype.getChatHandler = function (channel, callback) {
        var self = this,
            pref = this.getPreferences('comms.chan', 'chatWindow');

        switch (pref) {
            case 'chatWindow':
                return this.getModule('MudOutputWindow', function (e) {
                    var chatWindow = e.findOrCreate(this, 'chat', 'combined');
                    callback.call(self, chatWindow);
                });
            case 'disabled':
                return callback.call(self, null);
            case 'distinctWindows':
                return this.getModule('MudOutputWindow', function (e) {
                    var chatWindow = e.findOrCreate(this, 'chat', channel);
                    callback.call(self, chatWindow);
                });
            case 'mudConsole':
                return this.getModule('MudViewport', function (e) {
                    var chatWindow = self.getModulesByName('MudViewport', 0);
                    callback.call(self, chatWindow);
                });

            default:
                throw new Error('Unsupported preference option: ' + pref);
        }
    };

    MudClient.prototype.getModulesById = function (moduleName, id) {
        var modules = this.modules,
            instances = modules[moduleName] || {},
            result = Object.keys(instances)
                .filter(function (key) {
                    var val = instances[key];
                    return typeof val === 'object' && val.id === id;
                })
                .map(function (key) { return instances[key]; });
        return result.length === 1 ? result[0] : false;
    }

    MudClient.prototype.getModulesByName = function (moduleName, index) {
        var modules = this.modules,
            instances = modules[moduleName] || {};

        if (typeof index === 'number') {
            return instances[index] || false;
        }
        return Object.keys(instances)
            .filter(function (key) { return key !== 'length'; })
            .map(function (key) { return instances[key]; })
    }

    MudClient.prototype.getPreferences = function (pref, defaultValue) {
        var prefs = getClientData(this, '_preferences', {});
        if (typeof pref === 'string')
            return pref in prefs ? prefs[pref] : defaultValue || false;
        return $.extend({}, prefs);
    };

    MudClient.prototype.nextInstanceId = function (moduleName) {
        var modules = this.modules,
            module = modules[moduleName] || { length: 0 };
        return module.length + 1;
    };

    MudClient.prototype.off = function (eventName, handler) {
        var _events = this['_listeners'],
            _listeners = _events[eventName] || [],
            _index = _listeners.indexOf(handler);
        while (_index > -1) {
            _listeners.splice(_index, 1);
            _index = _listeners.indexOf(handler);
        }
        if (_listeners.length === 0)
            delete _events[eventName];
        return this;
    };

    MudClient.prototype.on = function (eventName, handler) {
        var _events = this['_listeners'],
            _listeners = _events[eventName] || false;

        if (_listeners === false) {
            _listeners = _events[eventName] = [];
        }
        if (_listeners.indexOf(handler) === -1)
            _listeners.push(handler);
        return this;
    }

    MudClient.prototype.openShell = function (callback) {
        this.getModule('wizShell', function (wizShell) {
            var newItemConfig = {
                type: 'row',
                title: 'Wizard Shell',
                width: 20,
                content: [
                    {
                        type: 'component',
                        componentName: 'wizShell',
                        componentState: { owner: this, role: 'treeView' },
                        title: 'Explorer'
                    }
                ]
            }, con = this.getModulesByName('mudConsole', 0);

            if (con) {
                var t = con.container;
                while (!t.isRoot) {
                    if (t.parent.isRoot) break;
                    t = t.parent;
                }
                t.addChild(newItemConfig);
                setTimeout(function () {
                    var $shell = $('.wizShell.explorer');
                    if (typeof callback === 'function') callback.call(this, $shell, $shell.data('wizShell'));
                }, 50);
            } else {
                console.log('Could not locate console');
            }
        });
    };

    MudClient.prototype.getModule = function (name, callback) {
        var _module = _modules[name] || false,
            _isModule = _module instanceof MudClientModule;

        if (_module.prototype && _module.prototype instanceof MudClientModule)
            _isModule = true;
        if (!_isModule) {
            return _module.call(this, callback);
        }
        if (typeof callback === 'function')
            return callback.call(this, _module);
        return _module;
    }

    MudClient.prototype.playSound = function (sound) {

    };

    MudClient.prototype.registerModule = function (name, depends) {
        if (depends instanceof Array) {
            var self = this, dl = depends;
            _modules[name] = function (whenDone) {
                this.addClientScript(dl, function () {
                    var module = window[name];
                    delete _modules[name];
                    self.registerModule(name, module);
                    if (typeof whenDone === 'function')
                        return whenDone.call(self, module);
                });
            };
        }
        else {
            var module = depends;
            if (module.prototype instanceof MudClientModule) {
                if (typeof name !== 'string')
                    throw new Error('Module does not have a proper name!');

                if (typeof _modules[name] !== 'undefined')
                {
                    if (typeof _modules[name] !== 'function')
                        throw new Error('A module by that name has already been registered!');
                }

                _modules[name] = module;
                this.layout.registerComponent(name, module);
            }
        }
        return this;
    };

    MudClient.prototype.removeListener = function(eventName, listener) {
        var _events = this['_listeners'],
            _listeners = _events[eventName] || false;

        if (_listeners) {
            var i = _listeners.indexOf(listener);
            if (i > -1) {
                _listeners.splice(i, 1)
                if (_listeners.length === 0)
                    delete _listeners[eventName];
            }
        }
    }

    MudClient.prototype.request = function (event, callback) {
        var resp = event.eventType + '_' + new Date().getTime(), self = this;
        var onResponse = function (data) {
            callback.call(self, data);
            self.removeListener(event.eventResponse, onResponse);
        };
        event.eventResponse = resp.replace(/\./g, '_');

        this.on(event.eventResponse, onResponse);
        this.socket.emit('kmud', event);
    };

    MudClient.prototype.run = function () {
        var self = this, opts = this['_options'];

        this.layout.init();

        var ws = io.connect(opts.url || '', {
            extraHeaders: {
                MudClient: 'KMUD v1.0'
            },
            transports: ['websocket']
        });

        setClientValue(self, 'socket', ws);
        this.emit('socket.created', ws);

        ws.on('connect', function () {
            var args = [].slice.apply(arguments);
            self.trigger('connected', args);
        });
        ws.on('disconnect', function () {
            var args = [].slice.apply(arguments);
            self.trigger('disconnected', args);
        });
        ws.on('kmud', function (data) {
            var evt = data.eventType,
                clone = $.extend({}, data);

            delete clone['eventType'];

            switch (evt) {
                case 'chatMessage':
                    return self.eventChatMessage(clone);

                case 'kmud.disconnect':
                    if (self.socket) {
                        try { self.socket.close(); } catch (e) { }
                    }
                    break;

                case 'kmud.enableWizard':
                    return setClientValue(self, 'wizardMode', true);
s
                case 'kmud.wizShell.dir':
                    if (self.isWizard) {
                        self.getModule('WizardExplorer', function (e) {
                            var explorer = self.getModulesByName('WizardExplorer', 0);
                            if (!explorer) {
                                var newItemConfig = {
                                    type: 'component',
                                    componentName: 'WizardExplorer',
                                    componentState: {
                                        owner: self,
                                        initialEvent: clone
                                    },
                                    title: data.eventData.fileName
                                };
                                var $editors = $('.mudModule.wizEditor'),
                                    t = self.layout.root.getItemsById('editor stack');
                                if (t.length === 0) {
                                    t = self.layout.root.getItemsById('client main');
                                    t[0].addChild({
                                        type: 'stack',
                                        id: 'editor stack',
                                        content: [newItemConfig]
                                    });
                                } else t[0].addChild(newItemConfig);
                            }
                            else
                                explorer.openDirectory(clone);
                        });
                    }
                    break;

                case 'kmud.wizShell.editFile':
                    if (self.isWizard) {
                        self.getModule('WizardEditor', function (module) {
                            var lang = (function (fn) {
                                if (fn.endsWith('.js'))
                                    return 'javascript';
                                else if (fn.endsWith('.jsx'))
                                    return 'jsx';
                                else if (fn.endsWith('.html') || fn.endsWith('.htm'))
                                    return 'html';
                                else if (fn.endsWith('json'))
                                    return 'json';
                                else
                                    return 'plaintext';
                            })(data.eventData.fileName);
                            var newItemConfig = {
                                type: 'component',
                                componentName: 'WizardEditor',
                                componentState: {
                                    owner: self,
                                    role: 'editor',
                                    fileName: data.eventData.fileName,
                                    fullPath: data.eventData.fullPath,
                                    language: lang,
                                    newFile: data.eventData.newFile,
                                    source: data.eventData.source
                                },
                                title: data.eventData.fileName
                            };
                            var $editors = $('.mudModule.wizEditor'),
                                t = self.layout.root.getItemsById('editor stack');
                            if (t.length === 0) {
                                t = self.layout.root.getItemsById('client main');
                                t[0].addChild({
                                    type: 'stack',
                                    id: 'editor stack',
                                    content: [newItemConfig]
                                });
                            } else t[0].addChild(newItemConfig);
                        });
                    }
                    break;

                default:
                    return self.trigger(evt, clone);
            }
        });

        $(document).on('click', '.cancel-settings', function (e) {
            $('body > .top-container > .sidebar').removeClass('is-visible');
            $('.overlay').remove();
        });
        $(window).resize(function () {
            self.layout.updateSize()
        })
    }

    MudClient.prototype.savePreferences = function (prev) {
        if (typeof localStorage === 'object') {
            var prefs = this.getPreferences();
            localStorage.setItem('MUDClientPreferences', JSON.stringify(prefs));
            this.emit('kmud', { eventType: 'savePreferences', eventData: prefs, prevData: prev });
        }
    };

    MudClient.prototype.setPreference = function (pref, value, noSave) {
        var prefs = getClientData(this, '_preferences', {});
        if (typeof pref === 'string') {
            prefs[pref] = value;
            if (noSave !== false) this.savePreferences();
        }
        return this;
    };

    MudClient.prototype.trigger = function (eventName, args) {
        var args = [].slice.apply(arguments);
        return this.emit.apply(this, args);
    }

    MudClient.prototype.with = function (name, callback, inst) {
        var m = this.getModulesByName(name, inst || 0);
        if (typeof m === 'object') {
            callback.call(this, m, this);
        }
        else if (Array.isArray(m) && m.length > 1) {
            throw new Error('Ambiguous call to with()');
        }
        else {
            throw new Error('Module ' + name + ' is not registered');
        }
        return false;
    }

    MudClient.prototype.write = function (msg, viewPort) {
        this.with('console', function (console) {
            console.renderMessage(msg);
        });
        return this;
    };

    return MudClient;
})(jQuery);
