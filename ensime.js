define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ui", "commands", "menus", "preferences",
        "settings", "notification.bubble", "jsonalyzer"
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
        var jsonalyzer = imports.jsonalyzer;

        /***** Initialization *****/

        var ensimeRunning = false;
        var ensimeConnector;

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
                    startEnsime(function(err) {
                        if (err) return bubble.popup("Could not start ensime: " + err);
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.stop",
                isAvailable: function() {
                    return ensimeRunning;
                },
                exec: function() {
                    stopEnsime(function(err) {
                        if (err)
                            return bubble.popup("Could not stop ensime: " + err);
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.typecheck",
                isAvailable: function() {
                    return ensimeRunning;
                },
                exec: function() {
                    typecheck(function(err) {
                        if (err)
                            return bubble.popup("Typecheck All failed: " + err);
                        bubble.popup("Typecheck is now completed.");
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.unloadAll",
                isAvailable: function() {
                    return ensimeRunning;
                },
                exec: function() {
                    ensimeUnloadAll(function(err) {
                        if (err)
                            return bubble.popup("Could not execute unloadAll: " + err);
                        bubble.popup("UnloadAll successful.");
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensime.connectionInfo",
                isAvailable: function() {
                    return ensimeRunning;
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
            // plugin.on("callEnsime", function(event) {
            // callEnsime(event, {
            // emit: emit
            // });
            // });
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

                registerEnsimeHandlers();
                startEnsime();
            });
            language.registerLanguageHandler("plugins/ensime.language.scala/worker/scala_completer", function(err, handler) {
                if (err) return console.error(err);
            });
            jsonalyzer.registerWorkerHandler("plugins/ensime.language.scala/worker/scala_jsonalyzer");

            //Start ensime on load
            startEnsime(function(err, callback) {
                if (err) return;
                bubble.popup("Ensime started.");
            });
        });
        plugin.on("unload", function() {
            ensimeConnector = null;
            ensimeRunning = false;
            jsonalyzer.unregisterWorkerHandler("plugins/ensime.language.scala/worker/scala_jsonalyzer");
            language.unregisterLanguageHandler("plugins/ensime.language.scala/worker/scala_completer");
            language.unregisterLanguageHandler("plugins/ensime.language.scala/worker/ensime_connector");
        });

        function registerEnsimeHandlers() {
            ensimeConnector.on("log", function(data) {
                console.log("ENSIME: " + data);
            });
            ensimeConnector.on("starting", function() {
                ensimeRunning = true;
                bubble.popup("ENSIME is starting...");
            });
            ensimeConnector.on("started", function() {
                ensimeRunning = true;
                bubble.popup("ENSIME started.");
            });
            ensimeConnector.on("stopped", function(code) {
                ensimeRunning = false;
                bubble.popup("ENSIME started.");
            });

        }

        /***** Register and define API *****/

        /** Ensime-server handling */
        function startEnsime() {
            if (!ensimeConnector) return console.error("ensime-connector not started.");
            if (ensimeRunning) return;
            ensimeConnector.emit("start");
        }

        function stopEnsime() {
            if (!ensimeConnector) return console.error("ensime-connector not started.");
            if (!ensimeRunning) return;
            ensimeConnector.emit("stop");
        }


        /** Ensime commands. */

        var last_id = 0;

        function executeEnsime(req, callback, canary) {
            var reqId = last_id++;

            plugin.on("callEnsime.result", function hdlr(event) {
                if (event.to !== reqId) return;
                plugin.off("callEnsime.result", hdlr);
                callback(event.err, event.result);
            });

            emit("callEnsime", {
                id: reqId,
                request: req,
                canary: canary
            });
        }

        function connectionInfo(callback, canary) {
            executeEnsime({
                typehint: "ConnectionInfoReq"
            }, function(err, result) {
                if (err) return callback(err);
                callback(undefined, result);
            }, canary);
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