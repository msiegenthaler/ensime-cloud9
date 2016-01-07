define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ui", "commands", "menus", "preferences",
        "settings", "proc", "fs", "net", "jsonalyzer"
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
        var proc = imports.proc;
        var fs = imports.fs;
        var net = imports.net;
        var jsonalyzer = imports.jsonalyzer;
        var launchCommand = require("text!./server/start-server.sh");

        /***** Initialization *****/

        var ensimeRunning = true; //TODO temporary
        var ensimeProcess;
        var ensimePort = 33023;

        /** Plugin **/

        var plugin = new Plugin("Ensime", main.consumes);
        var emit = plugin.getEmitter();

        function loadSettings() {
            commands.addCommand({
                name: "startEnsime",
                isAvailable: function() {
                    return !ensimeRunning;
                },
                exec: function() {
                    startEnsime();
                }
            }, plugin);

            commands.addCommand({
                name: "stopEnsime",
                isAvailable: function() {
                    return ensimeRunning;
                },
                exec: function() {
                    stopEnsime();
                }
            }, plugin);

            menus.addItemByPath("Run/Start Ensime", new ui.item({
                command: "startEnsime"
            }), 10550, plugin);
            menus.addItemByPath("Run/Stop Ensime", new ui.item({
                command: "stopEnsime"
            }), 10551, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("project/ensime", [
                    ["ensimeFile", "~/workspace/.ensime"]
                ]);
            });

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
            language.registerLanguageHandler("plugins/ensime.language.scala/worker/scala_completer", function(err, handler) {
                if (err) return console.error(err);
                setupHandler(handler);
            });
            jsonalyzer.registerWorkerHandler("plugins/ensime.language.scala/worker/scala_jsonalyzer");
        });
        plugin.on("unload", function() {
            ensimeRunning = false;
            ensimeProcess = undefined;
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

        function startEnsime() {
            if (ensimeRunning) return console.log("Ensime is already running.");

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
                        console.log("Ensime server stopped");
                        emit("ensimeStopped", "Exited with code: " + code);
                    });
                });
            });
        }

        plugin.on("ensimeStopped", function() {
            ensimeRunning = false;
            ensimeProcess = undefined;
        });


        function stopEnsime() {
            if (!ensimeRunning) return console.log("Ensime is not running.");
            ensimeProcess.kill(9);
            console.log("Ensime process killed by stopEnsime().");
        }


        function callEnsime(data, worker) {
            function fail(reason) {
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
            if (!ensimeRunning)
                return fail("ensime-server not running");

            console.log("Data = ");
            console.log(data);
            console.log("Calling ensime-server on " + ensimePort + " with for request " + data.id + ": ");
            console.log(data.request);
            net.connect(ensimePort, {
                retries: 3
            }, function(err, stream) {
                if (err) return fail("Could not connect to ensime.");
                stream.write("POST /rpc HTTP/1.1\n");
                stream.write("Host: localhost\n");
                stream.write(JSON.stringify(data.request));
                stream.write("\n\n");

                //TODO error handling...
                stream.on("data", function(chunk) {
                    console.log("Ensime answered: ");
                    console.log(chunk);
                    success({});
                });
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