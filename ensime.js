define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "preferences", "settings", "proc", "fs"
    ];
    main.provides = ["ensime"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var proc = imports.proc;
        var fs = imports.fs;

        /***** Initialization *****/

        var ensimeRunning = false;
        var ensimeProcess;


        var plugin = new Plugin("Ensime", main.consumes);
        var launchCommand = require("text!./server/start-server.sh").replace(/ {4}/g, " ");
        var emit = plugin.getEmitter();

        function load() {
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

            menus.addItemByPath("Run/Start Ensime Server", new ui.item({
                command: "startEnsime"
            }), 10550-10500, plugin);
            menus.addItemByPath("Run/Stop Ensime Server", new ui.item({
                command: "stopEnsime"
            }), 10551-10500, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("user/ensime", [
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
                            setting: "user/ensime/@ensimeFile",
                            position: 100
                        }
                    }
                }
            }, plugin);
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            ensimeRunning = false;
            ensimeProcess = undefined;
        });

        /***** Register and define API *****/

        function startEnsime() {
            if (ensimeRunning) return console.log("Ensime is already running.");

            var file = settings.get("user/ensime/@ensimeFile");
            console.log("Starting ensime-server for " + file);
            fs.exists(file, function(exists) {
                if (!exists) return alert("Ensime file does not exist: " + file);
                proc.spawn("bash", {
                    args: [ "-c", launchCommand, "--", file ]
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
                        ensimeRunning = false;
                    });
                });
            });
        }

        function stopEnsime() {
            if (!ensimeRunning) return console.log("Ensime is not running.");
            ensimeProcess.kill(9);
            console.log("Ensime process killed by stopEnsime().");
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