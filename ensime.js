define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ui", "commands", "menus", "preferences",
        "settings", "notification.bubble", "proc", "fs", "net", "jsonalyzer"
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
        var proc = imports.proc;
        var fs = imports.fs;
        var net = imports.net;
        var jsonalyzer = imports.jsonalyzer;
        var launchCommand = require("text!./server/start-server.sh");

        /***** Initialization *****/

        var ensimeRunning = false;
        var ensimeProcess;
        var ensimePort;

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
                        if (err)
                            return bubble.popup("Could not start ensime: " + err);
                        bubble.popup("Ensime started.");
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
                        bubble.popup("Ensime stopped.");
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
            plugin.on("callEnsime", function(event) {
                callEnsime(event, {
                    emit: emit
                });
            });
            language.registerLanguageHandler("plugins/ensime.language.scala/worker/scala_completer", function(err, handler) {
                if (err) return console.error(err);
                setupHandler(handler);
            });
            jsonalyzer.registerWorkerHandler("plugins/ensime.language.scala/worker/scala_jsonalyzer");

            //Start ensime on load
            startEnsime(function(err, callback) {
                if (err) return;
                bubble.popup("Ensime started.");
            });
        });
        plugin.on("unload", function() {
            ensimeRunning = false;
            ensimeProcess = undefined;
            ensimePort = undefined;
            language.unregisterLanguageHandler("plugins/ensime.language.scala/worker/scala_completer");
            jsonalyzer.unregisterWorkerHandler("plugins/ensime.language.scala/worker/scala_jsonalyzer");
        });

        function setupHandler(handler) {
            settings.on("project/ensime", sendSettings.bind(null, handler), plugin);
            sendSettings(handler);
            handler.on("callEnsime", function(event) {
                callEnsime(event, handler);
            });
        }

        function sendSettings(handler) {
            handler.emit("set_ensime_config", {
                ensimeFile: settings.get("project/ensime/@ensimeFile")
            });
        }

        /***** Register and define API *****/


        /** Ensime-server handling */

        function startEnsime(callback) {
            if (ensimeRunning) return console.log("Ensime is already running.");

            function doStart(callback) {
                var file = settings.get("project/ensime/@ensimeFile");
                console.log("Starting ensime-server for " + file);
                fs.exists(file, function(exists) {
                    if (!exists) return alert("Ensime file does not exist: " + file);
                    proc.spawn("bash", {
                        args: ["-c", launchCommand, "--", file]
                    }, function(err, process) {
                        if (err) return console.error(err);
                        ensimeRunning = true;
                        ensimeProcess = process;
                        bubble.popup("Ensime is starting...");

                        process.stderr.on("data", function(chunk) {
                            chunk.split('\n').forEach(function(l) {
                                if (l.length > 0) console.warn("ENSIME: " + l);
                            });
                        });
                        process.stdout.on("data", function(chunk) {
                            chunk.split('\n').forEach(function(l) {
                                if (l.length > 0) console.log("ENSIME: " + l);
                            });
                        });
                        process.on("exit", function(code) {
                            bubble.popup("Ensime was stopped.");
                            console.log("Ensime server stopped");
                            emit("ensimeStopped", "Exited with code: " + code);
                        });


                        // Wait for ensime to write the port file.
                        loadEnsimePort(function hdlr(err, port) {
                            if (err) {
                                if (!ensimeRunning) return callback("Start aborted: " + err);
                                return window.setTimeout(function() {
                                    loadEnsimePort(hdlr);
                                }, 200);
                            }

                            console.log("ensime-server port is: " + port);
                            ensimePort = port;

                            //send a 'hello'
                            connectionInfo(function hdlr(err, result) {
                                if (err) {
                                    if (!ensimeRunning) return callback("Start aborted: " + err);
                                    return window.setTimeout(function() {
                                        connectionInfo(hdlr);
                                    }, 1000);
                                }
                                console.log("ensime-server is up and running.");
                                bubble.popup("Ensime is ready.");
                                //Trigger a typecheckAll
                                typecheck(function(err) {
                                    if (!err)
                                        bubble.popup("Project is now fully typechecked, all ensime features are now operative.");
                                });
                                callback(undefined, result);
                            });
                        });
                    });
                });

            }

            loadEnsimePort(function(err, port) {
                if (err) {
                    //not running, just start it..
                    doStart(callback);
                }
                else {
                    ensimePort = port;
                    connectionInfo(function(err, result) {
                        if (err) {
                            //running but non-functional. Kill it and start again.
                            ensimePort = undefined;
                            killEnsime(function() {
                                doStart(callback);
                            });
                        }
                        else {
                            // running and working fine..
                            ensimeRunning = true;
                            console.log("ensime-server is already started, reusing.");
                            bubble.popup("Ensime is running (reusing started).");
                            callback(undefined, result);
                        }
                    }, true);
                }
            });
        }

        function stopEnsime(callback) {
            if (!ensimeRunning) return callback("Ensime is not running");
            if (!ensimeProcess) {
                emit("ensimeStopped");
                return callback(undefined, "Stopped");
            }

            ensimeProcess.kill(9, function(err) {
                if (err) {
                    emit("ensimeStopped");
                    return callback(err);
                }
                console.log("Ensime process killed by stopEnsime().");
                callback(undefined, "Stopped.");
            });

        }

        function killEnsime(callback) {
            proc.spawn("pkill", {
                args: ["-f org\\\\.ensime"]
            }, function(err, process) {
                if (err) "ignore error";
                //TODO make relative to .ensime
                fs.rmfile("~/workspace/.ensime_cache/http", function(err) {
                    if (err) return callback(err);
                    callback(undefined, {});
                });
            });
        }

        function loadEnsimePort(callback) {
            //TODO make relative to .ensime
            var file = "~/workspace/.ensime_cache/http";
            fs.exists(file, function(exists) {
                if (!exists) return callback("Port file does not exist.");
                fs.readFile(file, function(err, data) {
                    if (err) return callback(err);
                    callback(undefined, parseInt(data, 10));
                });
            });
        }

        plugin.on("ensimeStopped", function() {
            ensimeRunning = false;
            ensimeProcess = undefined;
            ensimePort = undefined;
        });

        var encoder = new window.TextEncoder("utf-8");

        function callEnsime(data, worker) {
            function fail(reason) {
                if (!data.canary) console.warn("Ensime call failed: " + reason);
                worker.emit("callEnsime.result", {
                    to: data.id,
                    err: reason
                });
            }

            function success(result) {
                worker.emit("callEnsime.result", {
                    to: data.id,
                    result: result
                });
            }
            if (!ensimePort)
                fail("ensime-server port not yet set", true);
            if (!ensimeRunning && !data.canary)
                return fail("ensime-server not running");

            net.connect(ensimePort, {
                retries: 3,
                encoding: "utf-8"
            }, function(err, stream) {
                if (err) return fail("Could not connect to ensime.");


                var json = JSON.stringify(data.request);
                stream.write("POST /rpc HTTP/1.0\r\n");
                stream.write("Host: localhost\r\n");
                stream.write("Content-Type: application/json\r\n");
                stream.write("Content-Length: " + encoder.encode(json).length + "\r\n");
                stream.write("\r\n");
                stream.write(json);
                stream.write("\r\n\r\n");

                var revc = "";
                stream.on("data", function(chunk) {
                    revc = revc + chunk;
                });
                stream.on("end", function() {
                    //Argh, but I didn't find a http library (the one provided works directly from the client - not helpful here).
                    var lines = revc.split('\r\n');
                    var bodyStart = lines.indexOf('');
                    var body = lines.splice(bodyStart + 1).join('\r\n');

                    var code = lines[0].split(' ')[1];
                    if (code != 200) return fail("ensime-server returned http code " + code + ": " + body);

                    var response = JSON.parse(body);
                    success(response);
                });
                stream.on("error", function() {
                    fail("Error reading from ensime-server");
                });
            });
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