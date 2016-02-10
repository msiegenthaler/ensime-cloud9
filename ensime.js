define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ui", "commands", "menus", "preferences",
        "settings", "notification.bubble", "installer", "save",
        "Editor", "editors", "tabManager", "Datagrid", "format",
        "language.complete"
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
        var installer = imports.installer;
        var save = imports.save;
        var editors = imports.editors;
        var tabManager = imports.tabManager;
        var format = imports.format;
        var complete = imports["language.complete"];


        /***** Initialization *****/

        var ensimeRunning = false;
        var ensimeReady = false;
        var ensimeConnector;
        var call_id_prefix = "plugin";
        var last_call_id = 0;

        // make sure all deps are installed
        installer.createSession("c9.ide.language.scala", require("./install"));

        /** Plugin **/

        var plugin = new Plugin("Ensime", main.consumes);
        imports.ensime = plugin;
        var emit = plugin.getEmitter();
        emit.setMaxListeners(20);

        /** Subplugins **/
        var MarkersEditor = require("./markers-editor")(imports, main.consumes);
        editors.register("ensimeMarkers", "URL Viewer", MarkersEditor, []);

        /** implementations of ENSIME Plugin */
        function loadSettings() {

            //Commands
            commands.addCommand({
                name: "startEnsime",
                group: "Scala",
                description: "Start the resident scala compiler.",
                isAvailable: function() {
                    return !ensimeRunning;
                },
                exec: function() {
                    startEnsime(false);
                }
            }, plugin);
            commands.addCommand({
                name: "stopEnsime",
                group: "Scala",
                description: "Stop the scala compiler.",
                isAvailable: function() {
                    return ensimeRunning;
                },
                exec: function() {
                    stopEnsime();
                }
            }, plugin);
            commands.addCommand({
                name: "updateEnsime",
                group: "Scala",
                description: "Update the ENSIME backend. Will take some minutes.",
                exec: function() {
                    updateEnsime();
                }
            }, plugin);
            commands.addCommand({
                name: "recompile",
                group: "Scala",
                description: "Perform a full typecheck of all Scala files.",
                bindKey: {
                    mac: "F8",
                    win: "F8",
                    linux: "F8"
                },
                isAvailable: function() {
                    return ensimeReady;
                },
                exec: function() {
                    var done = false;
                    ensimeConnector.on("event", function hdlr(e) {
                        if (!done && e.typehint === "FullTypeCheckCompleteEvent") {
                            done = true;
                            emit("rebuild");
                            bubble.popup("Recompile completed");
                            ensimeConnector.off("event", hdlr);
                        }
                    });
                    typecheck(function(err) {
                        if (err) return bubble.popup("Recompile failed: " + err);
                        if (!done) bubble.popup("Recompiling...");
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "cleanBuild",
                group: "Scala",
                description: "Perform a clean build.",
                bindKey: {
                    mac: "Shift-F8",
                    win: "Shift-F8",
                    linux: "Shift-F8"
                },
                isAvailable: function() {
                    return ensimeReady;
                },
                exec: function() {
                    var done = false;
                    var recompiling = false;
                    var restarted = false;
                    ensimeConnector.on("event", function hdlr(e) {
                        if (!recompiling && e.typehint === "CompilerRestartedEvent") {
                            recompiling = true;
                            typecheck(function() {
                                restarted = true;
                            });
                        }
                        else if (restarted && !done && e.typehint === "FullTypeCheckCompleteEvent") {
                            done = true;
                            ensimeConnector.off("event", hdlr);
                            emit("rebuild");
                            bubble.popup("Build completed.");
                        }
                    });
                    ensimeUnloadAll(function(err) {
                        if (err) return bubble.popup("Clean build failed: " + err);
                        if (!done) bubble.popup("Performing a clean build...");
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "ensimeConnectionInfo",
                group: "Scala",
                description: "Show the connection info from ENSIME.",
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
            commands.addCommand({
                name: "showMarkers",
                group: "Scala",
                description: "Show the window with all Scala compiler errors and warnings.",
                exec: function() {
                    var e = tabManager.openEditor("ensimeMarkers", true, function() {});
                    e.editor.on("refreshMarkers", function() {
                        emit("refreshMarkers");
                    }, plugin);
                }
            }, plugin);
            commands.addCommand({
                name: "organiseImports",
                group: "Scala",
                description: "Organise the imports in the current file.",
                bindKey: {
                    mac: "Cmd-Shift-O",
                    win: "Ctrl-Shift-O",
                    linux: "Ctrl-Shift-O"
                },
                isAvailable: function() {
                    return ensimeReady &&
                        tabManager.focussedTab.editor.ace &&
                        tabManager.focussedTab.editor.ace.getOptions().mode == "ace/mode/scala";
                },
                exec: function() {
                    emit("organiseImports");
                }
            }, plugin);


            // Menus
            menus.setRootMenu("Scala", 550, plugin);
            menus.addItemByPath("Scala/Jump to Definition", new ui.item({
                command: "jumptodef"
            }), 100, plugin);
            menus.addItemByPath("Scala/Format", new ui.item({
                command: "formatcode"
            }), 110, plugin);
            menus.addItemByPath("Scala/Organise Imports", new ui.item({
                command: "organiseImports"
            }), 120, plugin);
            menus.addItemByPath("Scala/~", new ui.divider(), 199, plugin);
            menus.addItemByPath("Scala/Next Error", new ui.item({
                command: "jumpToMarker"
            }), 200, plugin);
            menus.addItemByPath("Scala/Errors and Warnings", new ui.item({
                command: "showMarkers"
            }), 210, plugin);
            menus.addItemByPath("Scala/~", new ui.divider(), 1000, plugin);
            menus.addItemByPath("Scala/Recompile All", new ui.item({
                command: "recompile"
            }), 1001, plugin);
            menus.addItemByPath("Scala/Clean", new ui.item({
                command: "cleanBuild"
            }), 1002, plugin);
            menus.addItemByPath("Scala/~", new ui.divider(), 2000, plugin);
            menus.addItemByPath("Scala/Start ENSIME", new ui.item({
                command: "startEnsime"
            }), 10550, plugin);
            menus.addItemByPath("Scala/Connection Info", new ui.item({
                command: "ensimeConnectionInfo"
            }), 10551, plugin);
            menus.addItemByPath("Scala/Stop ENSIME", new ui.item({
                command: "stopEnsime"
            }), 10552, plugin);
            menus.addItemByPath("Scala/Update ENSIME", new ui.item({
                command: "updateEnsime"
            }), 10553, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("project/ensime", [
                    ["ensimeFile", "/home/ubuntu/workspace/.ensime"],
                    ["sbt", "/usr/bin/sbt"],
                    ["noExecAnalysis", true],
                    ["node", "/home/ubuntu/.nvm/versions/node/v4.2.4/bin/node"]
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
                        },
                        "SBT Executable": {
                            type: "textbox",
                            setting: "project/ensime/@sbt",
                            position: 101
                        },
                        "Node Executable": {
                            type: "textbox",
                            setting: "project/ensime/@node",
                            position: 102
                        },
                        "Don't use execAnalysis": {
                            type: "checkbox",
                            setting: "project/ensime/@noExecAnalysis",
                            position: 110
                        }
                    }
                }
            }, plugin);
        }


        /***** Lifecycle *****/

        plugin.on("load", function() {
            loadSettings();
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/ensime_connector", function(err, handler) {
                if (err) return console.error(err);
                console.log("ensime-connector initialized.");
                ensimeConnector = handler;

                function sendSettings(handler) {
                    handler.emit("set_ensime_config", {
                        ensimeFile: settings.get("project/ensime/@ensimeFile"),
                        sbt: settings.get("project/ensime/@sbt"),
                        node: settings.get("project/ensime/@node"),
                        noExecAnalysis: settings.get("project/ensime/@noExecAnalysis")
                    });
                }
                settings.on("project/ensime", sendSettings.bind(null, handler), plugin);
                sendSettings(handler);

                registerEnsimeHandlers(handler);
                emit("connector.ready", handler);
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_completer", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_outline", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_markers", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
                handler.on("markers", function(markers) {
                    emit("markers", markers);
                });
                plugin.on("refreshMarkers", function() {
                    handler.emit("refreshMarkers");
                });
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_formatter", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
                format.addFormatter("Scala (Scalariform)", "scala", plugin);
                format.on("format", formatUsingLanguage);
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_tooltip", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_jumptodefinition", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);
            });
            language.registerLanguageHandler("plugins/c9.ide.language.scala/worker/scala_refactor", function(err, handler) {
                if (err) return console.error(err);
                setupConnectorBridge(handler);

                handler.on("updateEditor", function(changes) {
                    var tab = tabManager.focussedTab;
                    changes.forEach(function(change) {
                        if (tab.path === change.path) {
                            var v = tab.document.value;
                            var v2 = v.substring(0, change.from) + change.text + v.substr(change.to);
                            tab.document.setBookmarkedValue(v2);
                            console.warn(change)
                        }
                        else console.info(`ignoring change ${change.path} is not the active editor ${tab.path}`);
                    });
                });

                plugin.on("organiseImports", function() {
                    save.save(tabManager.focussedTab, {}, function(err) {
                        if (err) return console.error("Could not save the file.");
                        handler.emit("organiseImports", tabManager.focussedTab.path);
                    });
                });

                complete.on("replaceText", function(e) {
                    if (e.match && e.match.action) {
                        var action = e.match.action;
                        save.save(tabManager.focussedTab, {}, function(err) {
                            if (err) return console.error("Could not save the file.");

                            if (action.addImport) {
                                handler.emit("addImport", {
                                    path: tabManager.focussedTab.path,
                                    add: action.addImport
                                });
                            }
                        });
                    }
                });
            });

            save.on("afterSave", function(event) {
                emit("afterSave", event.path);
            });
        });

        plugin.on("unload", function() {
            ensimeConnector = null;
            ensimeRunning = false;
            ensimeReady = false;
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_refactor");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_jumptodefinition");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_tooltip");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_formatter");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_completer");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_outline");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/scala_markers");
            language.unregisterLanguageHandler("plugins/c9.ide.language.scala/worker/ensime_connector");
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
            handler.on("updated", function() {
                bubble.popup("ENSIME was updated.");
            });
            handler.on("updateFailed", function(error) {
                bubble.popup("ENSIME could not be updated: " + error);
            });
        }

        function setupConnectorBridge(handler) {
            handler.on("call", function(event) {
                ensimeConnector.emit("call", event);
            });
            ensimeConnector.on("call.result", function(event) {
                handler.emit("call.result", event);
            });
            ensimeConnector.on("event", function(event) {
                handler.emit("event", event);
            });
            plugin.on("afterSave", function(event) {
                handler.emit("afterSave", event.path);
            });
            plugin.on("rebuild", function(event) {
                handler.emit("rebuild", event);
            });
        }

        /** Uses the language to do the formatting.. this should be built in but isn't */
        function formatUsingLanguage(e) {
            language.getWorker(function(err, worker) {
                if (err) return console.error("Could not get language worker");
                worker.emit("code_format", {
                    data: {}
                });
                worker.once("code_format", function(e) {
                    var tab = tabManager.focussedTab;
                    if (tab) {
                        tab.document.value = e.data;
                        tab.editor.ace.selection.clearSelection();
                    }
                });
            });
            return true;
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

        function updateEnsime() {
            if (!ensimeConnector) return console.error("ensime-connector not started.");
            ensimeConnector.emit("update");
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