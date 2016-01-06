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

        var plugin = new Plugin("Ensime", main.consumes);
        var emit = plugin.getEmitter();

        var showing;

        function load() {
            commands.addCommand({
                name: "startEnsime",
                isAvailable: function() {
                    return true;
                },
                exec: function() {
                    startEnsime();
                }
            }, plugin);

            menus.addItemByPath("Run/Start Ensime Server", new ui.item({
                command: "startEnsime"
            }), 300, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("user/ensome", [
                    ["ensimeFile", "~/workspace/.ensime"]
                ]);
            });

            prefs.add({
                "Example": {
                    position: 450,
                    "Ensime (Scala)": {
                        position: 100,
                        ".ensime Location": {
                            type: "textfield",
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
        });

        /***** Register and define API *****/
        var ensimeRunning = false;

        function startEnsime() {
            var file = settings.get("user/ensime/@ensimeFile");
            fs.exists(file, function(exists) {
                if (!exists) return alert("Ensime file does not exist: " + file);
                proc.spawn("~/.c9/plugins/ensime/server/start-server.sh", file, function(err, process) {
                    if (err) return console.error(err);
                    ensimeRunning = true;

                    process.stderr.on("data", function(chunk) {
                        console.warn("Ensime: "+chunk);
                    });
                    process.stdout.on("data", function(chunk) {
                        console.log("Ensime: "+chunk);
                    });
                    process.on("exit", function(code) {
                        console.log("Ensime server stopped");
                        ensimeRunning = false;
                    });
                })
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