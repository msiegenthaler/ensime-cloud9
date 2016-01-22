define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ui", "commands", "menus", "preferences",
        "settings", "notification.bubble"
    ];
    main.provides = ["ensime"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var bubble = imports["notification.bubble"];

        /***** Initialization *****/

        var ensimeRunning = false;
        var ensimeReady = false;
        var ensimeConnector;
        var call_id_prefix = "plugin";
        var last_call_id = 0;

        /** Plugin **/

        var plugin = new Plugin("Ensime", main.consumes);
        var emit = plugin.getEmitter();

        function loadSettings() {

            //Commands
            commands.addCommand({
                name: "ensime.start",
                isAvailable: function() {
                    return !ensimeRunning;
                },
                exec: function() {
                    startEnsime(false);
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.stop",
                isAvailable: function() {
                    return ensimeRunning;
                },
                exec: function() {
                    stopEnsime();
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.typecheck",
                isAvailable: function() {
                    return ensimeReady;
                },
                exec: function() {
                    typecheck(function(err) {
                        if (err)
                            return bubble.popup("Typecheck All failed: " + err);
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.unloadAll",
                isAvailable: function() {
                    return ensimeReady;
                },
                exec: function() {
                    ensimeUnloadAll(function(err) {
                        if (err)
                            return bubble.popup("Could not execute unloadAll: " + err);
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.connectionInfo",
                isAvailable: function() {
                    return ensimeReady;
                },
                exec: function() {
                    connectionInfo(function(err, result) {
                        if (err) return err;
                        var msg = "Ensime: Protocol " + result.version + ", Implementation: " + result.implementation.name;
                        bubble.popup(msg);
                    });
                }
            }, plugin);


            // Menus
            menus.setRootMenu("Scala", 550, plugin);
            menus.addItemByPath("Scala/Full Typecheck", new ui.item({
                command: "ensime.typecheck"
            }), 1000, plugin);
            menus.addItemByPath("Scala/Unload All", new ui.item({
                command: "ensime.unloadAll"
            }), 1001, plugin);
            menus.addItemByPath("Scala/Connection Info", new ui.item({
                command: "ensime.connectionInfo"
            }), 1100, plugin);
            menus.addItemByPath("Scala/~", new ui.divider(), 2000, plugin);
            menus.addItemByPath("Scala/Start Ensime", new ui.item({
                command: "ensime.start"
            }), 10550, plugin);
            menus.addItemByPath("Scala/Stop Ensime", new ui.item({
                command: "ensime.stop"
            }), 10551, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("project/ensime", [
                    ["ensimeFile", "~/workspace/.ensime"]
                ]);
            });

            // Preferences
            prefs.add({
                "Language": {
                    position: 450,
                    "Scala (Ensime)": {
                        position: 100,
                        ".ensime Location": {
                            type: "textbox",
                            setting: "project/ensime/@ensimeFile",
                            position: 100
                        }
                    }
                }
            }, plugin);
        }


        /***** Lifecycle *****/

        plugin.on("load", function() {
            loadSettings();
            language.registerLanguageHandler("plugins/ensime.language.scala/worker/ensime_connector", function(err, handler) {
                if (err) return console.error(err);
                console.log("ensime-connector initialized.");
                ensimeConnector = handler;

                function sendSettings(handler) {
                    handler.emit("set_ensime_config", {
                        ensimeFile: settings.get("project/ensime/@ensimeFile")
                    });
                }
                settings.on("project/ensime", sendSettings.bind(null, handler), plugin);
                sendSettings(handler);

                registerEnsimeHandlers(handler);
                emit("connector.ready", handler);
            });
            language.registerLanguageHandler("plugins/ensime.language.scala/worker/scala_completer", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
            });
            language.registerLanguageHandler("plugins/ensime.language.scala/worker/scala_outline", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
            });
        });
        plugin.on("unload", function() {
            ensimeConnector = null;
            ensimeRunning = false;
            ensimeReady = false;
            language.unregisterLanguageHandler("plugins/ensime.language.scala/worker/scala_completer");
            language.unregisterLanguageHandler("plugins/ensime.language.scala/worker/scala_outline");
            language.unregisterLanguageHandler("plugins/ensime.language.scala/worker/ensime_connector");
        });
        plugin.on("connector.ready", function() {
            startEnsime(true);
        });

        function registerEnsimeHandlers(handler) {
            handler.on("log", function(data) {
                console.log("ENSIME: " + data);
            });
            handler.on("starting", function() {
                ensimeRunning = true;
                ensimeReady = false;
                bubble.popup("ENSIME is starting...");
            });
            handler.on("started", function() {
                ensimeRunning = true;
                ensimeReady = true;
                bubble.popup("ENSIME started.");
                typecheck(function(err) {
                    if (err) return bubble.popup("Typecheck not successful");
                });
            });
            handler.on("stopped", function(code) {
                ensimeRunning = false;
                ensimeReady = false;
                bubble.popup("ENSIME stopped.");
            });

            handler.on("event", function(event) {
                if (event.typehint == "FullTypeCheckCompleteEvent")
                    bubble.popup("Typecheck completed.");
                else if (event.typehint == "CompilerRestartedEvent")
                    bubble.popup("ENSIME is recompiling.");
            });
        }

        function setupConnectorBridge(handler) {
            handler.on("call", function(event) {
                ensimeConnector.emit("call", event);
            });
            ensimeConnector.on("call.result", function(event) {
                handler.emit("call.result", event);
            });
        }

        /***** Register and define API *****/

        /** Ensime-server handling */
        function startEnsime(attach) {
            if (!ensimeConnector) return console.error("ensime-connector not started.");
            if (ensimeRunning) return;
            ensimeConnector.emit("start", attach);
        }

        function stopEnsime() {
            if (!ensimeConnector) return console.error("ensime-connector not started.");
            if (!ensimeRunning) return;
            ensimeConnector.emit("stop");
        }

        function executeEnsime(req, callback) {
            if (!ensimeConnector) return callback("ensime-connector not started.");
            var reqId = call_id_prefix + (last_call_id++);
            ensimeConnector.on("call.result", function hdlr(event) {
                if (event.id !== reqId) return;
                plugin.off("call.result", hdlr);
                callback(event.error, event.result);
            });
            ensimeConnector.emit("call", {
                id: reqId,
                request: req,
            });
        }

        /** Ensime commands. */


        function connectionInfo(callback) {
            executeEnsime({
                typehint: "ConnectionInfoReq"
            }, function(err, result) {
                if (err) return callback(err);
                callback(undefined, result);
            });
        }

        function typecheck(callback) {
            executeEnsime({
                typehint: "TypecheckAllReq"
            }, function(err, result) {
                if (err) return callback(err);
                callback(undefined, result);
            });
        }

        function ensimeUnloadAll(callback) {
            executeEnsime({
                typehint: "UnloadAllReq"
            }, function(err, result) {
                if (err) return callback(err);
                callback(undefined, result);
            });
        }

        /**
         * This is an example of an implementation of a plugin.
         * @singleton
         */
        plugin.freezePublicAPI({});

        register(null, {
            "ensime": plugin
        });
    }
});